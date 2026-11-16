import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
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
  const status = (body as Record<string, unknown>).status
  if (status !== "OPEN" && status !== "RESOLVED") {
    return NextResponse.json({ error: "Status must be OPEN or RESOLVED." }, { status: 400 })
  }

  const { id } = await context.params
  try {
    const updated = await prisma.supportTicket.updateMany({
      where: { id },
      data: { status },
    })
    if (updated.count !== 1) {
      return NextResponse.json({ error: "Ticket not found." }, { status: 404 })
    }

    const ticket = await prisma.supportTicket.findUnique({ where: { id } })
    return NextResponse.json({ success: true, ticket })
  } catch (error) {
    console.error("Support ticket status update failed:", error)
    return NextResponse.json({ error: "Could not update ticket status." }, { status: 500 })
  }
}
