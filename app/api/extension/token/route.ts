import { NextResponse } from "next/server"
import { getCurrentExtensionUser, getCurrentUser, signExtensionToken } from "@/lib/auth"

const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/
const TOKEN_LIFETIME_SECONDS = 30 * 24 * 60 * 60

function isAllowedOrigin(origin: string, requestUrl: string) {
  return origin === new URL(requestUrl).origin || EXTENSION_ORIGIN.test(origin)
}

function responseHeaders(origin: string) {
  const headers = new Headers({
    "Cache-Control": "private, no-store",
    Vary: "Origin",
  })
  if (EXTENSION_ORIGIN.test(origin)) {
    headers.set("Access-Control-Allow-Origin", origin)
    headers.set("Access-Control-Allow-Credentials", "true")
    headers.set("Access-Control-Allow-Methods", "POST, OPTIONS")
    headers.set("Access-Control-Allow-Headers", "Content-Type")
    headers.set("Access-Control-Max-Age", "600")
  }
  return headers
}

export async function OPTIONS(request: Request) {
  const origin = request.headers.get("origin") || ""
  if (!isAllowedOrigin(origin, request.url)) {
    return new Response(null, { status: 403 })
  }
  return new Response(null, {
    status: 204,
    headers: responseHeaders(origin),
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin") || ""
  if (!isAllowedOrigin(origin, request.url)) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }

  const headers = responseHeaders(origin)
  let user
  try {
    user = EXTENSION_ORIGIN.test(origin)
      ? await getCurrentExtensionUser()
      : await getCurrentUser()
  } catch (error) {
    console.error("Extension token authentication failed:", error)
    return NextResponse.json(
      { error: "Could not authenticate this account. Please sign in again and retry." },
      { status: 503, headers },
    )
  }
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to PitchPilot in this Chrome profile before connecting the extension." },
      { status: 401, headers },
    )
  }

  try {
    const token = signExtensionToken(user)
    return NextResponse.json(
      { token, expiresIn: TOKEN_LIFETIME_SECONDS },
      { headers },
    )
  } catch (error) {
    console.error("Extension token signing failed:", error)
    return NextResponse.json(
      { error: "Could not create an extension token. Check the server authentication configuration." },
      { status: 503, headers },
    )
  }
}
