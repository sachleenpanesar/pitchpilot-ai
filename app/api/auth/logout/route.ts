import { NextResponse } from "next/server"
import { cookies } from "next/headers"

async function clearAuthCookie() {
  const cookieStore = await cookies()
  cookieStore.set("auth_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
  cookieStore.set("extension_auth_token", "", {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 0,
  })
}

export async function GET(request: Request) {
  await clearAuthCookie()
  return NextResponse.redirect(new URL("/login", request.url))
}

export async function POST(request: Request) {
  await clearAuthCookie()
  return NextResponse.redirect(new URL("/login", request.url), 303)
}
