import { NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const { title, docType, content } = await request.json()

    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc || doc.userId !== user.userId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const updated = await prisma.document.update({
      where: { id },
      data: {
        title: title !== undefined ? title : doc.title,
        docType: docType !== undefined ? docType : doc.docType,
        content: content !== undefined ? content : doc.content,
      },
    })

    return NextResponse.json({ document: updated })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const doc = await prisma.document.findUnique({ where: { id } })
    if (!doc || doc.userId !== user.userId) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    await prisma.document.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
