"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { FileText, Sparkles, LogOut, User as UserIcon, Shield, LogIn } from "lucide-react"

export default function Navbar() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        setUser(data.user)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setUser(null)
    router.push("/login")
    router.refresh()
  }

  return (
    <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-8">
          <Link href="/" className="flex items-center space-x-2 font-bold text-xl text-indigo-600">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            <span>CopilotAI</span>
          </Link>
          <nav className="hidden md:flex space-x-6">
            <Link href="/" className="text-gray-600 hover:text-indigo-600 font-medium">
              Home
            </Link>
            {user && (
              <Link href="/documents" className="text-gray-600 hover:text-indigo-600 font-medium flex items-center gap-1.5">
                <FileText className="w-4 h-4" />
                Documents Vault
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center space-x-4">
          {!loading && user ? (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 bg-indigo-50 px-3 py-1.5 rounded-full text-xs font-semibold text-indigo-700">
                <span>⚡ {user.credits} Credits</span>
                <span className="text-indigo-300">|</span>
                <span className="uppercase">{user.plan}</span>
              </div>

              <div className="flex items-center space-x-2 text-gray-700 font-medium text-sm">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span>{user.name || user.email}</span>
              </div>

              <button
                onClick={handleLogout}
                className="flex items-center space-x-1 text-gray-600 hover:text-red-600 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : !loading ? (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className="flex items-center space-x-1 text-gray-700 hover:text-indigo-600 text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-100 transition"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </Link>
              <Link
                href="/register"
                className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
              >
                Get Started
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
