import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { refundCredits, reserveCredits } from "@/lib/credits"
import { prisma } from "@/lib/prisma"
import { getAICopilotResponse } from "@/lib/gemini"

type CopilotQueryBody = {
  question?: string
  imageBase64?: string
  audioBase64?: string
  mode?: string
}

export async function POST(req: Request) {
  let chargedUserId: string | null = null
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { question, imageBase64, audioBase64, mode } = (await req.json()) as CopilotQueryBody
    if (audioBase64 && audioBase64.length > 12_000_000) {
      return NextResponse.json({ error: "Captured audio is too large. Wait for a shorter pause and try again." }, { status: 413 })
    }

    const reservation = mode === "MOCK_INTERVIEW"
      ? null
      : await reserveCredits(user.userId, 1)
    if (reservation && !reservation.ok) {
      if (reservation.reason === "missing") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
      }
      return NextResponse.json({ error: "Insufficient credits" }, { status: 402 })
    }
    if (reservation?.ok && reservation.charged) {
      chargedUserId = user.userId
    }

    // Fetch user documents / vault context
    const documents = await prisma.document.findMany({
      where: { userId: user.userId }
    })

    const vaultContext = documents
      .map((d) => `[${d.docType}] ${d.title}: ${d.content}`)
      .join("\n\n")

    const aiResult = await getAICopilotResponse({
      question: question || "Help me answer the current interview question or pitch prompt.",
      imageBase64,
      audioBase64,
      vaultContext,
      mode
    })

    chargedUserId = null
    return NextResponse.json({
      success: true,
      data: aiResult,
      transcription: aiResult.recognizedQuestion || "",
    })
  } catch (error) {
    if (chargedUserId) {
      try {
        await refundCredits(chargedUserId, 1)
      } catch (refundError) {
        console.error("Copilot query credit refund failed:", refundError)
      }
    }
    console.error("Copilot Query API Error:", error)
    const message = error instanceof Error ? error.message : "Failed to get AI response"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
