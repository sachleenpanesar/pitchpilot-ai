"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"

const paymentLine = /UPI payment link:\s*(upi:\/\/pay\?[^\s]+)/i

function isValidUpiPayUri(value: string) {
  try {
    const url = new URL(value)
    const amount = url.searchParams.get("am") || ""
    return url.protocol === "upi:"
      && url.hostname === "pay"
      && Boolean(url.searchParams.get("pa"))
      && Boolean(url.searchParams.get("pn"))
      && url.searchParams.get("cu") === "INR"
      && /^\d+(?:\.\d{1,2})?$/.test(amount)
      && Number(amount) > 0
  } catch {
    return false
  }
}

function LocalPaymentQr({ uri, amount }: { uri: string; amount: string }) {
  const [dataUrl, setDataUrl] = useState("")
  useEffect(() => {
    let active = true
    QRCode.toDataURL(uri, { errorCorrectionLevel: "M", margin: 2, width: 192 })
      .then((result) => { if (active) setDataUrl(result) })
      .catch(() => { if (active) setDataUrl("") })
    return () => { active = false }
  }, [uri])

  return dataUrl ? (
    // Generated in this browser; the UPI URI is not sent to an external QR service.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={dataUrl} alt={`Local UPI payment QR code for ₹${amount}`} className="mt-2 h-36 w-36 rounded-lg bg-white p-1" />
  ) : (
    <span className="mt-2 block text-xs text-zinc-400">Payment QR could not be generated; use the UPI link.</span>
  )
}

export default function SupportMessageContent({ message }: { message: string }) {
  const match = paymentLine.exec(message)
  const uri = match?.[1] && isValidUpiPayUri(match[1]) ? match[1] : ""
  const before = uri && match ? message.slice(0, match.index) + "UPI payment link: " : message
  const after = uri && match ? message.slice(match.index + match[0].length) : ""
  const amount = uri ? new URL(uri).searchParams.get("am") || "" : ""

  return (
    <>
      <p className="whitespace-pre-wrap break-words text-sm leading-6">{before}</p>
      {uri && (
        <div className="mt-2 rounded-lg border border-zinc-700/70 bg-black/10 p-2">
          <a href={uri} className="break-all text-sm font-medium underline underline-offset-2" rel="noreferrer">
            Open UPI payment link
          </a>
          <LocalPaymentQr uri={uri} amount={amount} />
        </div>
      )}
      {after && <p className="whitespace-pre-wrap break-words text-sm leading-6">{after}</p>}
    </>
  )
}
