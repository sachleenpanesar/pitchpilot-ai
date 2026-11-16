import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { FileText, Plus, ArrowLeft, Shield } from "lucide-react"

export default async function DocumentsPage() {
  const auth = await getCurrentUser()
  if (!auth) redirect("/login")

  const documents = await prisma.document.findMany({
    where: { userId: auth.userId },
    orderBy: { createdAt: "desc" }
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link href="/dashboard" className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-white">Career Vault & STAR Stories</h1>
          <p className="text-zinc-400 text-sm mt-1">Store your resumes, behavioral STAR stories, and pitch playbooks for instant AI recall.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {documents.map((doc) => (
          <div key={doc.id} className="bg-zinc-900/60 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs bg-indigo-950/80 text-indigo-300 border border-indigo-800/50 px-2.5 py-1 rounded-md font-medium">
                  {doc.docType}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {new Date(doc.createdAt).toLocaleDateString()}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{doc.title}</h3>
              <p className="text-zinc-400 text-sm line-clamp-3 leading-relaxed bg-zinc-950/40 p-3 rounded-xl border border-zinc-800/50 font-mono text-xs">
                {doc.content}
              </p>
            </div>
          </div>
        ))}

        {documents.length === 0 && (
          <div className="col-span-3 text-center py-16 text-zinc-500 border border-dashed border-zinc-800 rounded-3xl">
            <FileText className="w-12 h-12 mx-auto text-zinc-600 mb-3" />
            <p className="text-sm">No documents in your vault yet.</p>
          </div>
        )}
      </div>
    </div>
  )
}
