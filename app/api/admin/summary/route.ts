import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const [revenue, usage] = await Promise.all([
      prisma.paymentRequest.aggregate({
        where: { status: "APPROVED" },
        _sum: { amountInr: true },
      }),
      prisma.creditUsage.aggregate({ _sum: { credits: true } }),
    ])
    return NextResponse.json({
      approvedRevenueInr: revenue._sum.amountInr ?? 0,
      aiCreditsUsed: Math.max(0, usage._sum.credits ?? 0),
    })
  } catch (error) {
    console.error("Admin summary load failed:", error)
    return NextResponse.json({ error: "Could not load the admin summary." }, { status: 500 })
  }
}
