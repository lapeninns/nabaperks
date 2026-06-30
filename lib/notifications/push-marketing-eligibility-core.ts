export type PushMarketingConsentRecord = {
  readonly customer_id?: unknown
  readonly consent_status?: unknown
}

export function latestPushMarketingConsentOptedIn(
  rows: readonly PushMarketingConsentRecord[]
) {
  const [latest] = rows
  return isPushMarketingConsentOptedIn(latest?.consent_status)
}

export function pushMarketingConsentCustomerIds(
  rows: readonly PushMarketingConsentRecord[]
) {
  const latestByCustomer = new Map<string, unknown>()

  for (const row of rows) {
    const customerId = stringValue(row.customer_id)
    if (!customerId || latestByCustomer.has(customerId)) continue
    latestByCustomer.set(customerId, row.consent_status)
  }

  const optedIn = new Set<string>()
  for (const [customerId, status] of latestByCustomer.entries()) {
    if (isPushMarketingConsentOptedIn(status)) {
      optedIn.add(customerId)
    }
  }

  return optedIn
}

function isPushMarketingConsentOptedIn(value: unknown) {
  return value === "opted_in"
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : ""
}
