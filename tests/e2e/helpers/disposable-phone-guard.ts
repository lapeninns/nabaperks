import { isLocalDevelopment } from "@/lib/customer/dev-otp-core"

/**
 * When a live-DB spec may type a real-range UK mobile.
 *
 * The app's phone parser rejects Ofcom's drama range (07700 900xxx), so the
 * live journeys use random numbers from the allocatable 074 range (QA BUG-052).
 * Those are only safe while nothing can text them: the server must honour the
 * local dev code (so no verification message is requested) and every Twilio
 * credential must be empty or one of the repository's synthetic placeholders
 * (the CI fixture in .github/workflows/ci.yml). Anything else refuses before a
 * number is generated.
 */

type Env = Record<string, string | undefined>

const DEFAULT_BASE_URL = "http://127.0.0.1:3146"
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"])

/** The Twilio settings that could send an SMS or WhatsApp message. */
export const TWILIO_PROVIDER_KEYS = [
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_API_KEY_SID",
  "TWILIO_API_KEY_SECRET",
  "TWILIO_VERIFY_SERVICE_SID",
  "TWILIO_MESSAGING_SERVICE_SID",
  "TWILIO_CUSTOMER_MESSAGING_SERVICE_SID",
] as const

/** The synthetic placeholders CI and the local harness use; never real. */
export const SYNTHETIC_TWILIO_VALUES: ReadonlySet<string> = new Set([
  "ACci",
  "ci-twilio-auth-token",
  "VAci",
])

/** Why a real-range test mobile must not be used here, or undefined. */
export function disposablePhoneRefusal(env: Env): string | undefined {
  if (!isLocalDevelopment(env)) {
    return "live phone fixtures run only against local development"
  }

  const baseUrl = env.PLAYWRIGHT_BASE_URL?.trim() || DEFAULT_BASE_URL
  let host: string
  try {
    host = new URL(baseUrl).hostname
  } catch {
    return "PLAYWRIGHT_BASE_URL is not a valid URL"
  }
  if (!LOOPBACK_HOSTS.has(host)) {
    return "live phone fixtures run only against a loopback app"
  }

  // Playwright's own dev server always gets CUSTOMER_DEV_OTP_CODE
  // (playwright.config.ts); a reused server must be given it explicitly.
  const reusesServer = env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "1"
  if (reusesServer && !env.CUSTOMER_DEV_OTP_CODE?.trim()) {
    return "set CUSTOMER_DEV_OTP_CODE so the reused server sends no real code"
  }

  const live = TWILIO_PROVIDER_KEYS.filter((key) => {
    const value = env[key]?.trim()
    return Boolean(value) && !SYNTHETIC_TWILIO_VALUES.has(value ?? "")
  })
  if (live.length > 0) {
    return `Twilio settings are not synthetic placeholders (${live.join(
      ", "
    )}); clear them or use the CI placeholders before running live phone journeys`
  }

  return undefined
}

/** Throws unless a real-range test mobile is safe to use here. */
export function assertDisposablePhoneSafe(env: Env): void {
  const refusal = disposablePhoneRefusal(env)
  if (refusal) throw new Error(`Refusing a real-range test mobile: ${refusal}`)
}
