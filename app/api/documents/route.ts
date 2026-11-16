import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/auth"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const docs = await prisma.document.findMany({
    where: { userId: user.userId },
    orderBy: { createdAt: "desc" }
  })
  return NextResponse.json(docs)
}

export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { title, docType, content } = await req.json()
    const doc = await prisma.document.create({
      data: {
        userId: user.userId,
        title: title || "Untitled Doc",
        docType: docType || "RESUME",
        content: content || ""
      }
    })
    return NextResponse.json(doc)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
