import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/admin-auth"
import { prisma } from "@/lib/prisma"

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  try {
    const { id } = await params
    const result = await prisma.promoCode.updateMany({
      where: { id },
      data: { isActive: false },
    })
    if (result.count !== 1) return NextResponse.json({ error: "Promo code not found." }, { status: 404 })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Admin promo-code deactivation failed:", error)
    return NextResponse.json({ error: "Could not deactivate this promo code." }, { status: 500 })
  }
}
