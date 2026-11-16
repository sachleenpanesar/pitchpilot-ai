import { Prisma } from "@prisma/client"
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
    const extendProDays = body.extendProDays

    if (
      extendProDays !== undefined &&
      (extendProDays !== 7 && extendProDays !== 30 || plan !== undefined || bonusCredits !== undefined)
    ) {
      return NextResponse.json({ error: "extendProDays must be 7 or 30 and cannot be combined with other changes." }, { status: 400 })
    }

    if (plan !== undefined && plan !== "FREE" && plan !== "PRO") {
      return NextResponse.json({ error: "Plan must be FREE or PRO." }, { status: 400 })
    }
    if (
      bonusCredits !== undefined &&
      (!Number.isSafeInteger(bonusCredits) || bonusCredits < 1 || bonusCredits > 100_000)
    ) {
      return NextResponse.json({ error: "Bonus credits must be a whole number from 1 to 100,000." }, { status: 400 })
    }
    if (plan === undefined && bonusCredits === undefined && extendProDays === undefined) {
      return NextResponse.json({ error: "Choose a plan or enter bonus credits." }, { status: 400 })
    }

    const target = await prisma.user.findFirst({
      where: { id, role: { not: "ADMIN" } },
      select: { id: true },
    })
    if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 })

    const user = extendProDays !== undefined
      ? await prisma.$transaction(async (transaction) => {
          const current = await transaction.user.findUnique({
            where: { id },
            select: { proExpiresAt: true },
          })
          if (!current) throw new Error("USER_NOT_FOUND")
          const now = new Date()
          const expiryBase = current.proExpiresAt && current.proExpiresAt > now ? current.proExpiresAt : now
          return transaction.user.update({
            where: { id },
            data: {
              plan: "PRO",
              proExpiresAt: new Date(expiryBase.getTime() + extendProDays * 24 * 60 * 60 * 1000),
            },
            select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
          })
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
      : await prisma.user.update({
          where: { id },
          data: {
            ...(plan !== undefined ? { plan, ...(plan === "FREE" ? { proExpiresAt: null } : {}) } : {}),
            ...(bonusCredits !== undefined ? { credits: { increment: bonusCredits } } : {}),
          },
          select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
        })
    return NextResponse.json({ user })
  } catch (error) {
    console.error("Admin user update failed:", error)
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
      return NextResponse.json({ error: "This user was updated concurrently. Please retry the Pro extension." }, { status: 409 })
    }
    return NextResponse.json({ error: "Could not update this user." }, { status: 400 })
  }
}
