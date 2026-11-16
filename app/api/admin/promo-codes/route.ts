import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

function validatePromoInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "Send a valid JSON request."
  const body = value as Record<string, unknown>
  const allowed = ["code", "bonusCredits", "discountPercent", "maxUses", "expiresAt", "isActive"]
  if (Object.keys(body).some((key) => !allowed.includes(key))) return "The request contains unsupported fields."
  if (typeof body.code !== "string" || !/^[A-Z0-9][A-Z0-9_-]{2,31}$/.test(body.code.trim().toUpperCase())) {
    return "Code must be 3–32 letters, numbers, underscores, or hyphens."
  }
  if (body.bonusCredits !== undefined && (!Number.isSafeInteger(body.bonusCredits) || (body.bonusCredits as number) < 0 || (body.bonusCredits as number) > 100_000)) {
    return "Bonus credits must be a whole number from 0 to 100,000."
  }
  if (body.discountPercent !== undefined && (!Number.isSafeInteger(body.discountPercent) || (body.discountPercent as number) < 0 || (body.discountPercent as number) > 100)) {
    return "Discount percent must be a whole number from 0 to 100."
  }
  if ((body.bonusCredits ?? 0) === 0 && (body.discountPercent ?? 0) === 0) {
    return "A promo code must grant credits, a discount, or both."
  }
  if (body.maxUses !== undefined && body.maxUses !== null && (!Number.isSafeInteger(body.maxUses) || (body.maxUses as number) < 1 || (body.maxUses as number) > 10_000_000)) {
    return "Maximum uses must be null or a whole number from 1 to 10,000,000."
  }
  if (body.expiresAt !== undefined && body.expiresAt !== null && (typeof body.expiresAt !== "string" || !Number.isFinite(Date.parse(body.expiresAt)))) {
    return "Expiry must be a valid ISO date or null."
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return "isActive must be a boolean."
  }
  return null
}

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const promoCodes = await prisma.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, code: true, bonusCredits: true, discountPercent: true,
        maxUses: true, usedCount: true, expiresAt: true, isActive: true,
        createdAt: true, updatedAt: true,
      },
    })
    return NextResponse.json({ promoCodes })
  } catch (error) {
    console.error("Admin promo-code list failed:", error)
    return NextResponse.json({ error: "Could not load promo codes." }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  const validationError = validatePromoInput(body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
  const values = body as Record<string, unknown>
  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        code: (values.code as string).trim().toUpperCase(),
        bonusCredits: (values.bonusCredits as number | undefined) ?? 0,
        discountPercent: (values.discountPercent as number | undefined) ?? 0,
        maxUses: (values.maxUses as number | null | undefined) ?? null,
        expiresAt: values.expiresAt ? new Date(values.expiresAt as string) : null,
        isActive: (values.isActive as boolean | undefined) ?? true,
      },
    })
    return NextResponse.json({ promoCode }, { status: 201 })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "That promo code already exists." }, { status: 409 })
    }
    console.error("Admin promo-code creation failed:", error)
    return NextResponse.json({ error: "Could not create this promo code." }, { status: 500 })
  }
}
