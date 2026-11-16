"use client"

import { useState } from "react"

export default function ExtensionAccessPage() {
  const [token, setToken] = useState("")
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  async function createToken() {
    setBusy(true)
    setToken("")
    setMessage("")
    try {
      const response = await fetch("/api/auth/extension-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const result = await response.json()
      if (!response.ok) {
        setMessage(result.error || "Could not create a token. Sign in and try again.")
        return
      }
      setToken(result.token)
      setMessage("This token expires in 60 minutes and can only call the copilot answer API. Copy it now; it will not be shown again.")
    } catch {
      setMessage("Could not reach the server. Please try again.")
    } finally {
      setBusy(false)
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(token)
      setMessage("Copied. Paste the token into the extension's Connection settings.")
    } catch {
      setMessage("Clipboard access is unavailable. Select and copy the token manually.")
    }
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-12 text-slate-900">
      <a className="text-sm font-semibold text-emerald-700 hover:text-emerald-800" href="/dashboard">← Back to dashboard</a>
      <h1 className="mt-6 text-3xl font-bold tracking-tight">Chrome extension access</h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Create a short-lived bearer token for PitchPilot Sidekick. It is scoped to the copilot answer API, expires after one hour, and is only displayed once.
      </p>
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
        Keep this token private. The extension stores it only in this panel unless you explicitly enable “Remember this token”; do not save it on a shared device.
      </div>
      <button
        className="mt-6 rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60"
        type="button"
        onClick={createToken}
        disabled={busy}
      >
        {busy ? "Creating token…" : "Create one-hour token"}
      </button>
      {token ? (
        <div className="mt-5">
          <label className="block text-sm font-semibold" htmlFor="extension-token">Temporary bearer token</label>
          <textarea
            id="extension-token"
            className="mt-2 min-h-28 w-full rounded-lg border border-slate-300 bg-white p-3 font-mono text-xs"
            readOnly
            value={token}
            onFocus={(event) => event.currentTarget.select()}
          />
          <button
            className="mt-3 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
            type="button"
            onClick={copyToken}
          >
            Copy token
          </button>
        </div>
      ) : null}
      {message ? <p className="mt-4 text-sm leading-6 text-slate-700" role="status" aria-live="polite">{message}</p> : null}
    </main>
  )
}
