import {
  getEmailUnsubscribe,
  postEmailUnsubscribe,
  type UnsubscribeContext,
} from "@/lib/notifications/email-unsubscribe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request, context: UnsubscribeContext) {
  const { token } = await context.params
  return postEmailUnsubscribe("invite", token, request)
}

export async function GET(request: Request, context: UnsubscribeContext) {
  const { token } = await context.params
  return getEmailUnsubscribe(request, "invite", token)
}
