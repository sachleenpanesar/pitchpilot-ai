"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Video } from "lucide-react"

type ExtensionReply = {
  source: "pitchpilot-extension"
  type: "PITCHPILOT_DETECTED" | "PITCHPILOT_LAUNCH_RESULT"
  requestId: string
  available?: boolean
  opened?: boolean
  error?: string
}

function requestExtension(
  type: "PITCHPILOT_DETECT" | "OPEN_PITCHPILOT_EXTENSION",
  timeoutMs: number,
): Promise<ExtensionReply | null> {
  const requestId = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`

  return new Promise((resolve) => {
    let settled = false
    const timeout = window.setTimeout(() => finish(null), timeoutMs)
    const finish = (reply: ExtensionReply | null) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      window.removeEventListener("message", onMessage)
      resolve(reply)
    }
    const onMessage = (event: MessageEvent<ExtensionReply>) => {
      if (
        event.source !== window ||
        event.origin !== window.location.origin ||
        event.data?.source !== "pitchpilot-extension" ||
        event.data.requestId !== requestId
      ) return
      if (type === "PITCHPILOT_DETECT" && event.data.type === "PITCHPILOT_DETECTED") finish(event.data)
      if (type === "OPEN_PITCHPILOT_EXTENSION" && event.data.type === "PITCHPILOT_LAUNCH_RESULT") finish(event.data)
    }
    window.addEventListener("message", onMessage)
    window.postMessage({ source: "pitchpilot-website", type, requestId }, window.location.origin)
  })
}

export default function LaunchCopilotButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function launch() {
    if (busy) return
    setBusy(true)
    setMessage("")
    try {
      const detected = await requestExtension("PITCHPILOT_DETECT", 1200)
      if (detected?.available) {
        const result = await requestExtension("OPEN_PITCHPILOT_EXTENSION", 2500)
        if (result?.opened) {
          return
        }
      }

      const copilotUrl = "/copilot/new"
      const width = 940
      const height = 660
      const left = Math.max(0, Math.round((window.innerWidth - width) / 2))
      const top = Math.max(0, Math.round((window.innerHeight - height) / 2))
      const popup = window.open(
        copilotUrl,
        "PitchPilotPopup",
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
      )
      if (!popup) {
        router.push(copilotUrl)
      }
    } catch (error) {
      console.error("Could not launch popup session:", error)
      router.push("/copilot/new")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        onClick={() => void launch()}
        disabled={busy}
        aria-describedby={message ? "launch-copilot-message" : undefined}
        className="flex items-center gap-2 rounded-2xl bg-indigo-600 px-6 py-3.5 font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all hover:-translate-y-0.5 hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-wait disabled:opacity-70"
      >
        <Video className="h-5 w-5" aria-hidden="true" />
        {busy ? "Launching session…" : "Launch Copilot"}
      </button>
      {message && (
        <p id="launch-copilot-message" className="max-w-xs text-xs leading-5 text-amber-200" role="status" aria-live="polite">
          {message} <a className="font-semibold underline underline-offset-2" href="/extension-access">Install help</a>
        </p>
      )}
    </div>
  )
}
