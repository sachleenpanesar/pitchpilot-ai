import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import {
  BILLING_PRODUCTS,
  calculateDiscountedAmount,
  getAvailablePromoDiscount,
  getProductPrice,
  isValidPromoCode,
  normalizePromoCode,
} from "@/lib/billing"

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
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
  if (
    typeof values.code !== "string" ||
    !isValidPromoCode(values.code) ||
    typeof values.planOrPack !== "string" ||
    !Object.hasOwn(BILLING_PRODUCTS, values.planOrPack)
  ) {
    return NextResponse.json({ error: "Provide a promo code and valid planOrPack." }, { status: 400 })
  }
  try {
    const redemption = await getAvailablePromoDiscount(user.userId, normalizePromoCode(values.code))
    if (!redemption) return NextResponse.json({ error: "No available discount was redeemed for this code." }, { status: 409 })
    const originalAmountInr = await getProductPrice(values.planOrPack as keyof typeof BILLING_PRODUCTS)
    const amountInr = calculateDiscountedAmount(originalAmountInr, redemption.discountPercent)
    if (!Number.isSafeInteger(originalAmountInr) || originalAmountInr <= 0 || amountInr < 0) {
      return NextResponse.json({ error: "The selected billing product is not available." }, { status: 400 })
    }
    return NextResponse.json({
      originalAmountInr,
      discountPercent: redemption.discountPercent,
      amountInr,
    })
  } catch (error) {
    console.error("Promo quote failed:", error)
    return NextResponse.json({ error: "Could not calculate the promo quote." }, { status: 500 })
  }
}
