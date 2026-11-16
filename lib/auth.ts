import jwt from "jsonwebtoken"
import { cookies } from "next/headers"
import { randomBytes } from "node:crypto"

// Never use a predictable signing key in production. A process-local key keeps
// local development convenient while invalidating sessions after a restart.
const JWT_SECRET =
  process.env.JWT_SECRET ??
  (process.env.NODE_ENV === "production" ? "" : randomBytes(32).toString("hex"))
const ADMIN_TOKEN_AUDIENCE = "pitchpilot-admin-console"

export interface AuthPayload {
  userId: string
  email: string
  role: string
  plan: string
}

export function signToken(payload: AuthPayload): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET must be configured")
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" })
}

export function verifyToken(token: string): AuthPayload | null {
  if (!JWT_SECRET) return null
  try {
    return jwt.verify(token, JWT_SECRET) as AuthPayload
  } catch {
    return null
  }
}

export function signAdminToken(payload: AuthPayload): string {
  if (!JWT_SECRET) throw new Error("JWT_SECRET must be configured")
  return jwt.sign(
    { ...payload, sessionType: "admin" },
    JWT_SECRET,
    { expiresIn: "8h", audience: ADMIN_TOKEN_AUDIENCE },
  )
}

export function verifyAdminToken(token: string): AuthPayload | null {
  if (!JWT_SECRET) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
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
  if (!JWT_SECRET) throw new Error("JWT_SECRET must be configured")
  return jwt.sign(
    { ...payload, scope: "copilot:answer" },
    JWT_SECRET,
    { expiresIn: "1h", audience: "pitchpilot-chrome-extension" },
  )
}

export function verifyExtensionToken(token: string): AuthPayload | null {
  if (!JWT_SECRET) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET, {
      audience: "pitchpilot-chrome-extension",
    }) as AuthPayload & { scope?: string }
    if (payload.scope !== "copilot:answer" || typeof payload.userId !== "string") {
      return null
    }
    return payload
  } catch {
    return null
  }
}

export async function getCurrentUser(): Promise<AuthPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get("auth_token")?.value
  if (!token) return null
  return verifyToken(token)
}
