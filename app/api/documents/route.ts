import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser, verifyExtensionToken } from "@/lib/auth"

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

function corsHeaders(origin: string) {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  })
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  const headers = new Headers({ "Cache-Control": "private, no-store" })
  const origin = request.headers.get("origin")
  if (origin && EXTENSION_ORIGIN.test(origin)) {
    corsHeaders(origin).forEach((value, key) => headers.set(key, value))
  }
  return NextResponse.json(body, { status, headers })
}

async function getRequestUser(request: Request) {
  const authorization = request.headers.get("authorization")
  if (authorization) {
    const bearerMatch = authorization.match(/^Bearer\s+([^\s]+)$/i)
    return bearerMatch ? verifyExtensionToken(bearerMatch[1], "extension:assistant") : null
  }
  return getCurrentUser()
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || !EXTENSION_ORIGIN.test(origin)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const docs = await prisma.document.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  })
  return NextResponse.json(docs)
}

export async function POST(req: Request) {
  const user = await getRequestUser(req)
  if (!user) return jsonResponse(req, { error: "Unauthorized" }, 401)

  try {
    const body: unknown = await req.json()
    if (!body || typeof body !== "object") {
      return jsonResponse(req, { error: "Invalid document data." }, 400)
    }

    const { title, docType, content } = body as {
      title?: unknown
      docType?: unknown
      content?: unknown
    }
    const isExtensionRequest = Boolean(req.headers.get("authorization"))
    const normalizedDocType = typeof docType === "string" ? docType.trim() : "RESUME"
    if (
      typeof content !== "string" ||
      (isExtensionRequest && (
        !content.trim() ||
        content.length > 250_000 ||
        normalizedDocType !== "RESUME"
      ))
    ) {
      return jsonResponse(req, { error: "Resume text is empty, too large, or has an invalid document type." }, 400)
    }

    const doc = await prisma.document.create({
      data: {
        userId: user.userId,
        title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : "Untitled Doc",
        docType: normalizedDocType || "RESUME",
        content,
      },
    })
    return jsonResponse(req, doc)
  } catch (error) {
    console.error("Document upload failed", error)
    return jsonResponse(req, { error: "Could not save this document." }, 500)
  }
}
