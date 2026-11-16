import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function getSupportCustomer() {
  const session = await getCurrentUser()
  if (!session) return null

  // Do not trust a stale role claim in the customer session.
  return prisma.user.findFirst({
    where: { id: session.userId, role: "USER" },
    select: { id: true, name: true, email: true },
  })
}
