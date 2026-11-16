import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

const MAX_MESSAGE_LENGTH = 10_000

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  const value = (body as Record<string, unknown>).message
  const message = typeof value === "string" ? value.trim() : ""
  if (!message || message.length > MAX_MESSAGE_LENGTH) {
    return NextResponse.json(
      { error: "Message must contain 1–10,000 characters." },
      { status: 400 },
    )
  }

  const { id } = await context.params
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.supportTicket.findUnique({
        where: { id },
        select: { id: true },
      })
      if (!ticket) return null

      await transaction.supportMessage.updateMany({
        where: { ticketId: id, senderRole: "USER", isRead: false },
        data: { isRead: true },
      })
      const createdMessage = await transaction.supportMessage.create({
        data: { ticketId: id, senderRole: "ADMIN", message },
      })
      await transaction.supportTicket.update({
        where: { id },
        data: { status: "OPEN" },
      })
      return createdMessage
    })

    if (!result) return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
    return NextResponse.json({ success: true, message: result }, { status: 201 })
  } catch (error) {
    console.error("Admin support reply failed:", error)
    return NextResponse.json({ error: "Could not send the reply." }, { status: 500 })
  }
}
