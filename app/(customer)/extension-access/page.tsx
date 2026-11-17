"use client"

import { useState } from "react"
import Link from "next/link"
import { Check, Copy, Download, Puzzle } from "lucide-react"
import StealthHudCard from "@/components/StealthHudCard"

export default function ExtensionAccessPage() {
  const [token, setToken] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function createToken() {
    setBusy(true)
    setToken("")
    setMessage("")
    try {
      const response = await fetch("/api/extension/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        credentials: "include",
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setMessage(result.error || "Could not create a token. Sign in and try again.")
        return
      }
      setToken(result.token)
      setMessage("This token expires in 30 days and can call the copilot answer API and read your saved document titles and credit balance. Copy it now; it will not be shown again.")
    } catch {
      setMessage("Could not reach the server. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token)
      setCopied(true)
      setMessage("Copied. Paste the token into the extension's Connection settings.")
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      setCopied(false)
      setMessage("Clipboard access is unavailable. Select and copy the token manually.")
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <Link className="text-sm font-semibold text-emerald-300 hover:text-emerald-200" href="/dashboard">← Back to dashboard</Link>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
        <section className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-6 shadow-xl sm:p-8">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-indigo-400/20 bg-indigo-400/10 text-indigo-300">
              <Puzzle className="h-6 w-6" aria-hidden="true" />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Chrome add-in</p>
          </div>
          <h1 className="mt-5 text-3xl font-bold tracking-tight text-white">Install PitchPilot for Chrome</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            Download the extension package, then load it into Chrome. Your token connects the extension to your PitchPilot account.
          </p>
          <a
            className="mt-6 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
            href="/pitchpilot-extension.zip"
            download
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Download Add-in (.zip)
          </a>
          <ol className="mt-7 space-y-3 text-sm leading-6 text-zinc-300">
            <li><strong className="text-white">1.</strong> Unzip the downloaded file to a folder you can keep.</li>
            <li><strong className="text-white">2.</strong> Open <code className="rounded bg-zinc-800 px-1.5 py-0.5 text-emerald-200">chrome://extensions</code>, turn on <strong className="text-white">Developer mode</strong>, and choose <strong className="text-white">Load unpacked</strong>.</li>
            <li><strong className="text-white">3.</strong> Select the unzipped folder, then open the PitchPilot extension and connect your account.</li>
          </ol>
        </section>

        <section className="rounded-3xl border border-emerald-400/20 bg-emerald-950/20 p-6 shadow-xl sm:p-8" aria-labelledby="token-heading">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-300">Account connection</p>
          <h2 id="token-heading" className="mt-3 text-2xl font-bold text-white">Create a secure token</h2>
          <p className="mt-3 text-sm leading-6 text-zinc-300">
            This bearer token expires after 30 days and is shown only once. Keep it private and do not save it on a shared device.
          </p>
          <button
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-wait disabled:opacity-60"
            type="button"
            onClick={createToken}
            disabled={busy}
          >
            {busy ? "Creating token…" : token ? "Create another token" : "Create 30-day token"}
          </button>
          {token ? (
            <div className="mt-5">
              <label className="block text-sm font-semibold text-white" htmlFor="extension-token">Temporary bearer token</label>
              <textarea
                id="extension-token"
                className="mt-2 min-h-28 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 font-mono text-xs text-zinc-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                readOnly
                value={token}
                onFocus={(event) => event.currentTarget.select()}
                aria-describedby="token-help"
              />
              <p id="token-help" className="mt-2 text-xs leading-5 text-zinc-400">Paste this in the extension’s Connection settings. It will not be shown again after leaving this page.</p>
              <button
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
                type="button"
                onClick={copyToken}
              >
                {copied ? <Check className="h-4 w-4 text-emerald-300" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
                {copied ? "Copied" : "Copy Connection Token"}
              </button>
            </div>
          ) : null}
          {message ? <p className="mt-4 text-sm leading-6 text-emerald-100" role="status" aria-live="polite">{message}</p> : null}
        </section>
      </div>

      <div className="mt-8">
        <StealthHudCard />
      </div>
    </main>
  )
}
