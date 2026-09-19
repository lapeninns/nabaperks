import "server-only"

import {
  buildTwilioMessageParams,
  classifyTwilioSendFailure,
  parseContentSidMap,
  TwilioMessageConfigurationError,
  type PhoneMessageChannel,
} from "@/lib/notifications/twilio-messaging-core"
import { logger } from "@/lib/observability/logger"
import {
  CircuitOpenError,
  resilientFetch,
} from "@/lib/observability/resilience"

export type CustomerMessage = {
  readonly channel: PhoneMessageChannel
  readonly recipient: string
  readonly deliveryId: string
  readonly eventType: string
  readonly body: string
  readonly variables: Readonly<Record<string, string>>
  readonly beforeProviderAttempt?: () => Promise<void>
}

export type CustomerMessageResult =
  | {
      readonly status: "accepted"
      readonly providerMessageSid: string
      readonly providerStatus: string
    }
  | {
      readonly status: "skipped"
      readonly reason: "channel_disabled" | "local_bypass"
    }
  | {
      readonly status: "rejected"
      readonly reason: string
      readonly errorCode: string | null
      readonly fallbackAllowed: boolean
    }
  | {
      readonly status: "ambiguous"
      readonly reason: "transport_uncertain" | "invalid_provider_response"
    }

export async function sendCustomerMessage(
  input: CustomerMessage
): Promise<CustomerMessageResult> {
  const mode = process.env.CUSTOMER_MESSAGING_MODE?.trim() || "off"
  if (mode === "off" || mode === "dry_run")
    return { status: "skipped", reason: "channel_disabled" }
  if (mode !== "live") throw new TwilioMessageConfigurationError()
  const bypass = process.env.CUSTOMER_MESSAGING_BYPASS_MODE?.trim()
  if (bypass) {
    if (
      bypass !== "log" ||
      process.env.NODE_ENV === "production" ||
      [process.env.VERCEL, process.env.VERCEL_ENV, process.env.CI].some(Boolean)
    )
      throw new TwilioMessageConfigurationError()
    logger.info("customer_message_local_bypass", {
      deliveryId: input.deliveryId,
      channel: input.channel,
    })
    return { status: "skipped", reason: "local_bypass" }
  }
  const { accountSid, authorization, messagingServiceSid, appUrl } =
    readCustomerMessagingConfig()
  const params = buildTwilioMessageParams({
    ...input,
    messagingServiceSid,
    contentSid: parseContentSidMap(process.env.TWILIO_CONTENT_SIDS)[
      input.eventType
    ],
    statusCallbackUrl: `${appUrl.replace(/\/$/, "")}/api/twilio/status`,
  })
  await input.beforeProviderAttempt?.()
  let response: Response
  try {
    response = await resilientFetch(
      "twilio-customer-messaging",
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: authorization,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
        signal: AbortSignal.timeout(15_000),
      },
      { retries: 0 }
    )
  } catch (error) {
    if (error instanceof CircuitOpenError)
      return {
        status: "rejected",
        reason: "circuit_open",
        errorCode: null,
        fallbackAllowed: false,
      }
    if (error instanceof Error)
      return { status: "ambiguous", reason: "transport_uncertain" }
    throw error
  }
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    if (error instanceof Error)
      return { status: "ambiguous", reason: "invalid_provider_response" }
    throw error
  }
  if (!response.ok) {
    const code =
      payload &&
      typeof payload === "object" &&
      "code" in payload &&
      typeof payload.code === "number" &&
      Number.isSafeInteger(payload.code)
        ? payload.code
        : undefined
    return {
      status: "rejected",
      ...classifyTwilioSendFailure({ status: response.status, code }),
    }
  }
  if (
    !payload ||
    typeof payload !== "object" ||
    !("sid" in payload) ||
    typeof payload.sid !== "string" ||
    !/^(SM|MM)[0-9a-f]{32}$/i.test(payload.sid) ||
    !("status" in payload) ||
    typeof payload.status !== "string"
  )
    return { status: "ambiguous", reason: "invalid_provider_response" }
  return {
    status: "accepted",
    providerMessageSid: payload.sid,
    providerStatus: payload.status,
  }
}

function readCustomerMessagingConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? ""
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim() ?? ""
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim()
  const messagingServiceSid =
    process.env.TWILIO_CUSTOMER_MESSAGING_SERVICE_SID?.trim()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!/^AC[0-9a-f]{32}$/i.test(accountSid) || !messagingServiceSid || !appUrl)
    throw new TwilioMessageConfigurationError()
  const credential =
    /^SK[0-9a-f]{32}$/i.test(apiKeySid) && apiKeySecret
      ? `${apiKeySid}:${apiKeySecret}`
      : authToken
        ? `${accountSid}:${authToken}`
        : null
  if (!credential) throw new TwilioMessageConfigurationError()
  return {
    accountSid,
    messagingServiceSid,
    appUrl,
    authorization: `Basic ${Buffer.from(credential).toString("base64")}`,
  }
}
