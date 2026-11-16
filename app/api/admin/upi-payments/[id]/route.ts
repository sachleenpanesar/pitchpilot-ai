import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const PRODUCTS = {
  pro_weekly: { kind: "subscription" as const },
  pro_monthly: { kind: "subscription" as const },
  credits_25: { kind: "credits" as const, credits: 25, priceInr: 299 },
  credits_100: { kind: "credits" as const, credits: 100, priceInr: 799 },
}

const MAX_SQLITE_INT = 2_147_483_647

type ReviewErrorCode =
  | "PAYMENT_NOT_FOUND"
  | "PAYMENT_ALREADY_REVIEWED"
  | "PRODUCT_INVALID"
  | "AMOUNT_MISMATCH"
  | "USER_NOT_FOUND"
  | "CREDIT_BALANCE_LIMIT"

class ReviewError extends Error {
  constructor(readonly code: ReviewErrorCode, readonly status: number) {
    super(code)
  }
}

function responseForCurrentStatus(
  payment: {
    id: string
    userId: string
    planOrPack: string
    amountInr: number
    status: string
    createdAt: Date
  },
  requestedStatus: "APPROVED" | "REJECTED",
) {
  if (payment.status === requestedStatus) {
    return NextResponse.json({
      success: true,
      payment,
      alreadyReviewed: true,
    })
  }
  return NextResponse.json(
    { error: "PAYMENT_ALREADY_REVIEWED", status: payment.status },
    { status: 409 },
  )
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const { id } = await context.params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  const status = (body as Record<string, unknown>).status
  if (status !== "APPROVED" && status !== "REJECTED") {
    return NextResponse.json({ error: "Status must be APPROVED or REJECTED." }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const payment = await transaction.paymentRequest.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          planOrPack: true,
          amountInr: true,
          status: true,
          createdAt: true,
        },
      })
      if (!payment) throw new ReviewError("PAYMENT_NOT_FOUND", 404)
      if (payment.status !== "PENDING") {
        if (payment.status === status) return { payment, alreadyReviewed: true }
        throw new ReviewError("PAYMENT_ALREADY_REVIEWED", 409)
      }

      let product: (typeof PRODUCTS)[keyof typeof PRODUCTS] | undefined
      if (status === "APPROVED") {
        if (Object.hasOwn(PRODUCTS, payment.planOrPack)) {
          product = PRODUCTS[payment.planOrPack as keyof typeof PRODUCTS]
        }
        if (!product) throw new ReviewError("PRODUCT_INVALID", 409)

        // The amount is the server-computed quote stored at submission time.
        // Re-reading SiteSetting here would invalidate pending requests after a price change.
        if (
          !Number.isSafeInteger(payment.amountInr) ||
          payment.amountInr <= 0 ||
          (product.kind === "credits" && payment.amountInr !== product.priceInr)
        ) {
          throw new ReviewError("AMOUNT_MISMATCH", 409)
        }

        const user = await transaction.user.findUnique({
          where: { id: payment.userId },
          select: { id: true, credits: true },
        })
        if (!user) throw new ReviewError("USER_NOT_FOUND", 409)
        if (product.kind === "credits" && user.credits > MAX_SQLITE_INT - product.credits) {
          throw new ReviewError("CREDIT_BALANCE_LIMIT", 409)
        }
      }

      const transition = await transaction.paymentRequest.updateMany({
        where: { id, status: "PENDING" },
        data: { status },
      })
      if (transition.count !== 1) {
        const current = await transaction.paymentRequest.findUnique({
          where: { id },
          select: { status: true },
        })
        if (!current) throw new ReviewError("PAYMENT_NOT_FOUND", 404)
        if (current.status === status) {
          return { payment: { ...payment, status }, alreadyReviewed: true }
        }
        throw new ReviewError("PAYMENT_ALREADY_REVIEWED", 409)
      }

      if (status === "APPROVED") {
        if (!product) throw new ReviewError("PRODUCT_INVALID", 409)
        if (product.kind === "subscription") {
          await transaction.user.update({
            where: { id: payment.userId },
            data: { plan: "PRO" },
          })
        } else {
          const grant = await transaction.user.updateMany({
            where: {
              id: payment.userId,
              credits: { lte: MAX_SQLITE_INT - product.credits },
            },
            data: { credits: { increment: product.credits } },
          })
          if (grant.count !== 1) {
            const user = await transaction.user.findUnique({
              where: { id: payment.userId },
              select: { id: true },
            })
            if (!user) throw new ReviewError("USER_NOT_FOUND", 409)
            throw new ReviewError("CREDIT_BALANCE_LIMIT", 409)
          }
        }
      }

      return {
        payment: {
          id: payment.id,
          userId: payment.userId,
          planOrPack: payment.planOrPack,
          amountInr: payment.amountInr,
          status,
          createdAt: payment.createdAt,
        },
        alreadyReviewed: false,
      }
    })

    return NextResponse.json({
      success: true,
      payment: result.payment,
      alreadyReviewed: result.alreadyReviewed,
    })
  } catch (error) {
    if (error instanceof ReviewError) {
      return NextResponse.json({ error: error.code }, { status: error.status })
    }

    // A concurrent request can win the SQLite write lock or complete first.
    // Report its committed result rather than ever issuing a second grant.
    try {
      const current = await prisma.paymentRequest.findUnique({
        where: { id },
        select: {
          id: true,
          userId: true,
          planOrPack: true,
          amountInr: true,
          status: true,
          createdAt: true,
        },
      })
      if (current && current.status !== "PENDING") return responseForCurrentStatus(current, status)
    } catch {
      // Fall through to the explicit service error below.
    }
    console.error("UPI payment review failed:", error)
    return NextResponse.json({ error: "Could not review the payment." }, { status: 500 })
  }
}
