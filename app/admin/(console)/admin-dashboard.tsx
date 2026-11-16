"use client"

import { useEffect, useRef, useState } from "react"
import { ArrowLeft, Check, CircleCheck, CircleX, ClipboardCheck, Crown, Gift, LoaderCircle, RefreshCw, Save, Settings2, TicketPercent, Trash2, Users } from "lucide-react"
import Link from "next/link"
import SupportInbox from "./support-inbox"

type User = {
  id: string
  name: string | null
  email: string
  plan: string
  credits: number
  proExpiresAt: string | Date | null
  createdAt: string | Date
}

type PromoCode = {
  id: string
  code: string
  bonusCredits: number
  discountPercent: number
  maxUses: number | null
  expiresAt: string | null
  isActive: boolean
  uses?: number
  usedCount?: number
}

type PromoForm = {
  code: string
  bonusCredits: string
  discountPercent: string
  maxUses: string
  expiresAt: string
  isActive: boolean
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
  const [activeTab, setActiveTab] = useState<"members" | "promos">("members")
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([])
  const [promoLoading, setPromoLoading] = useState(true)
  const [promoBusy, setPromoBusy] = useState(false)
  const [promoError, setPromoError] = useState("")
  const [promoMessage, setPromoMessage] = useState("")
  const [busyPromoId, setBusyPromoId] = useState("")
  const [promoForm, setPromoForm] = useState<PromoForm>({
    code: "", bonusCredits: "0", discountPercent: "0", maxUses: "", expiresAt: "", isActive: true,
  })
  const [summary, setSummary] = useState<{ approvedRevenueInr: number; aiCreditsUsed: number } | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState("")

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

  async function loadPromoCodes(signal?: AbortSignal) {
    const response = await fetch("/api/admin/promo-codes", { cache: "no-store", signal })
    const data: { error?: string; promoCodes?: PromoCode[]; codes?: PromoCode[] } = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Could not load promo codes (HTTP ${response.status}).`)
    return Array.isArray(data.promoCodes) ? data.promoCodes : Array.isArray(data.codes) ? data.codes : []
  }

  useEffect(() => {
    const controller = new AbortController()
    loadPromoCodes(controller.signal)
      .then(setPromoCodes)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setPromoError(loadError instanceof Error ? loadError.message : "Could not load promo codes.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setPromoLoading(false)
      })
    fetch("/api/admin/summary", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data: { error?: string; approvedRevenueInr?: number; aiCreditsUsed?: number } = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Could not load revenue summary (HTTP ${response.status}).`)
        setSummary({
          approvedRevenueInr: Number(data.approvedRevenueInr) || 0,
          aiCreditsUsed: Number(data.aiCreditsUsed) || 0,
        })
      })
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setSummaryError(loadError instanceof Error ? loadError.message : "Could not load revenue summary.")
      })
      .finally(() => {
        if (!controller.signal.aborted) setSummaryLoading(false)
      })
    return () => controller.abort()
  }, [])

  async function refreshUsers() {
    const response = await fetch("/api/admin/users", { cache: "no-store" })
    const data: { error?: string; users?: User[] } = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || `Could not refresh members (HTTP ${response.status}).`)
    if (Array.isArray(data.users)) setUsers(data.users)
  }

  async function updateUser(id: string, patch: { plan?: string; bonusCredits?: number; extendProDays?: 7 | 30 }) {
    setBusy(id)
    setError("")
    setMessage("")
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      })
      const data: { error?: string; user?: User } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not update user.")
      if (patch.extendProDays !== undefined) {
        await refreshUsers()
      } else if (data.user) {
        setUsers((current) => current.map((user) => user.id === id ? data.user! : user))
      }
      if (patch.bonusCredits !== undefined) setBonus((current) => ({ ...current, [id]: "" }))
      setMessage(patch.bonusCredits !== undefined
        ? "Bonus credits granted."
        : patch.extendProDays !== undefined
          ? `Pro extended by ${patch.extendProDays} days. Member list refreshed.`
          : "Plan updated.")
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Could not update user.")
    } finally {
      setBusy("")
    }
  }

  async function createPromoCode(event: React.FormEvent<HTMLFormElement>) {
      event.preventDefault()
      setPromoBusy(true)
      setPromoError("")
      setPromoMessage("")
      try {
        const response = await fetch("/api/admin/promo-codes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            code: promoForm.code.trim(),
            bonusCredits: Number(promoForm.bonusCredits),
            discountPercent: Number(promoForm.discountPercent),
            maxUses: promoForm.maxUses ? Number(promoForm.maxUses) : null,
            expiresAt: promoForm.expiresAt ? new Date(promoForm.expiresAt).toISOString() : null,
            isActive: promoForm.isActive,
          }),
        })
        const data: { error?: string; promoCode?: PromoCode; code?: PromoCode } = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Could not create promo code (HTTP ${response.status}).`)
        const created = data.promoCode || data.code
        setPromoCodes((current) => created ? [created, ...current] : current)
        if (!created) setPromoCodes(await loadPromoCodes())
        setPromoForm({ code: "", bonusCredits: "0", discountPercent: "0", maxUses: "", expiresAt: "", isActive: true })
        setPromoMessage("Promo code created.")
      } catch (createError) {
        setPromoError(createError instanceof Error ? createError.message : "Could not create promo code.")
      } finally {
        setPromoBusy(false)
      }
  }

  async function deletePromoCode(id: string) {
      setBusyPromoId(id)
      setPromoError("")
      setPromoMessage("")
      try {
        const response = await fetch(`/api/admin/promo-codes/${encodeURIComponent(id)}`, { method: "DELETE" })
        const data: { error?: string } = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || `Could not delete promo code (HTTP ${response.status}).`)
        setPromoCodes((current) => current.filter((promo) => promo.id !== id))
        setPromoMessage("Promo code deleted.")
      } catch (deleteError) {
        setPromoError(deleteError instanceof Error ? deleteError.message : "Could not delete promo code.")
      } finally {
        setBusyPromoId("")
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

      <section aria-labelledby="revenue-usage-heading" className="mb-6 rounded-3xl border border-emerald-400/20 bg-gradient-to-r from-emerald-950/30 to-zinc-900/80 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="revenue-usage-heading" className="font-semibold text-white">Revenue &amp; Usage</h2>
            <p className="mt-1 text-xs text-zinc-400">Approved payment revenue and recorded AI credit usage.</p>
          </div>
          {summaryLoading ? <p role="status" className="text-sm text-zinc-400">Loading summary…</p> : summaryError ? (
            <p role="alert" className="text-sm text-rose-300">{summaryError}</p>
          ) : summary && (
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-6">
              <div><p className="text-xs uppercase tracking-wider text-zinc-500">Approved revenue</p><p className="mt-1 text-2xl font-semibold text-emerald-200">{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(summary.approvedRevenueInr)}</p></div>
              <div><p className="text-xs uppercase tracking-wider text-zinc-500">AI credits used</p><p className="mt-1 text-2xl font-semibold text-white">{new Intl.NumberFormat("en-IN").format(summary.aiCreditsUsed)}</p></div>
            </div>
          )}
        </div>
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Members</p><p className="mt-2 text-3xl font-semibold text-white">{totalUsers}</p></div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Pro plans</p><p className="mt-2 text-3xl font-semibold text-indigo-300">{proUsers}</p></div>
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5"><p className="text-xs uppercase tracking-wider text-zinc-500">Free plans</p><p className="mt-2 text-3xl font-semibold text-zinc-200">{totalUsers - proUsers}</p></div>
      </div>

      <div role="tablist" aria-label="Admin member tools" className="mb-4 flex flex-wrap gap-2">
        <button id="members-tab" type="button" role="tab" aria-selected={activeTab === "members"} aria-controls="members-tabpanel" onClick={() => setActiveTab("members")} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${activeTab === "members" ? "bg-indigo-500 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}>Members</button>
        <button id="promo-tab" type="button" role="tab" aria-selected={activeTab === "promos"} aria-controls="promo-tabpanel" onClick={() => setActiveTab("promos")} className={`min-h-10 rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 ${activeTab === "promos" ? "bg-indigo-500 text-white" : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"}`}><span className="inline-flex items-center gap-2"><TicketPercent className="h-4 w-4" aria-hidden="true" /> Promo Codes</span></button>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.75fr)]">
        {activeTab === "members" ? <section id="members-tabpanel" role="tabpanel" aria-labelledby="members-tab" className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70 scroll-mt-6">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <Users className="h-5 w-5 text-indigo-300" />
            <div><h2 className="font-semibold text-white">Members</h2><p className="text-xs text-zinc-500">Manage plan access, Pro expiry, and bonus credits.</p></div>
          </div>
          {users.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No members yet.</p> : (
            <div className="divide-y divide-zinc-800">
              {users.map((user) => (
                <article key={user.id} className="grid gap-4 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">{user.name || "New member"}</p>
                    <p className="truncate text-sm text-zinc-400">{user.email}</p>
                    <p className="mt-1 text-xs text-zinc-500">Joined {new Date(user.createdAt).toLocaleDateString()} · <span className="text-indigo-300">{user.credits} credits</span></p>
                    <p className="mt-1 text-xs text-zinc-400">Pro expiry: <span className="text-zinc-200">{user.proExpiresAt ? new Date(user.proExpiresAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Not set"}</span></p>
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
                    <button type="button" disabled={busy === user.id} onClick={() => updateUser(user.id, { extendProDays: 7 })} className="min-h-10 rounded-lg border border-indigo-400/30 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-50">
                      {busy === user.id ? <LoaderCircle className="inline h-4 w-4 animate-spin" aria-hidden="true" /> : null} +7 Days (Weekly)
                    </button>
                    <button type="button" disabled={busy === user.id} onClick={() => updateUser(user.id, { extendProDays: 30 })} className="min-h-10 rounded-lg border border-indigo-400/30 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-50">
                      {busy === user.id ? <LoaderCircle className="inline h-4 w-4 animate-spin" aria-hidden="true" /> : null} +30 Days (Monthly)
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section> : <section id="promo-tabpanel" role="tabpanel" aria-labelledby="promo-tab" className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/70">
          <div className="flex items-center gap-3 border-b border-zinc-800 px-5 py-4">
            <TicketPercent className="h-5 w-5 text-indigo-300" aria-hidden="true" />
            <div><h2 className="font-semibold text-white">Promo Codes</h2><p className="text-xs text-zinc-500">Create credit bonuses and checkout discounts.</p></div>
          </div>
          <form onSubmit={createPromoCode} className="grid gap-4 border-b border-zinc-800 p-5 sm:grid-cols-2">
            <div><label htmlFor="promo-code" className="mb-1.5 block text-sm font-medium text-zinc-300">Code</label><input id="promo-code" required maxLength={64} value={promoForm.code} onChange={(event) => setPromoForm({ ...promoForm, code: event.target.value })} autoComplete="off" className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm uppercase text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="promo-credits" className="mb-1.5 block text-sm font-medium text-zinc-300">Bonus credits</label><input id="promo-credits" type="number" min="0" max="1000000" step="1" required value={promoForm.bonusCredits} onChange={(event) => setPromoForm({ ...promoForm, bonusCredits: event.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="promo-discount" className="mb-1.5 block text-sm font-medium text-zinc-300">Discount percent</label><input id="promo-discount" type="number" min="0" max="100" step="1" required value={promoForm.discountPercent} onChange={(event) => setPromoForm({ ...promoForm, discountPercent: event.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="promo-max-uses" className="mb-1.5 block text-sm font-medium text-zinc-300">Maximum uses <span className="text-zinc-500">(optional)</span></label><input id="promo-max-uses" type="number" min="1" max="10000000" step="1" value={promoForm.maxUses} onChange={(event) => setPromoForm({ ...promoForm, maxUses: event.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <div><label htmlFor="promo-expires" className="mb-1.5 block text-sm font-medium text-zinc-300">Expiry <span className="text-zinc-500">(optional)</span></label><input id="promo-expires" type="datetime-local" value={promoForm.expiresAt} onChange={(event) => setPromoForm({ ...promoForm, expiresAt: event.target.value })} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-indigo-400 focus:outline-none" /></div>
            <label className="flex min-h-11 items-center gap-2 self-end text-sm text-zinc-300"><input type="checkbox" checked={promoForm.isActive} onChange={(event) => setPromoForm({ ...promoForm, isActive: event.target.checked })} className="h-4 w-4 rounded border-zinc-600 bg-zinc-950 text-indigo-500 focus:ring-indigo-400" /> Active</label>
            {(promoError || promoMessage) && <p role={promoError ? "alert" : "status"} className={`sm:col-span-2 rounded-xl border px-3 py-2 text-sm ${promoError ? "border-red-500/30 bg-red-950/30 text-red-200" : "border-emerald-500/30 bg-emerald-950/30 text-emerald-200"}`}>{promoError || promoMessage}</p>}
            <button type="submit" disabled={promoBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2 sm:justify-self-start">
              {promoBusy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />} Create promo code
            </button>
          </form>
          {promoLoading ? <p role="status" className="p-8 text-center text-sm text-zinc-400">Loading promo codes…</p> : promoCodes.length === 0 ? <p className="p-8 text-center text-sm text-zinc-500">No promo codes created yet.</p> : (
            <div className="divide-y divide-zinc-800">
              {promoCodes.map((promo) => (
                <article key={promo.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-semibold text-white">{promo.code} <span className={`ml-2 rounded-full px-2 py-0.5 text-[11px] ${promo.isActive ? "bg-emerald-400/10 text-emerald-200" : "bg-zinc-700 text-zinc-300"}`}>{promo.isActive ? "Active" : "Inactive"}</span></p>
                    <p className="mt-1 text-sm text-zinc-400">{promo.bonusCredits} bonus credits · {promo.discountPercent}% discount</p>
                    <p className="mt-1 text-xs text-zinc-500">Uses {promo.usedCount ?? promo.uses ?? 0}{promo.maxUses ? ` / ${promo.maxUses}` : ""} · Expires {promo.expiresAt ? new Date(promo.expiresAt).toLocaleString() : "Never"}</p>
                  </div>
                  <button type="button" onClick={() => void deletePromoCode(promo.id)} disabled={busyPromoId !== ""} className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 self-start rounded-lg border border-rose-400/30 px-3 py-2 text-sm text-rose-200 hover:bg-rose-950/40 disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto">
                    {busyPromoId === promo.id ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Trash2 className="h-4 w-4" aria-hidden="true" />} Delete
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>}

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

      <SupportInbox upiId={settings.upiId} upiPayeeName={settings.upiPayeeName} />
    </div>
  )
}
