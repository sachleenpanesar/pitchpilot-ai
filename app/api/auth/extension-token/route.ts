import { NextResponse } from "next/server"
import { getCurrentUser, signExtensionToken } from "@/lib/auth"

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin")
  if (!requestOrigin || requestOrigin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Request origin is not allowed." }, { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: "Sign in to create an extension token." }, { status: 401 })
  }

  try {
    const token = signExtensionToken(user)
    return NextResponse.json({ token, expiresIn: 3600 })
  } catch {
    return NextResponse.json({ error: "Could not create an extension token." }, { status: 503 })
  }
}
