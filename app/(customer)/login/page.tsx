"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Sparkles } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [step, setStep] = useState<"credentials" | "otp">("credentials")
  const [requestState, setRequestState] = useState<"idle" | "login" | "verify" | "resend">("idle")
  const requestInProgress = useRef(false)
  const router = useRouter()

  const readResponse = async (res: Response) => {
    try {
      return (await res.json()) as { error?: string; requiresOtp?: boolean; email?: string }
    } catch {
      return {}
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requestInProgress.current) return

    requestInProgress.current = true
    setRequestState("login")
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await readResponse(res)

      if (!res.ok) {
        throw new Error(data.error || "Failed to login")
      }

      if (!data.requiresOtp) {
        throw new Error(data.error || "Unable to start email verification")
      }

      if (data.email) setEmail(data.email)
      setCode("")
      setStep("otp")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      requestInProgress.current = false
      setRequestState("idle")
    }
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (requestInProgress.current || code.length !== 6) return

    requestInProgress.current = true
    setRequestState("verify")
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      })
      const data = await readResponse(res)

      if (!res.ok) {
        throw new Error(data.error || "Failed to verify code")
      }

      router.push("/documents")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      requestInProgress.current = false
      setRequestState("idle")
    }
  }

  const handleResend = async () => {
    if (requestInProgress.current) return

    requestInProgress.current = true
    setRequestState("resend")
    setError("")
    setMessage("")

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await readResponse(res)

      if (!res.ok) {
        throw new Error(data.error || "Failed to resend code")
      }

      if (!data.requiresOtp) {
        throw new Error(data.error || "Unable to resend verification code")
      }

      if (data.email) setEmail(data.email)
      setCode("")
      setMessage("A new verification code has been sent.")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      requestInProgress.current = false
      setRequestState("idle")
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl shadow-sm border">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600 mb-3">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">
            {step === "credentials" ? "Sign in to your account" : "Check your email"}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {step === "credentials"
              ? "Access your documents, STAR stories, and career copilot"
              : `Enter the 6-digit verification code sent to ${email}`}
          </p>
        </div>

        {error && (
          <div role="alert" className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center">
            {error}
          </div>
        )}
        {message && (
          <div role="status" className="bg-green-50 text-green-700 p-3 rounded-lg text-sm text-center">
            {message}
          </div>
        )}

        {step === "credentials" ? (
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="alex@example.com"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={requestState !== "idle"}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {requestState === "login" ? "Signing in..." : "Sign In"}
            </button>

            <div className="text-center text-sm">
              <span className="text-gray-600">Don't have an account? </span>
              <Link href="/register" className="font-medium text-indigo-600 hover:text-indigo-500">
                Sign Up
              </Link>
            </div>
          </form>
        ) : (
          <div className="mt-8 space-y-5">
            <form className="space-y-5" onSubmit={handleVerify}>
              <div>
                <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700">
                  6-digit verification code
                </label>
                <input
                  id="verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-400 shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm tracking-[0.3em] text-center"
                  placeholder="000000"
                  aria-describedby="verification-code-help"
                />
                <p id="verification-code-help" className="mt-2 text-xs text-gray-500">
                  Enter the code from your email.
                </p>
              </div>

              <button
                type="submit"
                disabled={requestState !== "idle" || code.length !== 6}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {requestState === "verify" ? "Verifying..." : "Verify Code"}
              </button>
            </form>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={handleResend}
                disabled={requestState !== "idle"}
                className="font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline disabled:opacity-50"
              >
                {requestState === "resend" ? "Sending..." : "Resend Code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setStep("credentials")
                  setCode("")
                  setError("")
                  setMessage("")
                }}
                disabled={requestState !== "idle"}
                className="font-medium text-gray-600 hover:text-gray-800 focus:outline-none focus:underline disabled:opacity-50"
              >
                Change email
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
