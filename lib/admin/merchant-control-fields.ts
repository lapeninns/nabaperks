export function parseAdminMerchantId(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") return null
  const id = value.trim()
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id
  )
    ? id
    : null
}

export function parseCustomerMessagingEnabled(
  value: FormDataEntryValue | null
): boolean | null {
  if (value !== "true" && value !== "false") return null
  return value === "true"
}

export function parseMerchantSuspensionReason(
  value: FormDataEntryValue | null
): string | null {
  if (typeof value !== "string") return null
  const reason = value.trim()
  return reason.length >= 4 && reason.length <= 500 ? reason : null
}
