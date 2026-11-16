import "server-only"

import { prisma } from "@/lib/prisma"

const UNLIMITED_PLANS = ["PRO", "UNLIMITED"]

export type CreditReservation =
  | { ok: true; charged: boolean }
  | { ok: false; reason: "insufficient" | "missing" }

/**
 * Atomically reserves credits for a free-plan user. The plan is checked in the
 * conditional update as well, so a concurrent plan change cannot overspend.
 */
export async function reserveCredits(userId: string, amount: number): Promise<CreditReservation> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!user) return { ok: false, reason: "missing" }
  if (UNLIMITED_PLANS.includes(user.plan)) return { ok: true, charged: false }

  const reservation = await prisma.user.updateMany({
    where: {
      id: userId,
      plan: { notIn: UNLIMITED_PLANS },
      credits: { gte: amount },
    },
    data: { credits: { decrement: amount } },
  })
  if (reservation.count === 1) return { ok: true, charged: true }

  // The account may have become PRO after the initial read.
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  })
  if (!currentUser) return { ok: false, reason: "missing" }
  if (UNLIMITED_PLANS.includes(currentUser.plan)) return { ok: true, charged: false }
  return { ok: false, reason: "insufficient" }
}

export async function refundCredits(userId: string, amount: number): Promise<void> {
  const refund = await prisma.user.updateMany({
    where: { id: userId },
    data: { credits: { increment: amount } },
  })
  if (refund.count !== 1) {
    throw new Error("The reserved credits could not be refunded.")
  }
}
