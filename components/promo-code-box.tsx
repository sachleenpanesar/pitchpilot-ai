"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { useRouter } from "next/navigation"
import { LoaderCircle, TicketPercent } from "lucide-react"

export type RedeemedPromo = {
  code: string
  discountPercent: number
  credits: number
  creditsAdded: number
}

export default function PromoCodeBox({
  currentCredits,
  onRedeemed,
  onApply,
}: {
  currentCredits: number | null
  onRedeemed?: (promo: RedeemedPromo) => void
  onApply?: (promo: RedeemedPromo) => void
}) {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [promo, setPromo] = useState<RedeemedPromo | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [appliedCode, setAppliedCode] = useState("")

  async function redeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!code.trim() || busy) return
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/promo-codes/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data: {
        error?: string
        creditsAdded?: number
        credits?: number
        discountPercent?: number
      } = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not redeem code (HTTP ${response.status}).`)
      const redeemed: RedeemedPromo = {
        code: code.trim().toUpperCase(),
        creditsAdded: Number(data.creditsAdded) || 0,
        credits: Number(data.credits) || 0,
        discountPercent: Number(data.discountPercent) || 0,
      }
      setPromo(redeemed)
      if (redeemed.discountPercent > 0) {
        window.localStorage.setItem("redeemedPromoCode", redeemed.code)
      } else {
        window.localStorage.removeItem("redeemedPromoCode")
      }
      onRedeemed?.(redeemed)
      if (redeemed.discountPercent > 0 && onApply) {
        setAppliedCode(redeemed.code)
        onApply(redeemed)
      }
      router.refresh()
    } catch (redeemError) {
      setError(redeemError instanceof Error ? redeemError.message : "Could not redeem this code.")
    } finally {
      setBusy(false)
    }
  }

  function applyPromo() {
    if (!promo || promo.discountPercent <= 0) return
    window.localStorage.setItem("redeemedPromoCode", promo.code)
    setAppliedCode(promo.code)
    if (onApply) {
      onApply(promo)
    } else {
      router.push("/pricing#promo-checkout")
    }
  }

  return (
    <section aria-labelledby="promo-code-heading" className="rounded-2xl border border-indigo-400/20 bg-indigo-950/25 p-5 text-left">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-400/10 text-indigo-300">
          <TicketPercent className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="promo-code-heading" className="font-semibold text-white">Redeem a promo code</h2>
          <p className="mt-1 text-sm text-slate-400">Get bonus credits and unlock any checkout discount attached to your code.</p>
          {currentCredits !== null && <p className="mt-1 text-xs text-slate-500">Current balance: {promo?.credits ?? currentCredits} credits</p>}
        </div>
      </div>
      <form onSubmit={redeem} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="redeem-promo-code" className="sr-only">Promo code</label>
        <input
          id="redeem-promo-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          maxLength={64}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm uppercase text-white placeholder:normal-case placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
          placeholder="Enter your code"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !code.trim()} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 disabled:cursor-not-allowed disabled:opacity-50">
          {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {busy ? "Redeeming…" : "Redeem code"}
        </button>
      </form>
      {error && <p role="alert" className="mt-3 text-sm text-rose-300">{error}</p>}
      {promo && (
        <div className="mt-3 rounded-xl border border-emerald-400/20 bg-emerald-950/30 px-3 py-2.5 text-sm leading-6 text-emerald-100">
          <p role="status" aria-live="polite">
            <strong>{promo.code}</strong> redeemed: {promo.creditsAdded} credits added (balance: {promo.credits}).
            {promo.discountPercent > 0
              ? ` ${promo.discountPercent}% checkout discount is ready to apply.`
              : " No checkout discount is attached to this code."}
          </p>
          {promo.discountPercent > 0 && (
            <button
              type="button"
              onClick={applyPromo}
              className="mt-2 inline-flex min-h-9 items-center justify-center rounded-lg border border-emerald-300/40 px-3 py-1.5 text-xs font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {appliedCode === promo.code ? "Applied — view checkout" : "Apply discount"}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
