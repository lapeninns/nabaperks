import "server-only"

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify"
const CUSTOMER_PHONE_ACTION = "customer_phone_otp"
const TURNSTILE_TIMEOUT_MS = 5_000

type TurnstileResult =
  | { readonly status: "not_configured" }
  | { readonly status: "verified" }
  | { readonly status: "rejected" }

export async function verifyCustomerPhoneChallenge({
  token,
  remoteIp,
}: {
  readonly token: string
  readonly remoteIp: string
}): Promise<TurnstileResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim()
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim()
  if (!secret && !siteKey) {
    return isHostedEnvironment()
      ? { status: "rejected" }
      : { status: "not_configured" }
  }
  if (!secret || !siteKey || !token || token.length > 2_048) {
    return { status: "rejected" }
  }

  let response: Response
  try {
    response = await fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
        remoteip: remoteIp,
        idempotency_key: crypto.randomUUID(),
      }),
      signal: AbortSignal.timeout(TURNSTILE_TIMEOUT_MS),
    })
  } catch {
    return { status: "rejected" }
  }

  if (!response.ok) return { status: "rejected" }

  try {
    const payload: unknown = await response.json()
    if (!isRecord(payload)) return { status: "rejected" }
    return payload.success === true && payload.action === CUSTOMER_PHONE_ACTION
      ? { status: "verified" }
      : { status: "rejected" }
  } catch {
    return { status: "rejected" }
  }
}

function isHostedEnvironment(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL_ENV === "preview" ||
    process.env.VERCEL_ENV === "production"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
