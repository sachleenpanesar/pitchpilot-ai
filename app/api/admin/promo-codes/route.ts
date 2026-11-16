import { Prisma } from "@prisma/client"
import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})?)?$/i

function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DATE_PATTERN.test(value) || !Number.isFinite(Date.parse(value))) {
    return false
  }

  const [year, month, day] = value.slice(0, 10).split("-").map(Number)
  const calendarDate = new Date(0)
  calendarDate.setUTCHours(0, 0, 0, 0)
  calendarDate.setUTCFullYear(year, month - 1, day)
  return calendarDate.getUTCFullYear() === year
    && calendarDate.getUTCMonth() === month - 1
    && calendarDate.getUTCDate() === day
}

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
  if (body.expiresAt !== undefined && body.expiresAt !== null && !isValidIsoDate(body.expiresAt)) {
    return "Expiry must be a valid ISO date or null."
  }
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") {
    return "isActive must be a boolean."
  }
  return null
}

function normalizeOptionalEmptyValues(value: unknown): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value

  const body = value as Record<string, unknown>
  return {
    ...body,
    maxUses: typeof body.maxUses === "string" && body.maxUses.trim() === "" ? null : body.maxUses,
    expiresAt: typeof body.expiresAt === "string" && body.expiresAt.trim() === "" ? null : body.expiresAt,
  }
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
  const values = normalizeOptionalEmptyValues(body) as Record<string, unknown>
  const validationError = validatePromoInput(values)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const expiresAt = values.expiresAt == null ? null : new Date(values.expiresAt as string)
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
    return NextResponse.json({ error: "Expiry must be a valid ISO date or null." }, { status: 400 })
  }

  try {
    const promoCode = await prisma.promoCode.create({
      data: {
        code: (values.code as string).trim().toUpperCase(),
        bonusCredits: (values.bonusCredits as number | undefined) ?? 0,
        discountPercent: (values.discountPercent as number | undefined) ?? 0,
        maxUses: (values.maxUses as number | null | undefined) ?? null,
        expiresAt,
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
