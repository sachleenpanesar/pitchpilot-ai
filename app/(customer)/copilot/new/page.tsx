import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"

export default async function NewCopilotSessionPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>
}) {
  const auth = await getCurrentUser()
  if (!auth) redirect("/login")

  const { mode: requestedMode } = await searchParams
  const mode = requestedMode === "MOCK_INTERVIEW" ? "MOCK_INTERVIEW" : "LIVE_COPILOT"

  const session = await prisma.session.create({
    data: {
      userId: auth.userId,
      title: mode === "MOCK_INTERVIEW" ? "Mock Interview Practice" : "Live Interview Copilot Session",
      companyOrClient: "Target Company",
      mode,
      status: "ACTIVE"
    }
  })

  redirect(`/copilot/${session.id}`)
}
