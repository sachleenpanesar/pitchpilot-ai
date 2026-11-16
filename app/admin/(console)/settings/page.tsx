import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

export default async function AdminSiteSettingsPage() {
  const settings = await prisma.siteSetting.findFirst({
    select: {
      heroTitle: true,
      heroSubtitle: true,
      starterCredits: true,
      weeklyPriceInr: true,
      monthlyPriceInr: true,
      upiId: true,
      upiPayeeName: true,
    },
  })

  return <AdminDashboard section="settings" initialSettings={settings ?? undefined} />
}
