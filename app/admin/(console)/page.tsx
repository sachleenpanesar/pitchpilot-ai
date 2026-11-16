import { prisma } from "@/lib/prisma"
import AdminDashboard from "./admin-dashboard"

const defaultSettings = {
  heroTitle: "PitchPilot AI - Stealth Interview Copilot",
  heroSubtitle: "Ace interviews and pitch calls with real-time AI prompts completely undetectable on screen share.",
  starterCredits: 50,
  weeklyPriceInr: 499,
  monthlyPriceInr: 1499,
  upiId: "",
  upiPayeeName: "",
}

export default async function AdminPage() {
  const [users, settings, totalUsers, proUsers] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
    }),
    prisma.siteSetting.findFirst(),
    prisma.user.count({ where: { role: { not: "ADMIN" } } }),
    prisma.user.count({ where: { role: { not: "ADMIN" }, plan: "PRO" } }),
  ])

  return <AdminDashboard initialUsers={users} initialSettings={settings ?? defaultSettings} totalUsers={totalUsers} proUsers={proUsers} />
}
