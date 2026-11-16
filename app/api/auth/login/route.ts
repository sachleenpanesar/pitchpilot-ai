import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { randomInt } from "node:crypto"
import { sendLoginOtpEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid JSON request body is required" }, { status: 400 })
    }
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
    }

    const otpCode = randomInt(0, 1_000_000).toString().padStart(6, "0")
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode, otpExpiresAt },
    })

    try {
      await sendLoginOtpEmail(user.email, otpCode)
    } catch (error: unknown) {
      try {
        await prisma.user.updateMany({
          where: { id: user.id, otpCode },
          data: { otpCode: null, otpExpiresAt: null },
        })
      } catch (cleanupError: unknown) {
        console.error("Failed to clear undelivered login OTP", {
          userId: user.id,
          error: cleanupError instanceof Error ? cleanupError.message : "Unknown database error",
        })
      }
      console.error("Login OTP email delivery failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown email provider error",
      })
      return NextResponse.json(
        { error: "Unable to deliver the login code. Please try again later." },
        { status: 503 },
      )
    }

    return NextResponse.json({ requiresOtp: true, email: user.email })
  } catch (error: unknown) {
    console.error("Login request failed", error)
    return NextResponse.json({ error: "Login failed. Please try again later." }, { status: 500 })
  }
}
