export const MAX_FUNNEL_BODY_BYTES = 2_048
export const MAX_FUNNEL_TOKEN_LENGTH = 1_024

export const PUBLIC_FUNNEL_EVENTS = [
  "merchant_marketing_viewed",
  "merchant_signup_clicked",
  "merchant_signup_started",
  "merchant_otp_verification_viewed",
] as const

export type PublicFunnelEvent = (typeof PUBLIC_FUNNEL_EVENTS)[number]

export type FunnelCaptureRequest = {
  event: PublicFunnelEvent
  token?: string
}

export type FunnelCaptureResponse = {
  token: string
}

const publicFunnelEventSet = new Set<string>(PUBLIC_FUNNEL_EVENTS)

export function parseFunnelCaptureRequest(
  value: unknown
): FunnelCaptureRequest | null {
  if (!isRecord(value)) return null

  const keys = Object.keys(value)
  if (
    !keys.includes("event") ||
    keys.some((key) => key !== "event" && key !== "token")
  ) {
    return null
  }

  if (
    typeof value.event !== "string" ||
    !publicFunnelEventSet.has(value.event)
  ) {
    return null
  }

  if ("token" in value && !isBoundedToken(value.token)) return null

  return {
    event: value.event as PublicFunnelEvent,
    ...("token" in value ? { token: value.token as string } : {}),
  }
}

export function parseFunnelCaptureResponse(
  value: unknown
): FunnelCaptureResponse | null {
  if (!isRecord(value)) return null

  const keys = Object.keys(value)
  if (
    keys.length !== 1 ||
    keys[0] !== "token" ||
    !isBoundedToken(value.token)
  ) {
    return null
  }

  return { token: value.token }
}

function isBoundedToken(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= MAX_FUNNEL_TOKEN_LENGTH &&
    value.trim() === value &&
    !/\s/.test(value)
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
