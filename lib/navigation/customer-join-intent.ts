export type CustomerJoinStep =
  "welcome" | "phone" | "email" | "email_choice" | "otp" | "terms"

/**
 * A one-off message the step shows on arrival. `code_expired`: a code step
 * whose pending code had expired sent the guest back to the number form.
 */
export type CustomerJoinNotice = "code_expired"

export type CustomerJoinIntent = {
  qrId?: string
  referralCode?: string
  step?: CustomerJoinStep
  notice?: CustomerJoinNotice
}

type CustomerJoinSearchParams = {
  qr?: string
  ref?: string
  step?: string
  notice?: string
}

const JOIN_STEPS = new Set<CustomerJoinStep>([
  "welcome",
  "phone",
  "email",
  "email_choice",
  "otp",
  "terms",
])

export function parseCustomerJoinIntent(
  searchParams: CustomerJoinSearchParams
): CustomerJoinIntent {
  const qrId = present(searchParams.qr)
  const referralCode = present(searchParams.ref)
  const rawStep = present(searchParams.step)
  const step =
    rawStep && JOIN_STEPS.has(rawStep as CustomerJoinStep)
      ? (rawStep as CustomerJoinStep)
      : undefined

  const notice = parseCustomerJoinNotice(searchParams.notice)

  return {
    ...(qrId ? { qrId } : {}),
    ...(referralCode ? { referralCode } : {}),
    ...(step ? { step } : {}),
    ...(notice ? { notice } : {}),
  }
}

export function parseCustomerJoinNotice(
  raw: string | undefined
): CustomerJoinNotice | undefined {
  return present(raw) === "code_expired" ? "code_expired" : undefined
}

export function buildCustomerJoinHref(
  merchantSlug: string,
  intent: CustomerJoinIntent
): string {
  const params = new URLSearchParams()
  if (intent.qrId) params.set("qr", intent.qrId)
  if (intent.referralCode) params.set("ref", intent.referralCode)
  if (intent.step) params.set("step", intent.step)
  if (intent.notice) params.set("notice", intent.notice)
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
