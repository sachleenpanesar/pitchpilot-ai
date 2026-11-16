import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import ResumeMaker from "./resume-maker"

export default async function ResumeMakerPage() {
  const session = await getCurrentUser()
  if (!session) redirect("/login")

  const [user, resumes] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.userId }, select: { credits: true } }),
    prisma.document.findMany({
      where: { userId: session.userId, docType: "RESUME" },
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, content: true },
    }),
  ])
  if (!user) redirect("/login")

  return <ResumeMaker initialResumes={resumes} initialCredits={user.credits} />
}
