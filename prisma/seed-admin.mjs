import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = "sachleen49@gmail.com"
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    throw new Error("Set ADMIN_PASSWORD in the environment before running npm run db:seed.")
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.")
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const legacyEmail = "admin@pitchpilot.in"
  const demotedLegacyAccounts = await prisma.$transaction(async (tx) => {
    const demoted = await tx.user.updateMany({
      where: { email: legacyEmail, role: "ADMIN" },
      data: { role: "USER" },
    })

    await tx.user.upsert({
      where: { email },
      update: { passwordHash, role: "ADMIN", plan: "PRO", credits: 100 },
      create: {
        email,
        name: "PitchPilot Admin",
        passwordHash,
        role: "ADMIN",
        plan: "PRO",
        credits: 100,
      },
    })

    return demoted.count
  })

  console.log(
    `Seeded admin account ${email} with 100 credits; demoted ${demotedLegacyAccounts} legacy admin account(s).`,
  )
}

main()
  .catch((error) => {
    console.error("Admin seed failed:", error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
