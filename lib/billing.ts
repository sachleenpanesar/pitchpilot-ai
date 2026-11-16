import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"

export const BILLING_PRODUCTS = {
  pro_weekly: { kind: "subscription" as const, durationDays: 7 },
  pro_monthly: { kind: "subscription" as const, durationDays: 30 },
  credits_25: { kind: "credits" as const, credits: 25, priceInr: 299 },
  credits_100: { kind: "credits" as const, credits: 100, priceInr: 799 },
}

export type BillingProductId = keyof typeof BILLING_PRODUCTS

const DEFAULT_WEEKLY_PRICE_INR = 499
const DEFAULT_MONTHLY_PRICE_INR = 1499

export async function getProductPrice(productId: BillingProductId): Promise<number> {
  const product = BILLING_PRODUCTS[productId]
  if (product.kind === "credits") return product.priceInr
  const settings = await prisma.siteSetting.findFirst({
    select: { weeklyPriceInr: true, monthlyPriceInr: true },
  })
  return productId === "pro_weekly"
    ? settings?.weeklyPriceInr ?? DEFAULT_WEEKLY_PRICE_INR
    : settings?.monthlyPriceInr ?? DEFAULT_MONTHLY_PRICE_INR
}

export function calculateDiscountedAmount(originalAmountInr: number, discountPercent: number): number {
  return Math.round(originalAmountInr * (100 - discountPercent) / 100)
}

export function normalizePromoCode(code: string): string {
  return code.trim().toUpperCase()
}

export function isValidPromoCode(code: string): boolean {
  return /^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(normalizePromoCode(code))
}

export async function getAvailablePromoDiscount(
  userId: string,
  code: string,
  transaction?: Prisma.TransactionClient,
) {
  const db = transaction ?? prisma
  const normalizedCode = normalizePromoCode(code)
  return db.promoCodeRedemption.findFirst({
    where: {
      userId,
      status: "AVAILABLE",
      discountPercent: { gt: 0 },
      // Redemption captures a discount entitlement. Its original promo may
      // later expire or be deactivated without invalidating that entitlement.
      promoCode: { code: normalizedCode },
    },
    select: { id: true, discountPercent: true, promoCodeId: true },
  })
}
