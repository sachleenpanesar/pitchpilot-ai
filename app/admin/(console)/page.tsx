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
  const [usersResult, settingsResult, totalUsersResult, proUsersResult] = await Promise.all([
    prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, email: true, plan: true, credits: true, proExpiresAt: true, createdAt: true },
    }).then((data) => ({ data, failed: false })).catch((error: unknown) => {
      console.error("[admin overview] member list query failed:", error instanceof Error ? error.name : "UnknownError")
      return { data: null, failed: true }
    }),
    prisma.siteSetting.findFirst()
      .then((data) => ({ data, failed: false }))
      .catch((error: unknown) => {
        console.error("[admin overview] site settings query failed:", error instanceof Error ? error.name : "UnknownError")
        return { data: null, failed: true }
      }),
    prisma.user.count({ where: { role: { not: "ADMIN" } } })
      .then((data) => ({ data, failed: false }))
      .catch((error: unknown) => {
        console.error("[admin overview] member count query failed:", error instanceof Error ? error.name : "UnknownError")
        return { data: null, failed: true }
      }),
    prisma.user.count({ where: { role: { not: "ADMIN" }, plan: "PRO" } })
      .then((data) => ({ data, failed: false }))
      .catch((error: unknown) => {
        console.error("[admin overview] Pro plan count query failed:", error instanceof Error ? error.name : "UnknownError")
        return { data: null, failed: true }
      }),
  ])

  const warnings = [
    usersResult.failed && "Could not load the member list.",
    settingsResult.failed && "Could not load saved site settings; safe defaults are shown.",
    totalUsersResult.failed && "Could not load the member count.",
    proUsersResult.failed && "Could not load the Pro plan count.",
    !settingsResult.failed && !settingsResult.data && "No saved site settings were found; safe defaults are shown.",
  ].filter((warning): warning is string => Boolean(warning))

  return (
    <AdminDashboard
      section="overview"
      initialUsers={usersResult.data ?? []}
      initialUsersLoadFailed={usersResult.failed}
      initialSettings={settingsResult.data ?? defaultSettings}
      totalUsers={totalUsersResult.data ?? undefined}
      proUsers={proUsersResult.data ?? undefined}
      initialLoadWarning={warnings.join(" ")}
    />
  )
}
