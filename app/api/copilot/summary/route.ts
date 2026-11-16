import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { generatePostSessionSummary } from "@/lib/gemini"

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { sessionId, transcript, roleOrTopic } = await req.json()
    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 })
    }

    const summaryData = await generatePostSessionSummary({
      transcript: transcript || "Mock interview session completed.",
      roleOrTopic: roleOrTopic || "Software Engineer"
    })

    const updatedSession = await prisma.session.update({
      where: { id: sessionId },
      data: {
        status: "COMPLETED",
        transcript: transcript,
        aiNotes: summaryData.aiNotes,
        scorecard: JSON.stringify(summaryData.scorecard),
        followUpEmail: summaryData.followUpEmail
      }
    })

    return NextResponse.json({ success: true, session: updatedSession, summary: summaryData })
  } catch (error: any) {
    console.error("Summary API Error:", error)
    return NextResponse.json({ error: error.message || "Failed to generate summary" }, { status: 500 })
  }
}
