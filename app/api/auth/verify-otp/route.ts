import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid JSON request body is required" }, { status: 400 })
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const code = typeof body.code === "string" ? body.code : ""

    if (!email || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { error: "A valid email and six-digit code are required" },
        { status: 400 },
      )
    }

    const now = new Date()
    const consumed = await prisma.user.updateMany({
      where: {
        email,
        otpCode: code,
        otpExpiresAt: { gt: now },
      },
      data: { otpCode: null, otpExpiresAt: null },
    })

    if (consumed.count !== 1) {
      return NextResponse.json(
        { error: "The login code is invalid or expired" },
        { status: 401 },
      )
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "The login code is invalid or expired" }, { status: 401 })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan,
    })

    const cookieStore = await cookies()
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        credits: user.credits,
        plan: user.plan,
      },
    })
  } catch (error: unknown) {
    console.error("OTP verification failed", error)
    return NextResponse.json(
      { error: "Unable to verify the login code. Please try again later." },
      { status: 500 },
    )
  }
}
