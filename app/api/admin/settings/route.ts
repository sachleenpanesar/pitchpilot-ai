import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const defaults = {
  heroTitle: "PitchPilot AI - Stealth Interview Copilot",
  heroSubtitle: "Ace interviews and pitch calls with real-time AI prompts completely undetectable on screen share.",
  starterCredits: 50,
  weeklyPriceInr: 499,
  monthlyPriceInr: 1499,
  upiId: "",
  upiPayeeName: "",
}

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const settings = await prisma.siteSetting.findFirst()
  return NextResponse.json({ settings: settings ?? defaults })
}

export async function PATCH(request: Request) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Send a valid settings object." }, { status: 400 })
    }
    const values = body as Record<string, unknown>
    const heroTitle = typeof values.heroTitle === "string" ? values.heroTitle.trim() : ""
    const heroSubtitle = typeof values.heroSubtitle === "string" ? values.heroSubtitle.trim() : ""
    const starterCredits = values.starterCredits
    const weeklyPriceInr = values.weeklyPriceInr
    const monthlyPriceInr = values.monthlyPriceInr
    const upiId = typeof values.upiId === "string" ? values.upiId.trim() : ""
    const upiPayeeName = typeof values.upiPayeeName === "string" ? values.upiPayeeName.trim() : ""

    if (!heroTitle || heroTitle.length > 120 || !heroSubtitle || heroSubtitle.length > 500) {
      return NextResponse.json({ error: "Add a headline (max 120 characters) and description (max 500 characters)." }, { status: 400 })
    }
    if (
      typeof starterCredits !== "number" ||
      !Number.isSafeInteger(starterCredits) ||
      starterCredits < 0 ||
      starterCredits > 1_000_000
    ) {
      return NextResponse.json({ error: "Starter credits must be a whole number from 0 to 1,000,000." }, { status: 400 })
    }
    if (
      typeof weeklyPriceInr !== "number" ||
      !Number.isSafeInteger(weeklyPriceInr) ||
      weeklyPriceInr < 0 ||
      weeklyPriceInr > 1_000_000 ||
      typeof monthlyPriceInr !== "number" ||
      !Number.isSafeInteger(monthlyPriceInr) ||
      monthlyPriceInr < 0 ||
      monthlyPriceInr > 1_000_000
    ) {
      return NextResponse.json({ error: "Prices must be whole numbers from ₹0 to ₹1,000,000." }, { status: 400 })
    }

    if (
      upiId.length > 255 ||
      !/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(upiId) ||
      !upiPayeeName ||
      upiPayeeName.length > 120
    ) {
      return NextResponse.json(
        { error: "Enter a valid UPI ID (for example, name@bank) and payee name (max 120 characters)." },
        { status: 400 },
      )
    }

    const existing = await prisma.siteSetting.findFirst({ select: { id: true } })
    const settings = existing
      ? await prisma.siteSetting.update({
          where: { id: existing.id },
          data: { heroTitle, heroSubtitle, starterCredits, weeklyPriceInr, monthlyPriceInr, upiId, upiPayeeName },
        })
      : await prisma.siteSetting.create({
          data: { ...defaults, heroTitle, heroSubtitle, starterCredits, weeklyPriceInr, monthlyPriceInr, upiId, upiPayeeName },
        })

    return NextResponse.json({ settings })
  } catch (error) {
    console.error("Admin settings update failed:", error)
    return NextResponse.json({ error: "Could not save site settings." }, { status: 400 })
  }
}
