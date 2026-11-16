import { NextResponse } from "next/server"
import { timingSafeEqual } from "node:crypto"
import bcrypt from "bcryptjs"
import { signAdminToken } from "@/lib/auth"

function matchesPlaintextPassword(submitted: string, expected: string): boolean {
  const submittedBytes = Buffer.from(submitted)
  const expectedBytes = Buffer.from(expected)
  return submittedBytes.length === expectedBytes.length && timingSafeEqual(submittedBytes, expectedBytes)
}

export async function POST(request: Request) {
  let credentials: unknown
  try {
    credentials = await request.json()
  } catch {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  if (!credentials || typeof credentials !== "object") {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const body = credentials as Record<string, unknown>
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const password = typeof body.password === "string" ? body.password.trim() : ""
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD?.trim()
  if (!adminEmail || !adminPassword) {
    return NextResponse.json({ error: "Admin login is not configured" }, { status: 503 })
  }
  if (email !== adminEmail) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
  }

  try {
    const validPassword = adminPassword.startsWith("$2")
      ? await bcrypt.compare(password, adminPassword)
      : matchesPlaintextPassword(password, adminPassword)
    if (!validPassword) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = signAdminToken({
      userId: `env-admin:${adminEmail}`,
      email: adminEmail,
      role: "ADMIN",
      plan: "PRO",
    })
    const response = NextResponse.json({ success: true })
    response.cookies.set("admin_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    })
    return response
  } catch (error) {
    console.error("Admin login failed.", error instanceof Error ? error.name : "UnknownError")
    return NextResponse.json({ error: "Admin sign-in is temporarily unavailable" }, { status: 503 })
  }
}
