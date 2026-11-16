import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { signToken } from "@/lib/auth"
import { cookies } from "next/headers"
import { sendWelcomeEmail } from "@/lib/email"

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid JSON request body is required" }, { status: 400 })
    }
    const name = typeof body.name === "string" ? body.name : "PitchPilot User"
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const password = typeof body.password === "string" ? body.password : ""
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 })
    }

    const existingUser = await prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    
    // Check site settings for starter credits
    const setting = await prisma.siteSetting.findFirst()
    const starterCredits = setting?.starterCredits ?? 50

    const user = await prisma.user.create({
      data: {
        name: name || "PitchPilot User",
        email,
        passwordHash,
        credits: starterCredits,
        plan: "FREE"
      }
    })

    let emailDeliveryFailed = false
    try {
      await sendWelcomeEmail(user.email, user.name || "PitchPilot User")
    } catch (error: unknown) {
      emailDeliveryFailed = true
      console.error("Welcome email delivery failed", {
        userId: user.id,
        error: error instanceof Error ? error.message : "Unknown email provider error",
      })
    }

    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      plan: user.plan
    })

    const cookieStore = await cookies()
    cookieStore.set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7 // 7 days
    })
    cookieStore.set("extension_auth_token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    })

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name, credits: user.credits, plan: user.plan },
      ...(emailDeliveryFailed
        ? { emailDelivery: { status: "failed", message: "Your account was created, but the welcome email could not be delivered." } }
        : {}),
    })
  } catch (error: unknown) {
    console.error("Registration request failed", error)
    return NextResponse.json({ error: "Registration failed. Please try again later." }, { status: 500 })
  }
}
