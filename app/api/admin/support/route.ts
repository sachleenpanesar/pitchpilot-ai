import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function GET() {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  try {
    await prisma.supportMessage.updateMany({
      where: { senderRole: "USER", isRead: false },
      data: { isRead: true },
    })
    const tickets = await prisma.supportTicket.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      },
    })
    return NextResponse.json({ tickets })
  } catch (error) {
    console.error("Admin support ticket listing failed:", error)
    return NextResponse.json({ error: "Could not load support tickets." }, { status: 500 })
  }
}
