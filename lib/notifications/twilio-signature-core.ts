import { createHmac, timingSafeEqual } from "node:crypto"
import { readSignedWebhookBody } from "@/lib/http/signed-webhook-body"

export function parseTwilioForm(body: string): URLSearchParams | null {
  try {
    decodeURIComponent(body.replace(/\+/g, " "))
  } catch (error) {
    if (error instanceof URIError) return null
    throw error
  }
  const params = new URLSearchParams(body)
  const keys = [...params.keys()]
  if (keys.some((key) => !key) || new Set(keys).size !== keys.length)
    return null
  return params
}

export function verifyTwilioSignature(input: {
  readonly authToken: string
  readonly url: string
  readonly params: URLSearchParams | null
  readonly signature: string
}): boolean {
  if (
    !input.authToken ||
    !input.params ||
    !/^[A-Za-z0-9+/]{27}=$/.test(input.signature)
  )
    return false
  const payload = [...input.params.keys()]
    .sort()
    .reduce((result, key) => result + key + input.params?.get(key), input.url)
  const expected = createHmac("sha1", input.authToken).update(payload).digest()
  const actual = Buffer.from(input.signature, "base64")
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

export type TwilioWebhookConfiguration = {
  readonly authToken: string
  readonly appUrl: string
  readonly path: "/api/twilio/status" | "/api/twilio/inbound"
}

export async function readTwilioWebhook(
  request: Request,
  config: TwilioWebhookConfiguration
) {
  if (!config.authToken || !config.appUrl)
    return { status: 503, error: "unconfigured" } as const
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/x-www-form-urlencoded"
  )
    return { status: 415, error: "unsupported_media_type" } as const
  const body = await readSignedWebhookBody(request)
  if (body === null) return { status: 413, error: "payload_too_large" } as const
  const params = parseTwilioForm(body)
  if (!params) return { status: 400, error: "invalid_payload" } as const
  // The configured public URL is authoritative behind proxies; only retain
  // the incoming query, which must itself be covered by the signature.
  const url = `${config.appUrl.replace(/\/$/, "")}${config.path}${new URL(request.url).search}`
  if (
    !verifyTwilioSignature({
      authToken: config.authToken,
      url,
      params,
      signature: request.headers.get("x-twilio-signature") ?? "",
    })
  )
    return { status: 401, error: "invalid_signature" } as const
  return { status: 200, params } as const
}

export function parseTwilioStatus(params: URLSearchParams) {
  const providerMessageSid = params.get("MessageSid")
  const providerStatus = params.get("MessageStatus")
  const providerErrorCode = params.get("ErrorCode") || null
  if (
    !providerMessageSid ||
    !/^(SM|MM)[0-9a-f]{32}$/i.test(providerMessageSid) ||
    !providerStatus ||
    ![
      "accepted",
      "scheduled",
      "queued",
      "sending",
      "sent",
      "delivered",
      "read",
      "undelivered",
      "failed",
      "canceled",
    ].includes(providerStatus)
  )
    return null
  if (providerErrorCode !== null && !/^\d{1,8}$/.test(providerErrorCode))
    return null
  return { providerMessageSid, providerStatus, providerErrorCode }
}
