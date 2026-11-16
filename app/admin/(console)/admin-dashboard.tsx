"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, CircleCheck, CircleX, ClipboardCheck, Crown, Gift, LoaderCircle, RefreshCw, Save, Settings2, Users } from "lucide-react"
import Link from "next/link"
import SupportInbox from "./support-inbox"

type User = {
  id: string
  name: string | null
  email: string
  plan: string
  credits: number
  createdAt: string | Date
}

type Settings = {
  heroTitle: string
  heroSubtitle: string
  starterCredits: number
  weeklyPriceInr: number
  monthlyPriceInr: number
  upiId: string
  upiPayeeName: string
}

type PendingPayment = {
  id: string
  userId: string
  planOrPack: string
  amountInr: number
  utrNumber: string
  status: string
  createdAt: string
  user: { email: string; name: string | null }
}

export default function AdminDashboard({
  initialUsers,
  initialSettings,
  totalUsers,
  proUsers,
}: {
  initialUsers: User[]
  initialSettings: Settings
  totalUsers: number
  proUsers: number
}) {
  const [users, setUsers] = useState(initialUsers)
  const [settings, setSettings] = useState(initialSettings)
  const [bonus, setBonus] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [pendingPayments, setPendingPayments] = useState<PendingPayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(true)
  const [paymentsError, setPaymentsError] = useState("")
  const [paymentMessage, setPaymentMessage] = useState("")
  const [busyPaymentId, setBusyPaymentId] = useState("")
  const paymentBusyRef = useRef(false)

  async function getPendingPayments(signal?: AbortSignal): Promise<PendingPayment[]> {
    const response = await fetch("/api/admin/upi-payments", { cache: "no-store", signal })
    const data: { error?: string; payments?: PendingPayment[] } = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Could not load pending UPI payments (HTTP ${response.status}).`)
    return Array.isArray(data.payments) ? data.payments : []
  }

  useEffect(() => {
    const controller = new AbortController()
    getPendingPayments(controller.signal)
      .then(setPendingPayments)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) {
          setPaymentsError(loadError instanceof Error ? loadError.message : "Could not load pending UPI payments.")
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setPaymentsLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function updateUser(id: string, patch: { plan?: string; bonusCredits?: number }) {
    setBusy(id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not update user.")
      setUsers((current) => current.map((user) => user.id === id ? data.user : user))
      if (patch.bonusCredits !== undefined) setBonus((current) => ({ ...current, [id]: "" }))
      setMessage(patch.bonusCredits !== undefined ? "Bonus credits granted." : "Plan updated.")
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update user.")
    } finally {
      setBusy("")
    }
  }

  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setBusy("settings")
    setError("")
    setMessage("")
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not save site settings.")
      setSettings(data.settings)
      setMessage("Site settings saved.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save site settings.")
    } finally {
      setBusy("")
    }
  }

  async function refreshPayments() {
    setPaymentsLoading(true)
    setPaymentsError("")
    setPaymentMessage("")
    try {
      setPendingPayments(await getPendingPayments())
    } catch (loadError) {
      setPaymentsError(loadError instanceof Error ? loadError.message : "Could not load pending UPI payments.")
    } finally {
      setPaymentsLoading(false)
    }
  }

  async function reviewPayment(id: string, status: "APPROVED" | "REJECTED") {
    if (paymentBusyRef.current) return
    paymentBusyRef.current = true
    setBusyPaymentId(id)
    setPaymentsError("")
    setPaymentMessage("")
    try {
      const response = await fetch(`/api/admin/upi-payments/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      })
      const data: { error?: string; success?: boolean; alreadyReviewed?: boolean } = await response.json().catch(() => ({}))
      if (response.status === 409) {
        setPaymentsError(data.error || "This payment was already reviewed. Refreshing the pending queue.")
        setPendingPayments(await getPendingPayments())
        return
      }
      if (!response.ok || data.success !== true) {
        throw new Error(data.error || `Could not review this payment (HTTP ${response.status}).`)
      }
      setPendingPayments((current) => current.filter((payment) => payment.id !== id))
      setPaymentMessage(data.alreadyReviewed
        ? "This payment was already reviewed. The queue has been updated."
        : `Payment request ${status.toLowerCase()}.`)
    } catch (reviewError) {
      setPaymentsError(reviewError instanceof Error ? reviewError.message : "Could not review this payment.")
    } finally {
      paymentBusyRef.current = false
      setBusyPaymentId("")
    }
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div id="overview" className="mb-8 scroll-mt-6">
        <Link href="/dashboard" className="mb-3 inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-400/10 text-amber-300"><Crown className="h-5 w-5" /></span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">Super Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">Manage member access, credits, and the public site.</p>
          </div>
        </div>
      </div>

      {(message || error) && <p role={error ? "alert" : "status"} className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"}`}>{error || message}</p>}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Members</p><p className="mt-2 text-3xl font-semibold text-white">{totalUsers}</p></div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Pro plans</p><p className="mt-2 text-3xl font-semibold text-indigo-300">{proUsers}</p></div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Free plans</p><p className="mt-2 text-3xl font-semibold text-zinc-200">{totalUsers - proUsers}</p></div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        <section id="users-credits" className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 scroll-mt-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <Users className="h-5 w-5 text-indigo-300" />
            <div><h2 className="font-semibold text-white">Members</h2><p className="text-xs text-zinc-500">Toggle Free / Pro access or add bonus credits.</p></div>
          </div>
          {users.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No members yet.</p> : (
            <div className="divide-y divide-zinc-800">
              {users.map((user) => (
                <article key={user.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{user.name || "New member"}</p>
                    <p className="truncate text-sm text-zinc-400">{user.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">Joined {new Date(user.createdAt).toLocaleDateString()} · <span className="text-indigo-300">{user.credits} credits</span></p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`plan-${user.id}`}>Plan for {user.email}</label>
                    <select id={`plan-${user.id}`} value={user.plan === "PRO" ? "PRO" : "FREE"} onChange={(event) => updateUser(user.id, { plan: event.target.value })} disabled={busy === user.id} className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 focus:border-indigo-400 focus:outline-none">
                      <option value="FREE">Free</option><option value="PRO">Pro</option>
                    </select>
                    <label className="sr-only" htmlFor={`bonus-${user.id}`}>Bonus credits for {user.email}</label>
                    <input id={`bonus-${user.id}`} type="number" min="1" max="100000" inputMode="numeric" value={bonus[user.id] ?? ""} onChange={(event) => setBonus((current) => ({ ...current, [user.id]: event.target.value }))} placeholder="Credits" className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-400 focus:outline-none" />
                    <button type="button" disabled={busy === user.id || !bonus[user.id] || Number(bonus[user.id]) < 1} onClick={() => updateUser(user.id, { bonusCredits: Number(bonus[user.id]) })} className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:opacity-40">
                      {busy === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Gift className="h-4 w-4" />} Grant
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section id="site-settings" className="rounded-3xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6 scroll-mt-6">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300"><Settings2 className="h-5 w-5" /></span>
            <div><h2 className="font-semibold text-white">Site settings</h2><p className="text-xs text-zinc-500">Homepage copy, starter credits, and INR pricing.</p></div>
          </div>
          <form onSubmit={saveSettings} className="space-y-4">
            <div><label htmlFor="hero-title" className="mb-1.5 block text-sm font-medium text-zinc-300">Homepage headline</label><input id="hero-title" maxLength={120} required value={settings.heroTitle} onChange={(event) => setSettings({ ...settings, heroTitle: event.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="hero-subtitle" className="mb-1.5 block text-sm font-medium text-zinc-300">Homepage description</label><textarea id="hero-subtitle" maxLength={500} required rows={4} value={settings.heroSubtitle} onChange={(event) => setSettings({ ...settings, heroSubtitle: event.target.value })} className="w-full resize-y rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm leading-6 text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="starter-credits" className="mb-1.5 block text-sm font-medium text-zinc-300">Starter Free Credits</label><input id="starter-credits" type="number" min="0" max="100000" step="1" inputMode="numeric" required value={settings.starterCredits} onChange={(event) => setSettings({ ...settings, starterCredits: Number(event.target.value) })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label htmlFor="weekly-price" className="mb-1.5 block text-sm font-medium text-zinc-300">Weekly price · ₹</label><input id="weekly-price" type="number" min="0" max="1000000" required value={settings.weeklyPriceInr} onChange={(event) => setSettings({ ...settings, weeklyPriceInr: Number(event.target.value) })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            </div>
              <div><label htmlFor="upi-id" className="mb-1.5 block text-sm font-medium text-zinc-300">UPI ID / VPA</label><input id="upi-id" type="text" maxLength={255} pattern="[A-Za-z0-9._-]+@[A-Za-z0-9.-]+" autoComplete="off" required value={settings.upiId} onChange={(event) => setSettings({ ...settings, upiId: event.target.value })} placeholder="name@bank" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-400 focus:outline-none" /><p className="mt-1 text-xs text-zinc-500">Used to generate customer UPI payment instructions.</p></div>
              <div><label htmlFor="upi-payee-name" className="mb-1.5 block text-sm font-medium text-zinc-300">UPI Payee Name</label><input id="upi-payee-name" type="text" maxLength={120} required value={settings.upiPayeeName} onChange={(event) => setSettings({ ...settings, upiPayeeName: event.target.value })} placeholder="Name shown in the UPI app" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-indigo-400 focus:outline-none" /></div>
            <button type="submit" disabled={busy === "settings"} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-400 disabled:opacity-50">
              {busy === "settings" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : message === "Site settings saved." ? <Check className="h-4 w-4" /> : <Save className="h-4 w-4" />} Save settings
            </button>
          </form>
        </section>
      </div>

      <section id="upi-payments" className="mt-6 scroll-mt-6 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70">
        <div className="flex flex-col gap-3 border-b border-zinc-800 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
              <ClipboardCheck className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              <div><h2 className="font-semibold text-white">Pending UPI payments</h2><p className="text-xs text-zinc-500">Review customer-submitted UTRs before deciding.</p></div>
          </div>
          <button type="button" onClick={refreshPayments} disabled={paymentsLoading || busyPaymentId !== ""} className="inline-flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
              <RefreshCw className={`h-4 w-4 ${paymentsLoading ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh queue
          </button>
        </div>

        <div className="border-b border-amber-400/20 bg-amber-950/20 px-5 py-4 text-sm leading-6 text-amber-100" role="note">
          Verify each transfer against your bank or UPI statement before approving. A submitted UTR is unverified; approval is the action that confirms the request.
        </div>

        {paymentsError && <p className="mx-5 mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-200" role="alert">{paymentsError}</p>}
        {paymentMessage && <p className="mx-5 mt-4 rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-4 py-3 text-sm text-emerald-200" role="status">{paymentMessage}</p>}

        {paymentsLoading ? (
          <p className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-400" role="status"><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> Loading pending payments…</p>
        ) : pendingPayments.length === 0 ? (
          <p className="p-8 text-center text-sm text-zinc-500">No pending UPI payment requests.</p>
        ) : (
          <div className="divide-y divide-zinc-800">
              {pendingPayments.map((payment) => (
                <article key={payment.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="grid min-w-0 gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-w-0"><p className="text-xs uppercase tracking-wide text-zinc-500">Customer</p><p className="mt-1 truncate font-medium text-white">{payment.user.name || "New member"}</p><p className="truncate text-sm text-zinc-400">{payment.user.email}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-zinc-500">Plan / pack</p><p className="mt-1 font-medium text-zinc-200">{payment.planOrPack.replaceAll("_", " ")}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-zinc-500">Amount · UTR</p><p className="mt-1 font-medium text-emerald-200">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(payment.amountInr)}</p><p className="break-all font-mono text-sm text-zinc-300">{payment.utrNumber}</p></div>
                    <div><p className="text-xs uppercase tracking-wide text-zinc-500">Submitted</p><time dateTime={payment.createdAt} className="mt-1 block text-sm text-zinc-300">{new Date(payment.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" })} UTC</time></div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => reviewPayment(payment.id, "APPROVED")} disabled={busyPaymentId !== ""} aria-label={`Approve payment from ${payment.user.email}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                      {busyPaymentId === payment.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CircleCheck className="h-4 w-4" aria-hidden="true" />} Approve
                    </button>
                    <button type="button" onClick={() => reviewPayment(payment.id, "REJECTED")} disabled={busyPaymentId !== ""} aria-label={`Reject payment from ${payment.user.email}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-950/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300 disabled:cursor-not-allowed disabled:opacity-50">
                      <CircleX className="h-4 w-4" aria-hidden="true" /> Reject
                    </button>
                  </div>
                </article>
              ))}
          </div>
        )}
      </section>

      <SupportInbox />
    </div>
  )
}
