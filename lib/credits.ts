import "server-only"

import { prisma } from "@/lib/prisma"

const MAX_CREDITS = 2_147_483_647

export type CreditReservation =
  | { ok: true; charged: boolean }
  | { ok: false; reason: "insufficient" | "missing" }

/**
 * Atomically reserves credits for a free-plan user. The plan is checked in the
 * conditional update as well, so a concurrent plan change cannot overspend.
 */
export async function reserveCredits(userId: string, amount: number): Promise<CreditReservation> {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Credit reservation amount must be a positive integer.")
  }
  const now = new Date()
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, proExpiresAt: true },
  })
  if (!user) return { ok: false, reason: "missing" }
  if (user.plan === "PRO" && user.proExpiresAt && user.proExpiresAt <= now) {
    await prisma.user.updateMany({
      where: { id: userId, plan: "PRO", proExpiresAt: { lte: now } },
      data: { plan: "FREE" },
    })
  }
  if (user.plan === "UNLIMITED" || (user.plan === "PRO" && (!user.proExpiresAt || user.proExpiresAt > now))) {
    return { ok: true, charged: false }
  }

  const reservation = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: {
        id: userId,
        credits: { gte: amount },
        OR: [
          { plan: { notIn: ["PRO", "UNLIMITED"] } },
          { plan: "PRO", proExpiresAt: { lte: now } },
        ],
      },
      data: { credits: { decrement: amount } },
    })
    if (updated.count !== 1) return updated
    await transaction.creditUsage.create({
      data: { userId, credits: amount, source: "AI" },
    })
    return updated
  })
  if (reservation.count === 1) return { ok: true, charged: true }

  // The account may have become entitled after the initial read.
  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, proExpiresAt: true },
  })
  if (!currentUser) return { ok: false, reason: "missing" }
  if (
    currentUser.plan === "UNLIMITED" ||
    (currentUser.plan === "PRO" && (!currentUser.proExpiresAt || currentUser.proExpiresAt > new Date()))
  ) return { ok: true, charged: false }
  return { ok: false, reason: "insufficient" }
}

export async function refundCredits(userId: string, amount: number): Promise<void> {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Credit refund amount must be a positive integer.")
  }
  const refund = await prisma.$transaction(async (transaction) => {
    const updated = await transaction.user.updateMany({
      where: { id: userId, credits: { lte: MAX_CREDITS - amount } },
      data: { credits: { increment: amount } },
    })
    if (updated.count === 1) {
      await transaction.creditUsage.create({
        data: { userId, credits: -amount, source: "AI_REFUND" },
      })
    }
    return updated
  })
  if (refund.count !== 1) {
    throw new Error("The reserved credits could not be refunded.")
  }
}
