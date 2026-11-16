import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyExtensionToken } from "@/lib/auth"

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/

function corsHeaders(origin: string) {
  return new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  })
}

function jsonResponse(request: Request, body: unknown, status = 200) {
  const headers = new Headers()
  headers.set("Cache-Control", "private, no-store")
  const origin = request.headers.get("origin")
  if (origin && EXTENSION_ORIGIN.test(origin)) {
    corsHeaders(origin).forEach((value, key) => headers.set(key, value))
  }
  return NextResponse.json(body, { status, headers })
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin")
  if (!origin || !EXTENSION_ORIGIN.test(origin)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization")
  const bearerMatch = authorization?.match(/^Bearer\s+([^\s]+)$/i)
  const user = bearerMatch ? verifyExtensionToken(bearerMatch[1], "extension:assistant") : null
  if (!user?.userId) {
    return jsonResponse(request, { error: "Unauthorized or expired extension token." }, 401)
  }

  try {
    const [account, documents] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.userId },
        select: { id: true, name: true, email: true, credits: true, plan: true },
      }),
      prisma.document.findMany({
        where: { userId: user.userId },
        select: { id: true, title: true, docType: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
    ])
    if (!account) {
      return jsonResponse(request, { error: "Account not found." }, 401)
    }

    return jsonResponse(request, { user: account, documents })
  } catch (error) {
    console.error("Extension context request failed", error)
    return jsonResponse(request, { error: "Could not load extension context." }, 500)
  }
}
