"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import QRCode from "qrcode"
import { CheckCircle2, CreditCard, ExternalLink, LoaderCircle, QrCode, X } from "lucide-react"

type Product = "pro_weekly" | "pro_monthly" | "credits_25" | "credits_100"

type Offer = {
  product: Product
  name: string
  price: number | null
  description: string
  detail: string
}

const freeFeatures = [
  "Use your included starter credits",
  "Create and manage your interview materials",
  "Upgrade or add credits whenever you need",
]

export default function PricingOptions({
  weeklyPriceInr,
  monthlyPriceInr,
  upiId,
  upiPayeeName,
  currentPlan,
  currentCredits,
}: {
  weeklyPriceInr: number | null
  monthlyPriceInr: number | null
  upiId: string
  upiPayeeName: string
  currentPlan: string | null
  currentCredits: number | null
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(false)
  const upiBusyRef = useRef(false)
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null)
  const [selectedUpiOffer, setSelectedUpiOffer] = useState<Offer | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [utrNumber, setUtrNumber] = useState("")
  const [upiBusy, setUpiBusy] = useState(false)
  const [upiError, setUpiError] = useState("")
  const [upiSuccess, setUpiSuccess] = useState(false)
  const [submittedUtr, setSubmittedUtr] = useState("")
  const [qrDataUrl, setQrDataUrl] = useState<{ uri: string; dataUrl: string } | null>(null)
  const [qrError, setQrError] = useState<{ uri: string; message: string } | null>(null)
  const offers: Offer[] = [
    {
      product: "pro_weekly",
      name: "Pro Weekly",
      price: weeklyPriceInr,
      description: "A week of Pro access",
      detail: "For focused interview or pitch preparation.",
    },
    {
      product: "pro_monthly",
      name: "Pro Monthly",
      price: monthlyPriceInr,
      description: "A month of Pro access",
      detail: "For ongoing practice and client conversations.",
    },
    {
      product: "credits_25",
      name: "25 Credit Pack",
      price: 299,
      description: "25 additional credits",
      detail: "Add credits without changing your current plan.",
    },
    {
      product: "credits_100",
      name: "100 Credit Pack",
      price: 799,
      description: "100 additional credits",
      detail: "A larger credit pack for frequent use.",
    },
  ]

  useEffect(() => {
    if (!selectedOffer && !selectedUpiOffer) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const dialog = dialogRef.current
    dialog?.querySelector<HTMLElement>("[data-dialog-close]")?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current && !upiBusyRef.current) {
        setSelectedOffer(null)
        setSelectedUpiOffer(null)
        return
      }

      if (event.key === "Tab" && dialog) {
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        )
        if (focusable.length === 0) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [selectedOffer, selectedUpiOffer])

  const upiUri = selectedUpiOffer && upiId && upiPayeeName
    ? `upi://pay?${new URLSearchParams({
        pa: upiId,
        pn: upiPayeeName,
        am: String(selectedUpiOffer.price),
        cu: "INR",
      }).toString()}`
    : ""

  useEffect(() => {
    let cancelled = false
    if (!upiUri) return

    QRCode.toDataURL(upiUri, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 256,
      color: { dark: "#0f172a", light: "#ffffff" },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl({ uri: upiUri, dataUrl })
    }).catch(() => {
      if (!cancelled) setQrError({ uri: upiUri, message: "The QR code could not be generated. Use the UPI app link instead." })
    })

    return () => {
      cancelled = true
    }
  }, [upiUri])

  function openCheckout(offer: Offer) {
    if (offer.price === null) return
    setError("")
    setSuccess(false)
    setSelectedUpiOffer(null)
    setSelectedOffer(offer)
  }

  function openUpiCheckout(offer: Offer) {
    if (offer.price === null || !upiId || !upiPayeeName) return
    setUpiError("")
    setUpiSuccess(false)
    setSubmittedUtr("")
    setUtrNumber("")
    setSelectedOffer(null)
    setSelectedUpiOffer(offer)
  }

  async function submitUpiPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedUpiOffer || upiBusyRef.current) return
    if (!/^\d{12}$/.test(utrNumber)) {
      setUpiError("Enter a UTR number containing exactly 12 digits.")
      return
    }

    upiBusyRef.current = true
    setUpiBusy(true)
    setUpiError("")
    try {
      const response = await fetch("/api/billing/upi-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selectedUpiOffer.product, utrNumber }),
      })
      const data: {
        error?: string
        success?: boolean
        paymentRequest?: { status?: string }
      } = await response.json().catch(() => ({}))

      if (response.status === 401) {
        setUpiError("Sign in is required before submitting a payment reference.")
        return
      }
      if (response.status === 409) {
        setUpiError("This UTR number has already been submitted. Check the reference and try again.")
        return
      }
      if (response.status === 503) {
        setUpiError("Direct UPI payments are not configured right now. Please try another checkout option or contact support.")
        return
      }
      if (!response.ok) {
        setUpiError(data.error || `Payment reference could not be submitted (HTTP ${response.status}).`)
        return
      }

      if (response.status !== 201 || data.success !== true || data.paymentRequest?.status !== "PENDING") {
        setUpiError("The server returned an unexpected response. Check your pending requests before submitting again.")
        return
      }
      setSubmittedUtr(utrNumber)
      setUpiSuccess(true)
    } catch {
      setUpiError("Could not reach the payment service. Your reference may not have been submitted; check before retrying.")
    } finally {
      upiBusyRef.current = false
      setUpiBusy(false)
    }
  }

  async function simulateCheckout() {
    if (!selectedOffer || busy) return
    busyRef.current = true
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: selectedOffer.product, simulate: true }),
      })
      const data: { error?: string } = await response.json().catch(() => ({}))

      if (response.status === 401) {
        setError("Sign in is required before starting this demo checkout.")
        return
      }
      if (response.status === 402) {
        setError(data.error || "The checkout service could not complete this request (402). No payment was made.")
        return
      }
      if (!response.ok) {
        setError(data.error || `Checkout could not be completed (HTTP ${response.status}). No payment was made.`)
        return
      }

      setSuccess(true)
      router.refresh()
    } catch {
      setError("Could not reach checkout. No payment was made; please try again.")
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
      <header className="mx-auto mb-10 max-w-3xl text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">PitchPilot plans</p>
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-5xl">Choose how you want to prepare</h1>
        <p className="mt-4 text-zinc-400">Start with Free, choose a Pro access period, or top up with a credit pack.</p>
        {currentCredits !== null && (
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            Current balance <strong className="font-semibold text-white">{currentCredits} credits</strong>
            {currentPlan && <span className="text-emerald-100/70">· {currentPlan}</span>}
          </p>
        )}
      </header>

      <section aria-labelledby="plans-heading" className="mb-12">
        <h2 id="plans-heading" className="sr-only">Free and Pro subscription plans</h2>
        <div className="grid gap-5 md:grid-cols-3">
          <article className="flex flex-col rounded-3xl border border-slate-700 bg-slate-900/70 p-6 sm:p-8">
            <div>
              <p className="text-sm font-semibold text-slate-300">Free</p>
              <p className="mt-3 text-4xl font-bold text-white">₹0</p>
              <p className="mt-2 text-sm text-slate-400">Get started at your own pace.</p>
              <ul className="mt-6 space-y-3 text-sm text-slate-300">
                {freeFeatures.map((feature) => (
                  <li key={feature} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
            {currentPlan === "FREE" ? (
              <span className="mt-8 rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-slate-300">Your current plan</span>
            ) : (
              <Link href="/register" className="mt-8 rounded-xl border border-slate-700 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                Start Free
              </Link>
            )}
          </article>

          {offers.slice(0, 2).map((offer) => (
            <article key={offer.product} className={`relative flex flex-col rounded-3xl border p-6 sm:p-8 ${offer.product === "pro_monthly" ? "border-emerald-400/50 bg-gradient-to-b from-emerald-950/35 to-slate-900/80" : "border-slate-700 bg-slate-900/70"}`}>
              {offer.product === "pro_monthly" && <span className="absolute -top-3 left-6 rounded-full bg-emerald-400 px-3 py-1 text-xs font-bold uppercase tracking-wide text-slate-950">Pro</span>}
              <div>
                <p className="text-sm font-semibold text-slate-300">{offer.name}</p>
                <p className="mt-3 text-4xl font-bold text-white">{offer.price === null ? "Unavailable" : <>₹{offer.price}<span className="ml-1 text-sm font-normal text-slate-400">INR</span></>}</p>
                <p className="mt-2 text-sm text-slate-300">{offer.description}</p>
                <p className="mt-3 min-h-10 text-sm leading-6 text-slate-400">{offer.detail}</p>
                <p className="mt-4 text-xs text-slate-500">Demo checkout only · not a real payment</p>
              </div>
              <button type="button" onClick={() => openCheckout(offer)} disabled={offer.price === null} className="mt-8 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                <CreditCard className="h-4 w-4" aria-hidden="true" /> {offer.price === null ? "Price unavailable" : "Continue to demo checkout"}
              </button>
              <button type="button" onClick={() => openUpiCheckout(offer)} disabled={offer.price === null || !upiId || !upiPayeeName} className="mt-3 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-3 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <QrCode className="h-4 w-4" aria-hidden="true" /> {offer.price === null ? "Price unavailable" : upiId && upiPayeeName ? "Direct UPI / Google Pay" : "UPI not configured"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="credits-heading">
        <div className="mb-5">
          <h2 id="credits-heading" className="text-2xl font-bold text-white">Credit packs</h2>
          <p className="mt-2 text-sm text-slate-400">Choose a demo simulation or pay directly by UPI. The demo does not charge a payment method.</p>
          {upiId && upiPayeeName ? (
            <p className="mt-3 text-xs text-slate-500">UPI recipient: <span className="text-slate-300">{upiPayeeName}</span> · <span className="font-mono text-slate-300">{upiId}</span></p>
          ) : (
            <p className="mt-3 text-xs text-amber-200" role="status">Direct UPI checkout is not configured at the moment.</p>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.slice(2).map((offer) => (
            <article key={offer.product} className="flex flex-col justify-between gap-5 rounded-2xl border border-slate-700 bg-slate-900/60 p-5 sm:flex-row sm:items-center">
              <div>
                <h3 className="font-semibold text-white">{offer.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{offer.description} · {offer.price === null ? "Price unavailable" : `₹${offer.price}`}</p>
              </div>
              <button type="button" onClick={() => openCheckout(offer)} disabled={offer.price === null} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <CreditCard className="h-4 w-4" aria-hidden="true" /> {offer.price === null ? "Price unavailable" : "Demo checkout"}
              </button>
              <button type="button" onClick={() => openUpiCheckout(offer)} disabled={offer.price === null || !upiId || !upiPayeeName} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-2.5 text-sm font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                <QrCode className="h-4 w-4" aria-hidden="true" /> {upiId && upiPayeeName ? "Direct UPI / Google Pay" : "UPI not configured"}
              </button>
            </article>
          ))}
        </div>
      </section>

      {selectedOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !busy) setSelectedOffer(null)
        }}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="checkout-title"
            aria-describedby="checkout-description"
            className="my-auto w-full max-w-lg rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Test / demo flow</p>
                <h2 id="checkout-title" className="mt-2 text-2xl font-bold text-white">Checkout preview</h2>
              </div>
              <button type="button" data-dialog-close onClick={() => setSelectedOffer(null)} disabled={busy} aria-label="Close checkout" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-950/70 p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-white">{selectedOffer.name}</p>
                  <p className="mt-1 text-sm text-slate-400">{selectedOffer.description}</p>
                </div>
                <p className="shrink-0 text-xl font-bold text-white">₹{selectedOffer.price}</p>
              </div>
              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">UPI / Razorpay-style preview</p>
                <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300"><CreditCard className="h-4 w-4" aria-hidden="true" /></span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">Demo payment simulation</p>
                    <p className="text-xs text-slate-500">No UPI app, card, or payment gateway is connected.</p>
                  </div>
                </div>
              </div>
            </div>

            <p id="checkout-description" className="mt-4 text-sm leading-6 text-slate-400">
              This test flow sends a simulated checkout request. It does not collect payment details or process a real payment.
            </p>
            {error && (
              <div className="mt-4 rounded-xl border border-rose-400/30 bg-rose-950/30 p-3 text-sm text-rose-200" role="alert">
                <p>{error}</p>
                {error.startsWith("Sign in is required") && <Link href="/login" className="mt-2 inline-block font-semibold underline underline-offset-2">Sign in</Link>}
              </div>
            )}
            {success && (
              <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-950/30 p-3 text-sm text-emerald-200" role="status">
                Demo checkout completed. No real payment was processed. Your displayed account balance and plan are being refreshed.
              </p>
            )}

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedOffer(null)} disabled={busy} className="min-h-11 rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-50">
                {success ? "Close" : "Cancel"}
              </button>
              {!success && (
                <button type="button" onClick={simulateCheckout} disabled={busy || process.env.NODE_ENV === "production"} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-50">
                  {busy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {process.env.NODE_ENV === "production" ? "Simulation unavailable in production" : busy ? "Running simulation…" : "Simulate Instant Payment"}
                </button>
              )}
            </div>
            <p className="mt-4 text-center text-xs text-slate-500">This simulation is only enabled outside production.</p>
          </div>
        </div>
      )}

      {selectedUpiOffer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !upiBusy) setSelectedUpiOffer(null)
        }}>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="upi-checkout-title"
            aria-describedby="upi-checkout-description"
            className="my-auto w-full max-w-xl rounded-3xl border border-slate-700 bg-slate-900 p-6 shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">Direct UPI checkout</p>
                <h2 id="upi-checkout-title" className="mt-2 text-2xl font-bold text-white">{selectedUpiOffer.name}</h2>
              </div>
              <button type="button" data-dialog-close onClick={() => setSelectedUpiOffer(null)} disabled={upiBusy} aria-label="Close UPI checkout" className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-400 disabled:opacity-50">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <p id="upi-checkout-description" className="mt-4 text-sm leading-6 text-slate-400">
              Pay the exact amount below to the recipient using any UPI app. Then enter the 12-digit UTR from your payment receipt. Submitting a UTR only creates a pending review request.
            </p>

            <div className="mt-5 grid gap-5 rounded-2xl border border-slate-700 bg-slate-950/70 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Exact amount to pay</p>
                <p className="mt-1 text-3xl font-bold text-white" aria-label={`${selectedUpiOffer.price} Indian rupees`}>
                  ₹{selectedUpiOffer.price}<span className="ml-2 text-sm font-medium text-slate-400">INR</span>
                </p>
                <p className="mt-4 text-sm font-medium text-slate-200">{upiPayeeName}</p>
                <p className="break-all font-mono text-sm text-emerald-200">{upiId}</p>
              </div>
              <div className="mx-auto flex min-h-48 w-48 items-center justify-center rounded-xl bg-white p-2 sm:mx-0" aria-live="polite">
                {qrDataUrl?.uri === upiUri ? (
                  // Generated in this browser from the UPI URI; no QR service receives payment details.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={qrDataUrl.dataUrl} alt={`UPI payment QR code for ₹${selectedUpiOffer.price}`} className="h-44 w-44" />
                ) : qrError?.uri === upiUri ? (
                  <p className="px-3 text-center text-xs text-rose-700">{qrError.message}</p>
                ) : (
                  <p className="text-center text-xs text-slate-600">Preparing secure local QR…</p>
                )}
              </div>
            </div>

            {upiUri && (
              <a href={upiUri} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300">
                <ExternalLink className="h-4 w-4" aria-hidden="true" /> Pay with Google Pay / UPI App
              </a>
            )}

            {upiSuccess ? (
              <div className="mt-5 rounded-xl border border-amber-400/30 bg-amber-950/25 p-4 text-sm text-amber-100" role="status">
                <p className="font-semibold">UTR submitted for pending review</p>
                <p className="mt-1">Reference {submittedUtr} has been recorded. This is not payment verification; your plan and credits have not changed. An administrator must review the payment.</p>
              </div>
            ) : (
              <form onSubmit={submitUpiPayment} className="mt-5 space-y-3">
                <label htmlFor="upi-utr" className="block text-sm font-medium text-slate-200">12-digit UTR / transaction reference</label>
                <input
                  id="upi-utr"
                  name="utrNumber"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  pattern="[0-9]{12}"
                  maxLength={12}
                  required
                  value={utrNumber}
                  onChange={(event) => setUtrNumber(event.target.value.replace(/\D/g, "").slice(0, 12))}
                  aria-describedby="utr-hint"
                  className="min-h-11 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5 font-mono text-white placeholder:text-slate-600 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
                  placeholder="123456789012"
                  disabled={upiBusy}
                />
                <p id="utr-hint" className="text-xs text-slate-500">Use the UTR shown in your UPI app after completing the transfer.</p>
                {upiError && (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-3 text-sm text-rose-200" role="alert">
                    <p>{upiError}</p>
                    {upiError.startsWith("Sign in is required") && <Link href="/login" className="mt-2 inline-block font-semibold underline underline-offset-2">Sign in</Link>}
                  </div>
                )}
                <button type="submit" disabled={upiBusy || utrNumber.length !== 12} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/40 px-4 py-3 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:cursor-not-allowed disabled:opacity-50">
                  {upiBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                  {upiBusy ? "Submitting reference…" : "Submit UTR for review"}
                </button>
              </form>
            )}

            <p className="mt-4 text-center text-xs leading-5 text-slate-500">Do not submit a UTR before completing the transfer. Payment requests remain pending until manually reviewed.</p>
          </div>
        </div>
      )}
    </div>
  )
}
