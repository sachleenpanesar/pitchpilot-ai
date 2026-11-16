import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { isValidPromoCode, normalizePromoCode } from "@/lib/billing"
import { prisma } from "@/lib/prisma"

const MAX_CREDITS = 2_147_483_647

class RedemptionError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser()
  if (!user?.userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body) ||
    Object.keys(body).some((key) => key !== "code") ||
    typeof (body as Record<string, unknown>).code !== "string"
  ) {
    return NextResponse.json({ error: "Provide a promo code." }, { status: 400 })
  }
  const code = normalizePromoCode((body as { code: string }).code)
  if (!isValidPromoCode(code)) {
    return NextResponse.json({ error: "Promo code must be 3–32 letters, numbers, underscores, or hyphens." }, { status: 400 })
  }

  try {
    const result = await prisma.$transaction(async (transaction) => {
      const promo = await transaction.promoCode.findUnique({ where: { code } })
      const now = new Date()
      if (!promo || !promo.isActive || (promo.expiresAt && promo.expiresAt <= now)) {
        return { error: "Promo code is invalid or expired.", status: 404 as const }
      }
      if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
        return { error: "Promo code has reached its redemption limit.", status: 409 as const }
      }

      const claimed = await transaction.promoCode.updateMany({
        where: {
          id: promo.id,
          isActive: true,
          ...(promo.maxUses === null ? {} : { usedCount: { lt: promo.maxUses } }),
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
        data: { usedCount: { increment: 1 } },
      })
      if (claimed.count !== 1) {
        return { error: "Promo code is invalid, expired, or fully redeemed.", status: 409 as const }
      }

      const creditUpdate = await transaction.user.updateMany({
        where: { id: user.userId, credits: { lte: MAX_CREDITS - promo.bonusCredits } },
        data: { credits: { increment: promo.bonusCredits } },
      })
      if (creditUpdate.count !== 1) {
        throw new RedemptionError("Credit balance limit reached.", 409)
      }

      const redemption = await transaction.promoCodeRedemption.create({
        data: {
          promoCodeId: promo.id,
          userId: user.userId,
          discountPercent: promo.discountPercent,
        },
      })
      const updatedUser = await transaction.user.findUnique({
        where: { id: user.userId },
        select: { credits: true },
      })
      if (!updatedUser) throw new RedemptionError("User account was not found.", 401)
      return {
        creditsAdded: promo.bonusCredits,
        credits: updatedUser.credits,
        discountPercent: promo.discountPercent,
        redemptionId: redemption.id,
      }
    })
    if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof RedemptionError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "This promo code has already been redeemed by your account." }, { status: 409 })
    }
    console.error("Promo-code redemption failed:", error)
    return NextResponse.json({ error: "Could not redeem this promo code." }, { status: 500 })
  }
}
