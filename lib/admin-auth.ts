import "server-only"

import { verifyAdminToken } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { cookies } from "next/headers"

export async function getAdminUser() {
  const cookieStore = await cookies()
  const token = cookieStore.get("admin_token")?.value
  if (!token) return null

  const session = verifyAdminToken(token)
  if (!session) return null

  // Read the role from the database, not the potentially stale JWT claim.
  return prisma.user.findFirst({
    where: { id: session.userId, role: "ADMIN" },
    select: { id: true, email: true, role: true },
  })
}
