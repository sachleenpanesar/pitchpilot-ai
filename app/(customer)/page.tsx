import Link from "next/link";
import { Sparkles, Shield, EyeOff, Zap, CheckCircle2, Terminal, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";

export default async function LandingPage() {
  const setting = await prisma.siteSetting.findFirst();
  const heroTitle = setting?.heroTitle || "PitchPilot AI - Stealth Interview Copilot";
  const heroSubtitle = setting?.heroSubtitle || "Ace interviews and pitch calls with real-time AI prompts completely undetectable on screen share.";
  const weeklyPriceInr = setting?.weeklyPriceInr ?? 499;
  const monthlyPriceInr = setting?.monthlyPriceInr ?? 1499;

  return (
    <div className="flex flex-col flex-1 bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <section className="relative overflow-hidden py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-indigo-950/40 via-zinc-950 to-zinc-950 border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.15)_0,transparent_70%)]"></div>
        <div className="max-w-5xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-medium mb-6">
            <Shield className="w-4 h-4 text-indigo-400" />
            <span>100% Undetectable Screen-Share Cloak Technology</span>
          </div>
          <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
            {heroTitle.includes("-") ? (
              <>
                {heroTitle.split("-")[0]} <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                  {heroTitle.split("-")[1]}
                </span>
              </>
            ) : (
              heroTitle
            )}
          </h1>
          <p className="max-w-2xl mx-auto text-lg sm:text-xl text-zinc-400 mb-10 leading-relaxed">
            {heroSubtitle}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-2xl shadow-xl shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-5 h-5" />
              Start Free Practice
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/login"
              className="w-full sm:w-auto px-8 py-4 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-2xl border border-zinc-700/80 flex items-center justify-center gap-2 transition-all"
            >
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* Stealth Features Grid */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Engineered for Absolute Screen-Share Invisibility</h2>
          <p className="text-zinc-400">Interviewers share entire screens or specific app windows. PitchPilot AI features built-in camouflage and cloaking so you never get caught.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-zinc-900/60 border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-6">
              <EyeOff className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Panic Hide Shortcut (Esc)</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Instantly collapse or hide the assistant interface with a single keystroke (`Esc` or `Ctrl+Shift+H`). The overlay becomes completely invisible.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-6">
              <Terminal className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">VS Code / README Camouflage</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Disguise your assistant window as a standard developer README markdown viewer or dark code editor. If captured on screen share, it looks like normal engineering notes.
            </p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 p-8 rounded-2xl relative overflow-hidden group hover:border-indigo-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-6">
              <Zap className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-semibold text-white mb-3">Sub-Second AI Prompts</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Live transcription simulation feeds interview questions instantly into AI to generate crisp STAR story bullet points and technical architecture answers.
            </p>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto border-t border-zinc-800">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl font-bold text-white mb-4">Simple, Transparent Pricing</h2>
          <p className="text-zinc-400">Unlock unlimited stealth copilot sessions and AI interview prep.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
          {/* Weekly Pass */}
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-3xl p-8 flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Weekly Pass</h3>
                <span className="text-xs bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full">7 Days Access</span>
              </div>
              <div className="text-4xl font-extrabold text-white mb-6">
                ₹{weeklyPriceInr} <span className="text-sm font-normal text-zinc-400">/ week</span>
              </div>
              <ul className="space-y-3 text-sm text-zinc-300 mb-8">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Unlimited Stealth Copilot Sessions</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Screen-Share Invisibility Suite</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> STAR Story Generator Vault</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Real-time Objection Handler</li>
              </ul>
            </div>
            <Link href="/register" className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-xl text-center transition-colors">
              Get Weekly Pass
            </Link>
          </div>

          {/* Monthly Pro */}
          <div className="bg-gradient-to-b from-indigo-950/60 to-zinc-900 border-2 border-indigo-500/50 rounded-3xl p-8 flex flex-col justify-between relative shadow-2xl shadow-indigo-500/10">
            <div className="absolute -top-3.5 left-1/2 transform -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold uppercase tracking-wider px-3.5 py-1 rounded-full">
              Most Popular
            </div>
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xl font-bold text-white">Monthly Pro</h3>
                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full">30 Days Access</span>
              </div>
              <div className="text-4xl font-extrabold text-white mb-6">
                ₹{monthlyPriceInr} <span className="text-sm font-normal text-zinc-400">/ month</span>
              </div>
              <ul className="space-y-3 text-sm text-zinc-300 mb-8">
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Everything in Weekly Pass</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Priority AI Response Engine</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Mock Interview Scorecards & Audio Playback</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-indigo-400" /> Follow-up Email Generator</li>
              </ul>
            </div>
            <Link href="/register" className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-center transition-colors shadow-lg shadow-indigo-600/35">
              Get Monthly Pro
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
