import { NextResponse } from "next/server"
import { getCurrentUser, verifyExtensionToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { refundCredits, reserveCredits } from "@/lib/credits"
import { getAICopilotResponse } from "@/lib/gemini"

type AnswerRequest = {
  question?: unknown
  imageBase64?: unknown
  mode?: unknown
  sessionId?: unknown
  contextText?: unknown
  documentIds?: unknown
}

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

function extensionCorsHeaders(origin: string) {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  })
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  const headers = new Headers()
  const origin = request.headers.get("origin")
  if (origin && EXTENSION_ORIGIN.test(origin)) {
    extensionCorsHeaders(origin).forEach((value, key) => headers.set(key, value))
  }
  return NextResponse.json(body, { status, headers })
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || !EXTENSION_ORIGIN.test(origin)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, { status: 204, headers: extensionCorsHeaders(origin) })
}

export async function POST(request: Request) {
  const authorization = request.headers.get("authorization")
  const bearerMatch = authorization?.match(/^Bearer\s+([^\s]+)$/i)
  if (authorization && !bearerMatch) {
    return jsonResponse(request, { error: "A valid bearer token is required." }, 401)
  }

  const user = bearerMatch
    ? verifyExtensionToken(bearerMatch[1])
    : await getCurrentUser()
  if (!user?.userId) {
    return jsonResponse(request, { error: "Unauthorized or expired extension token." }, 401)
  }

  const contentLength = Number(request.headers.get("content-length") || 0)
  if (contentLength > 12_000_000) {
    return jsonResponse(request, { error: "The screenshot or prompt is too large." }, 413)
  }

  let body: AnswerRequest
  try {
    body = (await request.json()) as AnswerRequest
  } catch {
    return jsonResponse(request, { error: "Send a valid JSON request." }, 400)
  }

  const question = typeof body.question === "string" ? body.question.trim() : ""
  const imageBase64 = typeof body.imageBase64 === "string" ? body.imageBase64 : undefined
  const mode = typeof body.mode === "string" ? body.mode.slice(0, 40) : "COPILOT"
  const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : ""
  const contextText = typeof body.contextText === "string" ? body.contextText.trim() : ""
  if (body.contextText !== undefined && (typeof body.contextText !== "string" || contextText.length > 30_000)) {
    return jsonResponse(request, { error: "Session context must be text under 30,000 characters." }, 400)
  }
  let documentIds: string[] | undefined
  if (body.documentIds !== undefined) {
    if (
      !Array.isArray(body.documentIds) ||
      body.documentIds.length > 30 ||
      body.documentIds.some((id) => typeof id !== "string" || id.length > 128)
    ) {
      return jsonResponse(request, { error: "Choose up to 30 valid saved documents." }, 400)
    }
    documentIds = [...new Set(body.documentIds as string[])]
  }
  if (!question || question.length > 12_000) {
    return jsonResponse(request, { error: "Enter a question under 12,000 characters." }, 400)
  }
  if (imageBase64 && (imageBase64.length > 10_000_000 || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(imageBase64))) {
    return jsonResponse(request, { error: "The screenshot must be a supported image under 10 MB." }, 400)
  }
  if (sessionId.length > 128) {
    return jsonResponse(request, { error: "Session IDs must be 128 characters or fewer." }, 400)
  }

  let sessionContext = ""
  if (sessionId) {
    try {
      const session = await prisma.session.findFirst({
        where: { id: sessionId, userId: user.userId },
        select: {
          title: true,
          companyOrClient: true,
          mode: true,
          language: true,
          transcript: true,
        },
      })
      if (!session) {
        return jsonResponse(request, { error: "Session was not found or is not accessible." }, 404)
      }
      sessionContext = [
        `Owned session: ${session.title}`,
        `Company or client: ${session.companyOrClient}`,
        `Session mode: ${session.mode}`,
        `Session language: ${session.language}`,
        session.transcript ? `Recent session transcript:\n${session.transcript.slice(-6000)}` : "",
      ].filter(Boolean).join("\n")
    } catch {
      return jsonResponse(request, { error: "Could not load the requested session." }, 502)
    }
  }

  let documents
  try {
    documents = await prisma.document.findMany({
      where: {
        userId: user.userId,
        ...(documentIds === undefined ? {} : { id: { in: documentIds } }),
      },
    })
    if (documentIds !== undefined && documents.length !== documentIds.length) {
      return jsonResponse(request, { error: "One or more selected documents are not accessible." }, 404)
    }
  } catch {
    return jsonResponse(request, { error: "Could not load the selected documents." }, 502)
  }

  const reservation = await reserveCredits(user.userId, 1)
  if (!reservation.ok) {
    if (reservation.reason === "missing") {
      return jsonResponse(request, { error: "Unauthorized or expired extension token." }, 401)
    }
    return jsonResponse(request, { error: "Insufficient credits" }, 402)
  }

  try {
    const vaultContext = [
      ...documents.map((document) => `[${document.docType}] ${document.title}: ${document.content}`),
      contextText ? `Session context:\n${contextText}` : "",
      sessionContext,
    ].filter(Boolean).join("\n\n")

    const data = await getAICopilotResponse({
      question,
      imageBase64,
      vaultContext,
      mode,
    })
    return jsonResponse(request, { success: true, data })
  } catch {
    if (reservation.charged) {
      try {
        await refundCredits(user.userId, 1)
      } catch (refundError) {
        console.error("Copilot credit refund failed:", refundError)
      }
    }
    return jsonResponse(request, { error: "Could not generate an answer. Check server configuration and try again." }, 502)
  }
}
