import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, plan: true, proExpiresAt: true, credits: true, createdAt: true },
  })
  return NextResponse.json({ users })
}
