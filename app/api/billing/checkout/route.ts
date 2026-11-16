import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

/**
 * Checkout products accepted by POST /api/billing/checkout:
 * pro_weekly, pro_monthly, credits_25, and credits_100.
 * The simulate flag is a local/test-only grant, never a verified payment.
 */
const PRODUCTS = {
  pro_weekly: { kind: "subscription" as const },
  pro_monthly: { kind: "subscription" as const },
  credits_25: { kind: "credits" as const, credits: 25, priceInr: 299 },
  credits_100: { kind: "credits" as const, credits: 100, priceInr: 799 },
}

const DEFAULT_WEEKLY_PRICE_INR = 499
const DEFAULT_MONTHLY_PRICE_INR = 1499
const MAX_SQLITE_INT = 2_147_483_647

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let parsedBody: unknown
  try {
    parsedBody = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  const body = parsedBody as { product?: unknown; simulate?: unknown }

  if (typeof body.product !== "string" || !Object.hasOwn(PRODUCTS, body.product)) {
    return NextResponse.json({ error: "Choose a valid billing product." }, { status: 400 })
  }
  if (body.simulate !== undefined && typeof body.simulate !== "boolean") {
    return NextResponse.json({ error: "The simulate field must be a boolean." }, { status: 400 })
  }

  const product = PRODUCTS[body.product as keyof typeof PRODUCTS]
  const settings = product.kind === "subscription"
    ? await prisma.siteSetting.findFirst({
        select: { weeklyPriceInr: true, monthlyPriceInr: true },
      })
    : null
  // Resolve pricing only from server-owned settings/constants; never accept an
  // amount from the caller. A configured payment provider is not implemented.
  const priceInr = product.kind === "credits"
    ? product.priceInr
    : body.product === "pro_weekly"
      ? settings?.weeklyPriceInr ?? DEFAULT_WEEKLY_PRICE_INR
      : settings?.monthlyPriceInr ?? DEFAULT_MONTHLY_PRICE_INR

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

  // `priceInr` is intentionally resolved above for the product contract, but
  // this simulation does not charge or assert that a payment occurred.
  void priceInr

  if (product.kind === "subscription") {
    const updated = await prisma.user.updateMany({
      where: { id: user.userId },
      data: { plan: "PRO" },
    })
    if (updated.count !== 1) {
      return NextResponse.json({ error: "User account was not found." }, { status: 401 })
    }
  } else {
    const updated = await prisma.user.updateMany({
      where: {
        id: user.userId,
        credits: { lte: MAX_SQLITE_INT - product.credits },
      },
      data: { credits: { increment: product.credits } },
    })
    if (updated.count !== 1) {
      const existingUser = await prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true },
      })
      if (!existingUser) {
        return NextResponse.json({ error: "User account was not found." }, { status: 401 })
      }
      return NextResponse.json({ error: "Credit balance limit reached." }, { status: 409 })
    }
  }

  const updatedUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { plan: true, credits: true },
  })
  if (!updatedUser) {
    return NextResponse.json({ error: "User account was not found." }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    plan: updatedUser.plan,
    credits: updatedUser.credits,
  })
}
