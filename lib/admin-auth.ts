import "server-only"

import { verifyAdminToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

const DEFAULT_ADMIN_EMAILS = ["sachleen49@gmail.com", "sachleen.98@gmail.com"]

export function isConfiguredAdminEmail(email: string): boolean {
  const configuredEmails = process.env.ADMIN_EMAILS
    ?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
  const allowedEmails = configuredEmails?.length ? configuredEmails : DEFAULT_ADMIN_EMAILS

  return allowedEmails.includes(email.trim().toLowerCase())
}

export function isAdminAccount(user: { email: string; isAdmin: boolean }): boolean {
  return user.isAdmin === true && isConfiguredAdminEmail(user.email)
}

export async function getAdminUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value
    if (!token) return null

    const session = verifyAdminToken(token)
    if (!session) return null

    // The JWT is only an identity hint; current DB state and the email allowlist decide access.
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { id: true, email: true, isAdmin: true },
    })

    return user && isAdminAccount(user) ? user : null
  } catch (error) {
    console.error("Admin authorization check failed.", error instanceof Error ? error.name : "UnknownError")
    return null
  }
}
