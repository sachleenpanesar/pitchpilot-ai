import "server-only"

import { verifyAdminToken } from "@/lib/auth"
import { cookies } from "next/headers"

export async function getAdminUser() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("admin_token")?.value
    return token ? verifyAdminToken(token) : null
  } catch (error) {
    console.error("Admin authorization check failed.", error instanceof Error ? error.name : "UnknownError")
    return null
  }
}
