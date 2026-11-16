import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    const payments = await prisma.paymentRequest.findMany({
      where: { status: "PENDING" },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        userId: true,
        planOrPack: true,
        amountInr: true,
        utrNumber: true,
        status: true,
        createdAt: true,
        user: { select: { email: true, name: true } },
      },
    })
    return NextResponse.json({ payments })
  } catch (error) {
    console.error("UPI payment queue load failed:", error)
    return NextResponse.json({ error: "Could not load pending payments." }, { status: 500 })
  }
}
