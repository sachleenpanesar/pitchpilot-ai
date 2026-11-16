import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { sendSupportTicketAlert } from "@/lib/email"
import { getSupportCustomer } from "@/app/api/support/customer-auth"

const MAX_SUBJECT_LENGTH = 200
const MAX_MESSAGE_LENGTH = 10_000

function readText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null
  const text = value.trim()
  return text.length > 0 && text.length <= maxLength ? text : null
}

export async function GET() {
  const customer = await getSupportCustomer()
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  await prisma.supportMessage.updateMany({
    where: {
      senderRole: "ADMIN",
      isRead: false,
      ticket: { userId: customer.id },
    },
    data: { isRead: true },
  })

  const tickets = await prisma.supportTicket.findMany({
    where: { userId: customer.id },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    include: {
      messages: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  })

  return NextResponse.json({ tickets })
}

export async function POST(request: Request) {
  const customer = await getSupportCustomer()
  if (!customer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const subject = readText(input.subject, MAX_SUBJECT_LENGTH)
  const message = readText(input.message, MAX_MESSAGE_LENGTH)
  if (!subject || !message) {
    return NextResponse.json(
      { error: "Subject (1–200 characters) and message (1–10,000 characters) are required." },
      { status: 400 },
    )
  }

  try {
    const ticket = await prisma.supportTicket.create({
      data: {
        userId: customer.id,
        subject,
        messages: {
          create: { senderRole: "USER", message },
        },
      },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    })

    try {
      await sendSupportTicketAlert({
        ticketId: ticket.id,
        customerName: customer.name,
        customerEmail: customer.email,
        subject,
        message,
      })
    } catch (error) {
      console.error("Support ticket alert email failed:", error)
    }

    return NextResponse.json({ success: true, ticket }, { status: 201 })
  } catch (error) {
    console.error("Support ticket creation failed:", error)
    return NextResponse.json({ error: "Could not create the support ticket." }, { status: 500 })
  }
}
