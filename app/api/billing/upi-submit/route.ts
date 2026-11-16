import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const PRODUCTS = {
  pro_weekly: { kind: "subscription" as const },
  pro_monthly: { kind: "subscription" as const },
  credits_25: { kind: "credits" as const, priceInr: 299 },
  credits_100: { kind: "credits" as const, priceInr: 799 },
}

const DEFAULT_WEEKLY_PRICE_INR = 499
const DEFAULT_MONTHLY_PRICE_INR = 1499

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
  if (Object.keys(values).some((key) => key !== "product" && key !== "utrNumber")) {
    return NextResponse.json({ error: "Only product and utrNumber are accepted." }, { status: 400 })
  }
  if (typeof values.product !== "string" || !Object.hasOwn(PRODUCTS, values.product)) {
    return NextResponse.json({ error: "Choose a valid billing product." }, { status: 400 })
  }
  if (typeof values.utrNumber !== "string" || !/^\d{12}$/.test(values.utrNumber)) {
    return NextResponse.json({ error: "UTR number must contain exactly 12 digits." }, { status: 400 })
  }

  const productId = values.product as keyof typeof PRODUCTS
  const product = PRODUCTS[productId]
  const setting = await prisma.siteSetting.findFirst({
    select: { weeklyPriceInr: true, monthlyPriceInr: true, upiId: true, upiPayeeName: true },
  })
  const amountInr = product.kind === "credits"
    ? product.priceInr
    : productId === "pro_weekly"
      ? setting?.weeklyPriceInr ?? DEFAULT_WEEKLY_PRICE_INR
      : setting?.monthlyPriceInr ?? DEFAULT_MONTHLY_PRICE_INR

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
    const paymentRequest = await prisma.paymentRequest.create({
      data: {
        userId: user.userId,
        planOrPack: productId,
        amountInr,
        utrNumber: values.utrNumber,
      },
      select: {
        id: true,
        planOrPack: true,
        amountInr: true,
        utrNumber: true,
        status: true,
        createdAt: true,
      },
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
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This UTR number has already been submitted." }, { status: 409 })
    }
    console.error("UPI payment submission failed:", error)
    return NextResponse.json({ error: "Could not submit the payment for review." }, { status: 500 })
  }
}
