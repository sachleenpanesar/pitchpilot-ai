import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

type AdminUser = {
  id: string
  name: string | null
  email: string
  plan: string
  credits: number
  proExpiresAt: Date | null
  createdAt: Date
}

export default async function AdminUsersPage() {
  let users: AdminUser[] = []
  let usersLoadFailed = false
  try {
    users = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
    })
  } catch (error: unknown) {
    console.error("[admin users] member list query failed:", error instanceof Error ? error.name : "UnknownError")
    users = []
    usersLoadFailed = true
  }

  return (
    <AdminDashboard
      section="users"
      initialUsers={users}
      initialUsersLoadFailed={usersLoadFailed}
      initialLoadWarning={usersLoadFailed ? "Could not load the member list. Displayed data may be incomplete." : ""}
    />
  )
}
