import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

export default async function AdminSupportInboxPage() {
  const settings = await prisma.siteSetting.findFirst({
    select: { upiId: true, upiPayeeName: true },
  })

  return <AdminDashboard section="support" initialSettings={settings ?? undefined} />
}
