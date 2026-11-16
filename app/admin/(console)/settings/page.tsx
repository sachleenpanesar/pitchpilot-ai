import { prisma } from "@/lib/prisma"
import AdminDashboard from "../admin-dashboard"

const defaultSettings = {
  heroTitle: "PitchPilot AI - Stealth Interview Copilot",
  heroSubtitle: "Ace interviews and pitch calls with real-time AI prompts completely undetectable on screen share.",
  starterCredits: 50,
  weeklyPriceInr: 499,
  monthlyPriceInr: 1499,
  upiId: "",
  upiPayeeName: "",
}

export default async function AdminSiteSettingsPage() {
  let settings: typeof defaultSettings | null = null
  let loadWarning = ""
  try {
    settings = await prisma.siteSetting.findFirst({
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
    if (!settings) loadWarning = "No saved site settings were found. Safe defaults are shown; save to create the settings record."
  } catch (error: unknown) {
    console.error("[admin settings] site settings query failed:", error instanceof Error ? error.name : "UnknownError")
    loadWarning = "Could not load saved site settings. Safe defaults are shown; verify the values before saving."
  }

  return (
    <AdminDashboard
      section="settings"
      initialSettings={settings ?? defaultSettings}
      initialLoadWarning={loadWarning}
    />
  )
}
