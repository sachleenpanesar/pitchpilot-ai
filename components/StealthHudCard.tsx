"use client";

import { useEffect, useState } from "react";
import { Download, EyeOff, Shield, Zap } from "lucide-react";

const RELEASE_DOWNLOAD_URL =
  "https://github.com";

export default function StealthHudCard() {
  const [hudOnline, setHudOnline] = useState(false);

  useEffect(() => {
    let active = true;
    async function checkHud() {
      try {
        const res = await fetch("http://127.0.0");
        if (active) setHudOnline(res.ok);
      } catch {
        if (active) setHudOnline(false);
      }
    }
    checkHud();
    const timer = window.setInterval(checkHud, 4000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <section className="rounded-3xl border border-sky-500/25 bg-gradient-to-br from-sky-950/35 via-zinc-900/90 to-zinc-900/80 p-6 shadow-xl sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/25 bg-sky-500/10 text-sky-300">
            <EyeOff className="h-6 w-6" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Companion Desktop Overlay
            </p>
            <h2 className="text-xl font-bold text-white">
              PitchPilot Stealth Desktop HUD
            </h2>
          </div>
        </div>

        <span
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
            hudOnline
              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-300"
              : "border-zinc-700 bg-zinc-900/80 text-zinc-300"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              hudOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
            }`}
          />
          {hudOnline ? "Stealth HUD Connected" : "Windows 10 / 11 (x64)"}
        </span>
      </div>

      <p className="mt-4 text-sm leading-6 text-zinc-300">
        Browser extensions cannot hide from full-screen shares. Install the
        lightweight companion Stealth HUD once so your AI answers float
        invisibly over Microsoft Teams, Zoom, and Google Meet while syncing your
        Job Description and CV from the Chrome Add-in.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={RELEASE_DOWNLOAD_URL}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-sky-500 px-5 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-sky-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Download Stealth HUD (.exe)
        </a>

        <a
          href="pitchpilot://launch"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:border-sky-400/40 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          <Zap className="h-4 w-4 text-sky-300" aria-hidden="true" />
          Launch Installed HUD
        </a>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-zinc-800/80 pt-4 text-xs text-zinc-400">
        <span className="inline-flex items-center gap-1.5 text-zinc-300">
          <Shield className="h-3.5 w-3.5 text-sky-400" aria-hidden="true" />
          OS-Level Screen Capture Exclusion
        </span>
        <span>
          Panic Hide:{" "}
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
            Ctrl+Shift+H
          </kbd>
        </span>
        <span>
          Click-Through Lock:{" "}
          <kbd className="rounded border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-zinc-200">
            Ctrl+Shift+T
          </kbd>
        </span>
      </div>
    </section>
  );
}
