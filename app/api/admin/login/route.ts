import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signAdminToken } from "@/lib/auth"
import { isAdminAccount } from "@/lib/admin-auth"

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
  const password = typeof body.password === "string" ? body.password : ""
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true, isAdmin: true, plan: true },
    })
    if (
      !user ||
      !isAdminAccount(user) ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 })
    }

    const token = signAdminToken({
      userId: user.id,
      email: user.email,
      role: "ADMIN",
      plan: user.plan,
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
