export type CustomerJoinStep = "welcome" | "phone" | "otp" | "terms"

export type CustomerJoinIntent = {
  qrId?: string
  referralCode?: string
  step?: CustomerJoinStep
}

type CustomerJoinSearchParams = {
  qr?: string
  ref?: string
  step?: string
}

const JOIN_STEPS = new Set<CustomerJoinStep>([
  "welcome",
  "phone",
  "otp",
  "terms",
])

export function parseCustomerJoinIntent(
  searchParams: CustomerJoinSearchParams
): CustomerJoinIntent {
  const qrId = present(searchParams.qr)
  const referralCode = present(searchParams.ref)
  const rawStep = present(searchParams.step)
  const step = rawStep && JOIN_STEPS.has(rawStep as CustomerJoinStep)
    ? (rawStep as CustomerJoinStep)
    : undefined

  return {
    ...(qrId ? { qrId } : {}),
    ...(referralCode ? { referralCode } : {}),
    ...(step ? { step } : {}),
  }
}

export function buildCustomerJoinHref(
  merchantSlug: string,
  intent: CustomerJoinIntent
): string {
  const params = new URLSearchParams()
  if (intent.qrId) params.set("qr", intent.qrId)
  if (intent.referralCode) params.set("ref", intent.referralCode)
  if (intent.step) params.set("step", intent.step)
  const query = params.toString()

  return `/m/${encodeURIComponent(merchantSlug.trim())}/join${query ? `?${query}` : ""}`
}

export function buildCustomerMerchantHref(
  merchantSlug: string,
  referralCode?: string
): string {
  const params = new URLSearchParams()
  if (referralCode) params.set("ref", referralCode)
  const query = params.toString()

  return `/m/${encodeURIComponent(merchantSlug.trim())}${query ? `?${query}` : ""}`
}

function present(value: string | undefined): string | undefined {
  const normalized = value?.trim()
  return normalized || undefined
}
