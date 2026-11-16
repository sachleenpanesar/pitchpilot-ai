"use client"

import { usePathname } from "next/navigation"
import { useCallback, useEffect, useState } from "react"
import type { FormEvent } from "react"
import { LoaderCircle, MessageCircle, Plus, Send, X } from "lucide-react"
import SupportMessageContent from "@/components/support-message-content"

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
  messages: SupportMessage[]
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

export default function CustomerSupportChat({ enabled }: { enabled: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [selectedId, setSelectedId] = useState("")
  const [startingTicket, setStartingTicket] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const chatAvailable = enabled && pathname !== "/login" && pathname !== "/register" && !pathname.startsWith("/admin")

  const refreshTickets = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/support/tickets", { cache: "no-store" })
      const data: { error?: string; tickets?: SupportTicket[] } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not load support tickets (HTTP ${response.status}).`)
      const nextTickets = Array.isArray(data.tickets) ? data.tickets : []
      setTickets(nextTickets)
      setSelectedId((current) => current && nextTickets.some((ticket) => ticket.id === current)
        ? current
        : nextTickets[0]?.id ?? "")
      setError("")
      return nextTickets
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load support tickets.")
      return undefined
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!open || !chatAvailable) return
    const frame = window.requestAnimationFrame(() => void refreshTickets())
    const intervalId = window.setInterval(() => void refreshTickets(), 5000)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearInterval(intervalId)
    }
  }, [open, chatAvailable, refreshTickets])

  if (!chatAvailable) return null

  const selectedTicket = tickets.find((ticket) => ticket.id === selectedId)

  async function submitTicket(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const previousIds = new Set(tickets.map((ticket) => ticket.id))
    const submittedSubject = subject.trim()
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: submittedSubject, message: message.trim() }),
      })
      const data: { error?: string; ticket?: SupportTicket } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not create ticket (HTTP ${response.status}).`)
      setSubject("")
      setMessage("")
      setStartingTicket(false)
      const refreshedTickets = await refreshTickets()
      const createdTicket = refreshedTickets?.find((ticket) => ticket.id === data.ticket?.id)
        ?? refreshedTickets?.find((ticket) => !previousIds.has(ticket.id))
        ?? refreshedTickets?.find((ticket) => ticket.subject === submittedSubject)
      if (createdTicket) setSelectedId(createdTicket.id)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not create ticket.")
    } finally {
      setBusy(false)
    }
  }

  async function submitReply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedTicket || !message.trim()) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch(`/api/support/tickets/${encodeURIComponent(selectedTicket.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim() }),
      })
      const data: { error?: string } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not send reply (HTTP ${response.status}).`)
      setMessage("")
      await refreshTickets()
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not send reply.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <section
          id="support-chat-panel"
          aria-labelledby="support-chat-title"
          className="flex h-[min(620px,calc(100dvh-6rem))] w-[min(420px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 text-slate-100 shadow-2xl shadow-black/50"
        >
          <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-3">
            <div>
              <h2 id="support-chat-title" className="font-semibold text-white">Support Chat</h2>
              <p className="text-xs text-slate-400">We’re here to help</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close support chat" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-400">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            {!startingTicket && !selectedTicket && (
              <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                {loading ? <LoaderCircle className="mb-3 h-6 w-6 animate-spin text-indigo-300" aria-hidden="true" /> : <MessageCircle className="mb-3 h-7 w-7 text-indigo-300" aria-hidden="true" />}
                <p className="font-medium text-white">{loading ? "Loading your conversations…" : "No support conversations yet"}</p>
                <p className="mt-1 text-sm text-slate-400">Start a ticket and our team will get back to you.</p>
                <button type="button" onClick={() => { setError(""); setStartingTicket(true) }} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Start a ticket
                </button>
              </div>
            )}

            {startingTicket ? (
              <form onSubmit={submitTicket} className="flex min-h-0 flex-1 flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-white">New support ticket</h3>
                  {tickets.length > 0 && <button type="button" onClick={() => { setStartingTicket(false); setError("") }} className="text-sm text-indigo-300 hover:text-indigo-200">Back to tickets</button>}
                </div>
                <label htmlFor="support-subject" className="text-sm font-medium text-slate-300">Subject</label>
                <input id="support-subject" required maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="How can we help?" />
                <label htmlFor="support-first-message" className="text-sm font-medium text-slate-300">Message</label>
                <textarea id="support-first-message" required maxLength={5000} rows={6} value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-28 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Describe what you need help with…" />
                <button type="submit" disabled={busy || !subject.trim() || !message.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />} Create ticket
                </button>
              </form>
            ) : selectedTicket ? (
              <>
                <div className="flex items-center gap-2 border-b border-slate-800 px-3 py-2">
                  <label htmlFor="support-ticket-select" className="sr-only">Select support ticket</label>
                  <select id="support-ticket-select" value={selectedTicket.id} onChange={(event) => { setSelectedId(event.target.value); setError("") }} className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-2 text-sm text-white focus:border-indigo-400 focus:outline-none">
                    {tickets.map((ticket) => <option key={ticket.id} value={ticket.id}>{ticket.subject}</option>)}
                  </select>
                  <button type="button" onClick={() => { setMessage(""); setError(""); setStartingTicket(true) }} className="inline-flex min-h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-700 px-2.5 text-xs text-slate-200 hover:bg-slate-800" aria-label="Start another ticket">
                    <Plus className="h-4 w-4" aria-hidden="true" /> New
                  </button>
                </div>
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-4 py-2.5">
                  <div className="min-w-0"><p className="truncate text-sm font-medium text-white">{selectedTicket.subject}</p><p className="text-xs text-slate-500">Updated {formatTime(selectedTicket.updatedAt)}</p></div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${selectedTicket.status === "RESOLVED" ? "bg-emerald-400/10 text-emerald-300" : "bg-indigo-400/10 text-indigo-200"}`}>
                    {selectedTicket.status === "RESOLVED" ? "Resolved" : "Open"}
                  </span>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-label="Conversation messages" aria-live="polite">
                  {selectedTicket.messages.length === 0 ? <p className="text-center text-sm text-slate-500">No messages in this ticket yet.</p> : selectedTicket.messages.map((item) => {
                    const isCustomer = item.senderRole.toUpperCase() === "CUSTOMER"
                    return (
                      <article key={item.id} className={`max-w-[90%] rounded-xl px-3 py-2.5 ${isCustomer ? "ml-auto bg-indigo-500/20 text-indigo-50" : "mr-auto bg-slate-800 text-slate-100"}`}>
                        <SupportMessageContent message={item.message} />
                        <time dateTime={item.createdAt} className="mt-1.5 block text-right text-[11px] text-slate-400">{isCustomer ? "You · " : "Support · "}{formatTime(item.createdAt)}</time>
                      </article>
                    )
                  })}
                </div>
                <form onSubmit={submitReply} className="border-t border-slate-800 p-3">
                  {selectedTicket.status === "RESOLVED" && <p className="mb-2 text-xs text-emerald-300">This ticket is resolved. Sending a reply will reopen it.</p>}
                  <label htmlFor="support-reply" className="sr-only">Write a reply</label>
                  <div className="flex items-end gap-2">
                    <textarea id="support-reply" required maxLength={5000} rows={2} value={message} onChange={(event) => setMessage(event.target.value)} className="min-h-11 flex-1 resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30" placeholder="Write a reply…" />
                    <button type="submit" disabled={busy || !message.trim()} className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50" aria-label="Send reply">
                      {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  </div>
                </form>
              </>
            ) : null}
          </div>

          {error && <p role="alert" className="border-t border-red-500/30 bg-red-950/50 px-4 py-2.5 text-sm text-red-200">{error}</p>}
        </section>
      )}
      <button type="button" onClick={() => setOpen((current) => !current)} aria-expanded={open} aria-controls={open ? "support-chat-panel" : undefined} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-indigo-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-950/50 transition-colors hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
        {open ? <X className="h-4 w-4" aria-hidden="true" /> : <MessageCircle className="h-4 w-4" aria-hidden="true" />}
        {open ? "Close support" : "Support Chat"}
      </button>
    </div>
  )
}
