import { Prisma } from "@prisma/client"
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

class PromoReservationError extends Error {}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }

  const values = body as Record<string, unknown>
  if (Object.keys(values).some((key) => key !== "product" && key !== "utrNumber" && key !== "code")) {
    return NextResponse.json({ error: "Only product, utrNumber, and code are accepted." }, { status: 400 })
  }
  if (typeof values.product !== "string" || !Object.hasOwn(BILLING_PRODUCTS, values.product)) {
    return NextResponse.json({ error: "Choose a valid billing product." }, { status: 400 })
  }
  if (values.code !== undefined && (typeof values.code !== "string" || !isValidPromoCode(values.code))) {
    return NextResponse.json({ error: "Promo code must be 3–32 letters, numbers, underscores, or hyphens." }, { status: 400 })
  }
  if (typeof values.utrNumber !== "string" || !/^\d{12}$/.test(values.utrNumber)) {
    return NextResponse.json({ error: "UTR number must contain exactly 12 digits." }, { status: 400 })
  }

  const productId = values.product as keyof typeof BILLING_PRODUCTS
  const setting = await prisma.siteSetting.findFirst({
    select: { weeklyPriceInr: true, monthlyPriceInr: true, upiId: true, upiPayeeName: true },
  })
  const originalAmountInr = await getProductPrice(productId)
  const redemption = values.code
    ? await getAvailablePromoDiscount(user.userId, values.code as string)
    : null
  if (values.code && !redemption) {
    return NextResponse.json({ error: "No available discount was redeemed for this code." }, { status: 409 })
  }
  const discountPercent = redemption?.discountPercent ?? 0
  const amountInr = calculateDiscountedAmount(originalAmountInr, discountPercent)

  if (!Number.isSafeInteger(amountInr) || amountInr <= 0) {
    return NextResponse.json({ error: "Direct UPI payment amount must be greater than zero." }, { status: 400 })
  }
  if (!setting?.upiId || !setting.upiPayeeName) {
    return NextResponse.json({ error: "Direct UPI payments are not configured yet." }, { status: 503 })
  }
  const existingUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { id: true },
  })
  if (!existingUser) {
    return NextResponse.json({ error: "User account was not found." }, { status: 401 })
  }

  try {
    const paymentRequest = await prisma.$transaction(async (transaction) => {
      if (redemption) {
        const reserved = await transaction.promoCodeRedemption.updateMany({
          where: { id: redemption.id, userId: user.userId, status: "AVAILABLE" },
          data: { status: "RESERVED" },
        })
        if (reserved.count !== 1) throw new PromoReservationError()
      }
      return transaction.paymentRequest.create({
        data: {
          userId: user.userId,
          planOrPack: productId,
          amountInr,
          originalAmountInr,
          discountPercent,
          promoRedemptionId: redemption?.id,
          utrNumber: values.utrNumber as string,
        },
        select: {
          id: true,
          planOrPack: true,
          amountInr: true,
          originalAmountInr: true,
          discountPercent: true,
          utrNumber: true,
          status: true,
          createdAt: true,
        },
      })
    })

    return NextResponse.json({
      success: true,
      paymentRequest,
      paymentInstructions: {
        upiId: setting.upiId,
        upiPayeeName: setting.upiPayeeName,
        amountInr,
      },
    }, { status: 201 })
  } catch (error) {
    if (error instanceof PromoReservationError) {
      return NextResponse.json({ error: "Promo discount is already reserved or used." }, { status: 409 })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This UTR number has already been submitted." }, { status: 409 })
    }
    console.error("UPI payment submission failed:", error)
    return NextResponse.json({ error: "Could not submit the payment for review." }, { status: 500 })
  }
}
