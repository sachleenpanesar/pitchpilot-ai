import bcrypt from "bcryptjs"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@pitchpilot.in").trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD

  if (!password) {
    throw new Error("Set ADMIN_PASSWORD in the environment before running npm run db:seed.")
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters.")
  }

  const passwordHash = await bcrypt.hash(password, 12)
  await prisma.user.upsert({
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

  console.log(`Seeded admin account ${email} with 100 credits.`)
}

main()
  .catch((error) => {
    console.error("Admin seed failed:", error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
