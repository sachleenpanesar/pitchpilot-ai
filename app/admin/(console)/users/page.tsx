import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
  })

  return <AdminDashboard section="users" initialUsers={users} />
}
