export type PhoneMessageChannel = "whatsapp" | "sms"

export class TwilioMessageConfigurationError extends Error {
  constructor() {
    super("Customer messaging configuration is invalid.")
    this.name = "TwilioMessageConfigurationError"
  }
}

export function whatsappVariable(value: string): string {
  return value
    .replace(/[\s\p{Cc}]+/gu, " ")
    .trim()
    .slice(0, 1024)
}

export function parseContentSidMap(
  raw: string | undefined
): Readonly<Record<string, string>> {
  if (!raw?.trim()) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new TwilioMessageConfigurationError()
    throw error
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TwilioMessageConfigurationError()
  }
  const entries = Object.entries(parsed)
  const valid: [string, string][] = []
  for (const [key, value] of entries) {
    if (
      !/^[a-z][a-z0-9_]*$/.test(key) ||
      typeof value !== "string" ||
      !/^HX[0-9a-f]{32}$/i.test(value)
    ) {
      throw new TwilioMessageConfigurationError()
    }
    valid.push([key, value])
  }
  return Object.fromEntries(valid)
}

export type TwilioMessageInput = {
  readonly channel: PhoneMessageChannel
  readonly recipient: string
  readonly deliveryId: string
  readonly body: string
  readonly variables: Readonly<Record<string, string>>
  readonly statusCallbackUrl: string
  readonly messagingServiceSid: string
  readonly contentSid?: string
}

export function buildTwilioMessageParams(
  input: TwilioMessageInput
): URLSearchParams {
  if (
    !/^\+[1-9]\d{7,14}$/.test(input.recipient) ||
    !/^MG[0-9a-f]{32}$/i.test(input.messagingServiceSid)
  ) {
    throw new TwilioMessageConfigurationError()
  }
  const callback = new URL(input.statusCallbackUrl)
  callback.searchParams.set("delivery_id", input.deliveryId)
  const params = new URLSearchParams({
    MessagingServiceSid: input.messagingServiceSid,
    StatusCallback: callback.toString(),
  })
  switch (input.channel) {
    case "whatsapp":
      if (!input.contentSid || !/^HX[0-9a-f]{32}$/i.test(input.contentSid))
        throw new TwilioMessageConfigurationError()
      params.set("To", `whatsapp:${input.recipient}`)
      params.set("ContentSid", input.contentSid)
      params.set(
        "ContentVariables",
        JSON.stringify(
          Object.fromEntries(
            Object.entries(input.variables).map(([key, value]) => [
              key,
              whatsappVariable(value),
            ])
          )
        )
      )
      break
    case "sms":
      params.set("To", input.recipient)
      params.set("Body", input.body)
      break
    default:
      input.channel satisfies never
      throw new TwilioMessageConfigurationError()
  }
  return params
}

export function classifyTwilioSendFailure(input: {
  readonly status: number
  readonly code?: number
}) {
  const fallbackAllowed =
    input.status === 400 &&
    [63003, 63024, 63016, 63049].includes(input.code ?? 0)
  const reason =
    input.status === 429
      ? "rate_limited"
      : input.status >= 500
        ? "provider_unavailable"
        : fallbackAllowed
          ? "whatsapp_unavailable"
          : "provider_rejected"
  return {
    reason,
    fallbackAllowed,
    errorCode: input.code === undefined ? null : String(input.code),
  }
}
