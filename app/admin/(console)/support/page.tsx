import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

export default async function AdminSupportInboxPage() {
  let settings: { upiId: string; upiPayeeName: string } | null = null
  let loadWarning = ""
  try {
    settings = await prisma.siteSetting.findFirst({
      select: { upiId: true, upiPayeeName: true },
    })
    if (!settings) loadWarning = "No saved payment settings were found; payment details are unavailable."
  } catch (error: unknown) {
    console.error("[admin support] payment settings query failed:", error instanceof Error ? error.name : "UnknownError")
    loadWarning = "Could not load payment settings; payment details may be unavailable."
  }

  return (
    <AdminDashboard
      section="support"
      initialSettings={settings ?? { upiId: "", upiPayeeName: "" }}
      initialLoadWarning={loadWarning}
    />
  )
}
