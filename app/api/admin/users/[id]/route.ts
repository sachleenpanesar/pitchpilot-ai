import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const { id } = await params
    const body = await request.json()
    const plan = body.plan
    const bonusCredits = body.bonusCredits

    if (plan !== undefined && plan !== "FREE" && plan !== "PRO") {
      return NextResponse.json({ error: "Plan must be FREE or PRO." }, { status: 400 })
    }
    if (
      bonusCredits !== undefined &&
      (!Number.isSafeInteger(bonusCredits) || bonusCredits < 1 || bonusCredits > 100_000)
    ) {
      return NextResponse.json({ error: "Bonus credits must be a whole number from 1 to 100,000." }, { status: 400 })
    }
    if (plan === undefined && bonusCredits === undefined) {
      return NextResponse.json({ error: "Choose a plan or enter bonus credits." }, { status: 400 })
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { not: "ADMIN" } },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(plan !== undefined ? { plan } : {}),
        ...(bonusCredits !== undefined ? { credits: { increment: bonusCredits } } : {}),
      },
      select: { id: true, name: true, email: true, plan: true, credits: true, createdAt: true },
    })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Admin user update failed:", error)
    return NextResponse.json({ error: "Could not update this user." }, { status: 400 })
  }
}
