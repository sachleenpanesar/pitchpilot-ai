import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"
import { signToken } from "@/lib/auth"
import { cookies } from "next/headers"

export async function POST(req: Request) {
  try {
    const { name, email, password } = await req.json()
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

    return NextResponse.json({ success: true, user: { id: user.id, email: user.email, name: user.name, credits: user.credits, plan: user.plan } })
  } catch (error: unknown) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Registration failed" },
      { status: 500 },
    )
  }
}
