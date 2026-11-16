import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { createHmac, randomBytes } from "node:crypto"
import { prisma } from "@/lib/prisma"

const rawJwtSecret = process.env.JWT_SECRET
const configuredJwtSecret = rawJwtSecret?.trim()
  || process.env.AUTH_SECRET?.trim()
  || process.env.NEXTAUTH_SECRET?.trim()
const databaseUrl = process.env.DATABASE_URL?.trim()
const JWT_SECRET = configuredJwtSecret
  || (databaseUrl
    ? createHmac("sha256", databaseUrl).update("pitchpilot-jwt-signing-key-v1").digest("hex")
    : randomBytes(32).toString("hex"))
const JWT_VERIFY_SECRETS = [
  JWT_SECRET,
  ...(configuredJwtSecret && rawJwtSecret && rawJwtSecret !== configuredJwtSecret
    ? [rawJwtSecret]
    : []),
]
const ADMIN_TOKEN_AUDIENCE = "pitchpilot-admin-console"

if (!configuredJwtSecret && process.env.NODE_ENV === "production") {
  console.warn(
    databaseUrl
      ? "JWT_SECRET is unset or blank; using a stable key derived from DATABASE_URL. Configure JWT_SECRET for independent signing."
      : "JWT_SECRET is unset or blank; using a process-local fallback. Authentication tokens may not survive restarts or work across instances.",
  )
}

export interface AuthPayload {
  userId: string
  email: string
  role: string
  plan: string
}

export function signToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}

function verifyJwt(token: string, options?: jwt.VerifyOptions): jwt.JwtPayload | string {
  let lastError: unknown
  for (const secret of JWT_VERIFY_SECRETS) {
    try {
      return jwt.verify(token, secret, options)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError
}

export function verifyToken(token: string): AuthPayload | null {
  try {
    return verifyJwt(token) as AuthPayload
  } catch {
    return null
  }
}

export function signAdminToken(payload: AuthPayload): string {
  return jwt.sign(
    { ...payload, sessionType: "admin" },
    JWT_SECRET,
    { expiresIn: "8h", audience: ADMIN_TOKEN_AUDIENCE },
  )
}

export function verifyAdminToken(token: string): AuthPayload | null {
  try {
    const payload = verifyJwt(token, {
      audience: ADMIN_TOKEN_AUDIENCE,
    }) as AuthPayload & { sessionType?: string }
    if (
      payload.sessionType !== "admin" ||
      payload.role !== "ADMIN" ||
      typeof payload.userId !== "string"
    ) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export function signExtensionToken(payload: AuthPayload): string {
  return jwt.sign(
    {
      userId: payload.userId,
      email: payload.email,
      role: payload.role,
      plan: payload.plan,
      scope: "extension:assistant",
    },
    JWT_SECRET,
    { expiresIn: "30d", audience: "pitchpilot-chrome-extension" },
  )
}

export function verifyExtensionToken(token: string, requiredScope?: string): AuthPayload | null {
  try {
    const payload = verifyJwt(token, {
      audience: "pitchpilot-chrome-extension",
    }) as AuthPayload & { scope?: string }
    const acceptedScope = requiredScope
      ? payload.scope === requiredScope
      : payload.scope === "copilot:answer" || payload.scope === "extension:assistant"
    if (!acceptedScope || typeof payload.userId !== "string") {
      return null
    }
    return payload
  } catch {
    return null
  }
}

async function getCurrentUserFromCookies(...cookieNames: string[]): Promise<AuthPayload | null> {
  const cookieStore = await cookies()
  for (const cookieName of cookieNames) {
    const token = cookieStore.get(cookieName)?.value
    if (!token) continue
    const payload = verifyToken(token)
    if (!payload) continue

    // Keep the persisted account plan current on customer session checks. The
    // credit reservation path independently checks expiry in its debit predicate.
    await prisma.user.updateMany({
      where: {
        id: payload.userId,
        plan: "PRO",
        proExpiresAt: { lte: new Date() },
      },
      data: { plan: "FREE" },
    })
    return payload
  }
  return null
}

export async function getCurrentUser(): Promise<AuthPayload | null> {
  return getCurrentUserFromCookies("auth_token")
}

export async function getCurrentExtensionUser(): Promise<AuthPayload | null> {
  return getCurrentUserFromCookies("extension_auth_token", "auth_token")
}
