import { getCurrentUser } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import { Video, Shield, FileText, ArrowRight, MessageSquare, CheckCircle, Sparkles, Coins } from "lucide-react"
import PromoCodeBox from "@/components/promo-code-box"

export default async function DashboardPage() {
  const auth = await getCurrentUser()
  if (!auth) redirect("/login")

  const user = await prisma.user.findUnique({
    where: { id: auth.userId },
    include: { sessions: { orderBy: { createdAt: "desc" } }, documents: true }
  })

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-indigo-950/80 via-zinc-900 to-zinc-900 border border-indigo-500/20 rounded-3xl p-8 mb-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-indigo-400 mb-2">
            <Shield className="w-4 h-4" /> Stealth Interview Hub Active
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back, {user?.name || user?.email}</h1>
          <p className="text-zinc-400 text-sm">Ready for your interview or client pitch? Launch your stealth copilot room.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-zinc-950/80 border border-zinc-800 px-5 py-3 rounded-2xl text-center">
            <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Available Credits</div>
            <div className="text-2xl font-mono font-bold text-emerald-300">{user?.credits ?? 0}</div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/pricing"
              className="px-5 py-3.5 border border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15 font-semibold rounded-2xl flex items-center gap-2 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            >
              <Coins className="w-5 h-5" aria-hidden="true" /> Billing / Upgrade
            </Link>
            <Link
              href="/copilot/new"
              className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-lg shadow-indigo-600/30 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Video className="w-5 h-5" /> Launch Copilot
            </Link>
            <Link
              href="/copilot/new?mode=MOCK_INTERVIEW"
              className="px-5 py-3.5 bg-purple-700 hover:bg-purple-600 text-white font-semibold rounded-2xl shadow-lg shadow-purple-700/20 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <MessageSquare className="w-5 h-5" /> Mock Interview
            </Link>
          </div>
        </div>
      </div>

      <div className="mb-8">
        <PromoCodeBox currentCredits={user?.credits ?? 0} />
      </div>

      {/* Quick Stats & Navigation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        {/* Sessions Section */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-indigo-400" /> Recent Sessions
            </h2>
            <Link href="/copilot/new" className="text-sm font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1">
              New Session <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <Link href="/resume-maker" className="mb-12 flex items-center justify-between gap-4 rounded-2xl border border-indigo-500/20 bg-gradient-to-r from-indigo-950/60 to-zinc-900/70 p-5 transition hover:border-indigo-400/40">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-300"><Sparkles className="h-5 w-5" /></span>
              <div>
                <h2 className="font-semibold text-white">Tailor a resume to your next role</h2>
                <p className="mt-1 text-sm text-zinc-400">Use a saved CV, add a job description, and export a polished PDF.</p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-indigo-300" />
          </Link>

          {user?.sessions.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              <p className="mb-3 text-sm">No interview sessions recorded yet.</p>
              <Link href="/copilot/new" className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium">
                Start First Copilot Session
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {user?.sessions.slice(0, 5).map((session) => (
                <div key={session.id} className="bg-zinc-950/60 border border-zinc-800/80 p-4 rounded-xl">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-white text-sm mb-1">{session.title}</h3>
                      <p className="text-xs text-zinc-400">{session.companyOrClient} • {session.mode.replaceAll("_", " ")}</p>
                    </div>
                    <Link href={`/copilot/${session.id}`} className="shrink-0 text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-3 py-1.5 rounded-lg transition-colors">
                      {session.status === "COMPLETED" ? "View summary" : "Open session"}
                    </Link>
                  </div>
                  {session.aiNotes && (
                    <div className="mt-3 border-t border-zinc-800 pt-3">
                      <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
                        <CheckCircle className="h-3 w-3" /> Post-session notes
                      </p>
                      <p className="line-clamp-2 text-xs leading-5 text-zinc-400">{session.aiNotes}</p>
                      {session.scorecard && (() => {
                        try {
                          const scorecard = JSON.parse(session.scorecard)
                          return <p className="mt-1 text-xs text-indigo-300">Score: {scorecard.overallScore ?? "—"} · {scorecard.verdict ?? "Summary ready"}</p>
                        } catch {
                          return null
                        }
                      })()}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Career Vault Section */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-3xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-400" /> Career Vault (Documents)
            </h2>
            <Link href="/documents" className="text-sm font-medium text-purple-400 hover:text-purple-300 flex items-center gap-1">
              Manage Vault <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {user?.documents.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
              <p className="mb-3 text-sm">No STAR stories or resumes added yet.</p>
              <Link href="/documents" className="text-xs bg-purple-600 text-white px-4 py-2 rounded-xl font-medium">
                Add Resume / STAR Story
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {user?.documents.slice(0, 5).map((doc) => (
                <div key={doc.id} className="bg-zinc-950/60 border border-zinc-800/80 p-4 rounded-xl flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-sm mb-1">{doc.title}</h3>
                    <span className="text-xs bg-purple-950/60 text-purple-300 border border-purple-800/40 px-2 py-0.5 rounded-md">
                      {doc.docType}
                    </span>
                  </div>
                  <span className="text-xs text-zinc-500 font-mono">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
