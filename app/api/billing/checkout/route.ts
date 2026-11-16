import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import {
  BILLING_PRODUCTS,
  calculateDiscountedAmount,
  getAvailablePromoDiscount,
  getProductPrice,
  isValidPromoCode,
} from "@/lib/billing"
import { prisma } from "@/lib/prisma"

const MAX_CREDITS = 2_147_483_647

class CheckoutError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  const body = parsedBody as Record<string, unknown>
  if (Object.keys(body).some((key) => key !== "product" && key !== "simulate" && key !== "code")) {
    return NextResponse.json({ error: "Only product, simulate, and code are accepted." }, { status: 400 })
  }
  if (typeof body.product !== "string" || !Object.hasOwn(BILLING_PRODUCTS, body.product)) {
    return NextResponse.json({ error: "Choose a valid billing product." }, { status: 400 })
  }
  if (body.simulate !== undefined && typeof body.simulate !== "boolean") {
    return NextResponse.json({ error: "The simulate field must be a boolean." }, { status: 400 })
  }
  if (body.code !== undefined && (typeof body.code !== "string" || !isValidPromoCode(body.code))) {
    return NextResponse.json({ error: "Promo code must be 3–32 letters, numbers, underscores, or hyphens." }, { status: 400 })
  }

  const productId = body.product as keyof typeof BILLING_PRODUCTS
  const product = BILLING_PRODUCTS[productId]
  const originalAmountInr = await getProductPrice(productId)
  const redemption = body.code
    ? await getAvailablePromoDiscount(user.userId, body.code as string)
    : null
  if (body.code && !redemption) {
    return NextResponse.json({ error: "No available discount was redeemed for this code." }, { status: 409 })
  }
  const discountPercent = redemption?.discountPercent ?? 0
  const amountInr = calculateDiscountedAmount(originalAmountInr, discountPercent)
  if (!Number.isSafeInteger(originalAmountInr) || originalAmountInr <= 0 || !Number.isSafeInteger(amountInr) || amountInr < 0) {
    return NextResponse.json({ error: "The selected billing product is not available." }, { status: 400 })
  }

  // This route is the repository's non-production test checkout only. A real
  // payment integration must confirm payment before consuming the entitlement.
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: body.simulate === true
        ? "Payment simulation is disabled in production; no payment provider is configured."
        : "Checkout is unavailable because no payment provider is configured." },
      { status: 503 },
    )
  }
  if (body.simulate !== true) {
    return NextResponse.json(
      { error: "Checkout is unavailable because no payment provider is configured. Use simulate: true only outside production." },
      { status: 503 },
    )
  }

  try {
    const updatedUser = await prisma.$transaction(async (transaction) => {
      if (redemption) {
        const reserved = await transaction.promoCodeRedemption.updateMany({
          where: { id: redemption.id, userId: user.userId, status: "AVAILABLE" },
          data: { status: "CONSUMED" },
        })
        if (reserved.count !== 1) throw new CheckoutError("Promo discount has already been used.", 409)
      }

      let updated
      if (product.kind === "subscription") {
        const current = await transaction.user.findUnique({
          where: { id: user.userId },
          select: { proExpiresAt: true },
        })
        if (!current) throw new CheckoutError("User account was not found.", 401)
        const now = new Date()
        const base = current.proExpiresAt && current.proExpiresAt > now ? current.proExpiresAt : now
        updated = await transaction.user.update({
          where: { id: user.userId },
          data: {
            plan: "PRO",
            proExpiresAt: new Date(base.getTime() + product.durationDays * 24 * 60 * 60 * 1000),
          },
          select: { plan: true, credits: true },
        })
      } else {
        const grant = await transaction.user.updateMany({
          where: { id: user.userId, credits: { lte: MAX_CREDITS - product.credits } },
          data: { credits: { increment: product.credits } },
        })
        if (grant.count !== 1) throw new CheckoutError("Credit balance limit reached.", 409)
        updated = await transaction.user.findUnique({
          where: { id: user.userId },
          select: { plan: true, credits: true },
        })
        if (!updated) throw new CheckoutError("User account was not found.", 401)
      }

      // Simulation records the server quote, but is deliberately not APPROVED,
      // so it does not inflate actual approved revenue in the admin summary.
      await transaction.paymentRequest.create({
        data: {
          userId: user.userId,
          planOrPack: productId,
          amountInr,
          originalAmountInr,
          discountPercent,
          promoRedemptionId: redemption?.id,
          status: "SIMULATED",
        },
      })
      return updated
    })

    return NextResponse.json({
      success: true,
      plan: updatedUser.plan,
      credits: updatedUser.credits,
      originalAmountInr,
      discountPercent,
      amountInr,
    })
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    console.error("Checkout simulation failed:", error)
    return NextResponse.json({ error: "Could not complete the checkout simulation." }, { status: 500 })
  }
}
