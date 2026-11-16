import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"
import { refundCredits, reserveCredits } from "@/lib/credits"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const sessions = await prisma.session.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  })
  return NextResponse.json(sessions)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  let parsedBody: unknown
  try {
    parsedBody = await req.json()
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }
  if (!parsedBody || typeof parsedBody !== "object" || Array.isArray(parsedBody)) {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 })
  }

  const body = parsedBody as Record<string, unknown>
  const { title, companyOrClient, mode, language } = body
  const sessionMode = mode === undefined ? "LIVE_COPILOT" : mode
  if (
    (title !== undefined && (typeof title !== "string" || title.length > 200)) ||
    (companyOrClient !== undefined && (typeof companyOrClient !== "string" || companyOrClient.length > 200)) ||
    (language !== undefined && (typeof language !== "string" || language.length > 80)) ||
    (sessionMode !== "MOCK_INTERVIEW" && sessionMode !== "LIVE_COPILOT")
  ) {
    return NextResponse.json({ error: "Session details are invalid." }, { status: 400 })
  }

  const reservation = sessionMode === "MOCK_INTERVIEW"
    ? await reserveCredits(user.userId, 2)
    : null
  if (reservation && !reservation.ok) {
    if (reservation.reason === "missing") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
  }

  try {
    const session = await prisma.session.create({
      data: {
        userId: user.userId,
        title: title || "Interview / Pitch Session",
        companyOrClient: companyOrClient || "General",
        mode: sessionMode,
        language: language || "English",
        status: "ACTIVE"
      }
    })
    return NextResponse.json(session)
  } catch {
    if (reservation?.ok && reservation.charged) {
      try {
        await refundCredits(user.userId, 2)
      } catch (refundError) {
        console.error("Mock interview credit refund failed:", refundError)
      }
    }
    return NextResponse.json({ error: "Could not create session." }, { status: 500 })
  }
}
