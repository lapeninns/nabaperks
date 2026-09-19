export type PhoneMarketingChannel = "whatsapp" | "sms"

export type PhoneConsentRow = {
  readonly channel?: unknown
  readonly consent_status?: unknown
  readonly source?: unknown
  readonly policy_version?: unknown
  readonly created_at?: unknown
}

export type PhoneMarketingConsent = {
  readonly whatsapp: boolean
  readonly sms: boolean
}

export function resolvePhoneMarketingConsent(
  rows: readonly PhoneConsentRow[]
): PhoneMarketingConsent {
  const latest = new Map<PhoneMarketingChannel, string>()
  const sorted = [...rows].sort((left, right) =>
    String(right.created_at ?? "").localeCompare(String(left.created_at ?? ""))
  )

  for (const row of sorted) {
    if (
      (row.channel === "whatsapp" || row.channel === "sms") &&
      !latest.has(row.channel)
    ) {
      latest.set(row.channel, String(row.consent_status ?? ""))
    }
  }

  return {
    whatsapp: channelConsent(latest, "whatsapp", "sms"),
    sms: channelConsent(latest, "sms", "whatsapp"),
  }
}

function channelConsent(
  latest: ReadonlyMap<PhoneMarketingChannel, string>,
  channel: PhoneMarketingChannel,
  legacyChannel: PhoneMarketingChannel
) {
  const direct = latest.get(channel)
  if (direct === "opted_out") return false
  if (direct === "opted_in") return true
  return latest.get(legacyChannel) === "opted_in"
}
