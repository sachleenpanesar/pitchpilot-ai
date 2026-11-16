"use client"

import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { LoaderCircle, MessageSquare, RefreshCw, Send } from "lucide-react"

type SupportMessage = {
  id: string
  senderRole: string
  message: string
  isRead: boolean
  createdAt: string
}

type SupportTicket = {
  id: string
  subject: string
  status: "OPEN" | "RESOLVED" | string
  createdAt: string
  updatedAt: string
  userId: string
  name: string | null
  email: string
  messages: SupportMessage[]
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function SupportInbox() {
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [reply, setReply] = useState("")

  const refresh = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/support", { cache: "no-store" })
      const data: { error?: string; tickets?: SupportTicket[] } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not load support inbox (HTTP ${response.status}).`)
      const nextTickets = Array.isArray(data.tickets) ? data.tickets : []
      setTickets(nextTickets)
      setSelectedId((current) => current && nextTickets.some((ticket) => ticket.id === current)
        ? current
        : nextTickets[0]?.id ?? "")
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load support inbox.")
    } finally {
      if (showSpinner) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId)

  async function sendReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTicket || !reply.trim()) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selectedTicket.id)}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: reply.trim() }),
      })
      const data: { error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not send reply (HTTP ${response.status}).`)
      setReply("")
      setNotice("Reply sent.")
      await refresh(false)
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not send reply.")
    } finally {
      setBusy(false)
    }
  }

  async function updateStatus(status: "OPEN" | "RESOLVED") {
    if (!selectedTicket) return
    setBusy(true)
    setError("")
    setNotice("")
    try {
      const response = await fetch(`/api/admin/support/${encodeURIComponent(selectedTicket.id)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data: { error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not update ticket status (HTTP ${response.status}).`)
      setNotice(status === "RESOLVED" ? "Ticket marked resolved." : "Ticket reopened.")
      await refresh(false)
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update ticket status.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <section id="support-inbox" className="mt-6 scroll-mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70">
      <header className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-indigo-300" aria-hidden="true" />
          <div>
            <h2 className="font-semibold text-white">Support Inbox</h2>
            <p className="text-xs text-zinc-500">Review customer conversations and respond to tickets.</p>
          </div>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={loading || busy} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh inbox
        </button>
      </header>

      {(error || notice) && <p role={error ? "alert" : "status"} className={`mx-4 mt-4 rounded-xl border px-4 py-3 text-sm sm:mx-5 ${error ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"}`}>{error || notice}</p>}

      {loading ? (
        <p role="status" className="flex items-center justify-center gap-2 p-12 text-sm text-zinc-400"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading support tickets…</p>
      ) : tickets.length === 0 ? (
        <p className="p-12 text-center text-sm text-zinc-500">No support tickets yet.</p>
      ) : (
        <div className="grid min-h-[560px] md:grid-cols-[minmax(240px,0.72fr)_minmax(0,1.6fr)]">
          <nav aria-label="Support tickets" className="max-h-[360px] overflow-y-auto border-b border-zinc-800 md:max-h-[680px] md:border-b-0 md:border-r">
            {tickets.map((ticket) => {
              const isSelected = ticket.id === selectedId
              return (
                <button key={ticket.id} type="button" onClick={() => { setSelectedId(ticket.id); setNotice(""); setError("") }} aria-current={isSelected ? "true" : undefined} className={`block w-full border-b border-zinc-800 px-4 py-4 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-indigo-400 ${isSelected ? "bg-indigo-500/10" : "hover:bg-zinc-800/60"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 min-w-0 font-medium text-white">{ticket.subject}</span>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${ticket.status === "RESOLVED" ? "bg-emerald-400/10 text-emerald-300" : "bg-indigo-400/10 text-indigo-200"}`}>{ticket.status === "RESOLVED" ? "Resolved" : "Open"}</span>
                  </div>
                  <p className="mt-1 truncate text-sm text-zinc-400">{ticket.name || "Customer"} · {ticket.email}</p>
                  <time dateTime={ticket.updatedAt} className="mt-2 block text-xs text-zinc-500">Updated {formatTime(ticket.updatedAt)}</time>
                </button>
              )
            })}
          </nav>

          {selectedTicket ? (
            <div className="flex min-h-[560px] min-w-0 flex-col">
              <header className="flex flex-col gap-3 border-b border-zinc-800 px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <h3 className="break-words font-semibold text-white">{selectedTicket.subject}</h3>
                  <p className="mt-1 break-all text-sm text-zinc-400">{selectedTicket.name || "Customer"} · {selectedTicket.email}</p>
                  <p className="mt-1 text-xs text-zinc-500">Customer ID: {selectedTicket.userId}</p>
                  <p className="mt-1 text-xs text-zinc-500">Created {formatTime(selectedTicket.createdAt)} · Updated {formatTime(selectedTicket.updatedAt)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${selectedTicket.status === "RESOLVED" ? "bg-emerald-400/10 text-emerald-300" : "bg-indigo-400/10 text-indigo-200"}`}>{selectedTicket.status === "RESOLVED" ? "Resolved" : "Open"}</span>
                  <button type="button" onClick={() => void updateStatus(selectedTicket.status === "RESOLVED" ? "OPEN" : "RESOLVED")} disabled={busy} className="min-h-10 rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50">
                    {selectedTicket.status === "RESOLVED" ? "Reopen" : "Resolve"}
                  </button>
                </div>
              </header>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 sm:p-5" aria-label="Selected ticket conversation" aria-live="polite">
                {selectedTicket.messages.length === 0 ? <p className="text-center text-sm text-zinc-500">No messages in this ticket yet.</p> : selectedTicket.messages.map((item) => {
                  const isAdmin = item.senderRole.toUpperCase() === "ADMIN"
                  return (
                    <article key={item.id} className={`max-w-[90%] rounded-xl px-3 py-2.5 ${isAdmin ? "ml-auto bg-indigo-500/20 text-indigo-50" : "mr-auto bg-zinc-800 text-zinc-100"}`}>
                      <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.message}</p>
                      <time dateTime={item.createdAt} className="mt-1.5 block text-right text-[11px] text-zinc-400">{isAdmin ? "Support · " : `${selectedTicket.name || "Customer"} · `}{formatTime(item.createdAt)}</time>
                    </article>
                  )
                })}
              </div>

              <form onSubmit={sendReply} className="border-t border-zinc-800 p-4 sm:p-5">
                <label htmlFor="admin-support-reply" className="mb-2 block text-sm font-medium text-zinc-300">Reply to customer</label>
                <div className="flex items-end gap-2">
                  <textarea id="admin-support-reply" required maxLength={5000} rows={3} value={reply} onChange={(event) => setReply(event.target.value)} className="min-h-12 flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Write a reply…" />
                  <button type="submit" disabled={busy || !reply.trim()} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50">
                    {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </form>
            </div>
          ) : <p className="flex min-h-[260px] items-center justify-center p-8 text-center text-sm text-zinc-500">Select a support ticket to view the conversation.</p>}
        </div>
      )}
    </section>
  )
}
