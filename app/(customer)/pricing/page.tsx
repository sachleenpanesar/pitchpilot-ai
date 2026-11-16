import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import PricingOptions from "./pricing-options"

export const dynamic = "force-dynamic"

export default async function PricingPage() {
  const session = await getCurrentUser()
  const [settings, user] = await Promise.all([
    prisma.siteSetting.findFirst({
      select: {
        weeklyPriceInr: true,
        monthlyPriceInr: true,
        upiId: true,
        upiPayeeName: true,
      },
    }),
    session
      ? prisma.user.findUnique({
          where: { id: session.userId },
          select: { plan: true, credits: true },
        })
      : Promise.resolve(null),
  ])

  return (
    <PricingOptions
      weeklyPriceInr={settings?.weeklyPriceInr ?? null}
      monthlyPriceInr={settings?.monthlyPriceInr ?? null}
      upiId={settings?.upiId ?? ""}
      upiPayeeName={settings?.upiPayeeName ?? ""}
      currentPlan={user?.plan ?? null}
      currentCredits={user?.credits ?? null}
    />
  )
}
