export type MerchantCustomerIdentity = {
  readonly email?: string | null
  readonly phone?: string | null
  readonly phoneLast4?: string | null
}

export function formatMerchantCustomerIdentifier(
  customer: MerchantCustomerIdentity | null | undefined
) {
  const maskedEmail = maskMerchantEmail(customer?.email)
  if (maskedEmail) return maskedEmail

  const phoneEnding =
    lastFourDigits(customer?.phone) ?? lastFourDigits(customer?.phoneLast4)
  return phoneEnding ? `Phone ending ${phoneEnding}` : "Customer"
}

function maskMerchantEmail(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const atIndex = trimmed.indexOf("@")
  if (atIndex <= 0 || atIndex === trimmed.length - 1) return "Email hidden"

  const domain = trimmed.slice(atIndex + 1).toLowerCase()
  return `${trimmed[0].toLowerCase()}***@${domain}`
}

function lastFourDigits(value: string | null | undefined) {
  const digits = [...(value ?? "")]
    .filter((char) => char >= "0" && char <= "9")
    .join("")

  return digits.length >= 4 ? digits.slice(-4) : null
}
