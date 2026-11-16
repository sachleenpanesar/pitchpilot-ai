import Link from "next/link";
import { Coins, FileText, LayoutDashboard, LogOut, Shield, Sparkles } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import CustomerSupportChat from "@/components/customer-support-chat";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentUser();
  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { email: true, role: true, plan: true, credits: true },
      })
    : null;

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans">
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto min-h-16 w-full px-4 py-3 sm:px-6 lg:px-8 flex flex-wrap items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-indigo-400">
            <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <span>PitchPilot <span className="text-zinc-400 font-normal">AI</span></span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 sm:gap-6">
            <div className="hidden md:flex items-center gap-2 text-xs bg-indigo-950/60 text-indigo-300 border border-indigo-800/50 px-3 py-1.5 rounded-full">
              <Shield className="w-3.5 h-3.5 text-indigo-400" />
              <span>Meeting &amp; Practice Copilot Active</span>
            </div>

            {user ? (
              <nav aria-label="Customer navigation" className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-4">
                <Link href="/dashboard" className="text-sm font-medium text-zinc-300 hover:text-white flex items-center gap-1.5">
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </Link>
                <Link href="/documents" className="text-sm font-medium text-zinc-300 hover:text-white flex items-center gap-1.5">
                  <FileText className="w-4 h-4" /> Vault
                </Link>
                <Link href="/resume-maker" className="text-sm font-medium text-zinc-300 hover:text-white">
                  Resume Maker
                </Link>
                <Link
                  href="/pricing"
                  className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-400/10 hover:text-emerald-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <Coins className="h-4 w-4" aria-hidden="true" />
                  Billing / Upgrade
                </Link>
                <div className="flex items-center gap-2 bg-zinc-800/80 px-3 py-1.5 rounded-lg text-xs font-mono border border-zinc-700">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-emerald-300" aria-label={`${user.credits} credits available`}>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    {user.credits} credits
                  </span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-indigo-400 font-bold">{user.email}</span>
                  <span className="text-zinc-500">|</span>
                  <span className="text-emerald-400 uppercase">{user.plan}</span>
                </div>
                <form action="/api/auth/logout" method="POST">
                  <button type="submit" className="text-zinc-400 hover:text-red-400 p-1.5 rounded-lg transition-colors" title="Sign Out" aria-label="Sign out">
                    <LogOut className="w-4 h-4" />
                  </button>
                </form>
              </nav>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-sm font-medium text-zinc-300 hover:text-white px-3 py-2">
                  Sign In
                </Link>
                <Link href="/register" className="text-sm font-medium bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl transition-colors shadow-lg shadow-indigo-600/20">
                  Get Started
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <CustomerSupportChat enabled={Boolean(user && user.role !== "ADMIN")} />

      <footer className="border-t border-zinc-800 bg-zinc-950 py-8 text-center text-xs text-zinc-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} PitchPilot AI. Confidential Interview &amp; Pitch Assistant.</p>
          <div className="flex items-center gap-6">
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Undetectable Stealth Engine Ready
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
