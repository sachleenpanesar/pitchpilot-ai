import { OPTIONS as handleOptions, POST as handlePost } from "@/app/api/extension/token/route"

export function OPTIONS(request: Request) {
  return handleOptions(request)
}

export function POST(request: Request) {
  return handlePost(request)
}
