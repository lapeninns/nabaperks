import { createHmac } from "node:crypto"

const PSEUDONYMOUS_MODE = "pseudonymous"
const PSEUDONYM_DOMAIN = "nabaperks:analytics:pseudonym:v1"
const MIN_SECRET_LENGTH = 32
const MAX_SECRET_LENGTH = 1_024
const MAX_IDENTITY_LENGTH = 256
const MAX_PROPERTY_STRING_LENGTH = 128

const externalPropertyValues: Readonly<Record<string, ReadonlySet<string>>> = {
  entry: new Set(["direct", "qr", "referral", "qr_referral"]),
  source: new Set([
    "homepage",
    "merchant_signup",
    "email_verification",
    "merchant_activation",
    "merchant_qr_action",
    "reward_pool_auto_provision",
    "confirmed_stamp",
    "merchant_confirmed_reward_collection",
    "self_service_qr",
    "referral_bonus",
    "returning_qr",
    "customer_join",
    "dashboard",
    "profile",
    "poster",
    "billing",
  ]),
  step: new Set([
    "landing",
    "signup",
    "account",
    "email_verification",
    "onboarding",
    "launch",
    "card",
    "rewards",
    "qr",
    "poster",
    "billing",
    "first_stamp",
    "phone",
    "otp",
    "terms",
  ]),
  surface: new Set([
    "marketing",
    "merchant_signup",
    "merchant_app",
    "customer_join",
    "customer_card",
    "billing",
    "dashboard",
    "qr_poster",
  ]),
  tab: new Set(["card", "rewards", "qr", "billing", "launch", "profile"]),
  billing_interval: new Set(["28_day", "monthly", "annual"]),
  outcome: new Set([
    "success",
    "cancelled",
    "completed",
    "failed",
    "eligible",
    "ineligible",
  ]),
  entitlement_status: new Set([
    "trialing",
    "active",
    "past_due",
    "unpaid",
    "canceled",
    "incomplete",
    "incomplete_expired",
    "paused",
    "none",
  ]),
  actor_type: new Set(["merchant", "customer", "staff", "admin", "system"]),
}

export const analyticsIdentityDomains = [
  "merchant",
  "customer",
  "membership",
  "actor",
  "qr",
  "funnel",
  "system",
  "event",
] as const

export type AnalyticsIdentityDomain = (typeof analyticsIdentityDomains)[number]

const analyticsIdentityDomainSet = new Set<string>(analyticsIdentityDomains)

const uuidPattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i
const emailPattern = /\b[^\s@]+@[^\s@]+\.[^\s@]+\b/i
const ipv4Pattern =
  /(?:^|[^\d])(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}(?:$|[^\d])/
const ipv6Pattern =
  /(?:^|[^0-9a-f:])(?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4}(?:$|[^0-9a-f:])/i
const urlPattern = /(?:[a-z][a-z\d+.-]*:\/\/|\bwww\.|[/?#][^\s]*=)/i
const coordinatePattern =
  /(?:^|\s)[+-]?(?:90(?:\.0+)?|[1-8]?\d(?:\.\d+)?),\s*[+-]?(?:180(?:\.0+)?|(?:1[0-7]\d|\d?\d)(?:\.\d+)?)(?:$|\s)/
const phoneValuePattern = /(?:\d[^\d\n]*){7,}/
const providerValuePattern =
  /^(?:acct|ch|cs|cus|evt|in|pi|pm|price|prod|sess|seti|si|sk|pk|sub|tok|whsec|phc)_(?:live_|test_)?[a-z\d_-]{6,}$/i
const bearerOrJwtPattern =
  /^(?:bearer\s+\S+|eyJ[a-z\d_-]+\.[a-z\d_-]+\.[a-z\d_-]+)$/i
const enumStringPattern = /^[a-z][a-z\d_-]*$/

export type PostHogConfig = Readonly<{
  projectKey: string
  host: string
  pseudonymSecret: string
}>

export type PostHogCapturePayload = Readonly<{
  api_key: string
  event: string
  distinct_id: string
  properties: Record<string, string | boolean | number>
}>

export type PostHogEnvironment = Readonly<{
  ANALYTICS_EXTERNAL_PROCESSING_MODE?: string
  POSTHOG_PROJECT_KEY?: string
  POSTHOG_HOST?: string
  ANALYTICS_PSEUDONYM_SECRET?: string
}>

export function resolvePostHogConfig(
  environment: PostHogEnvironment
): PostHogConfig | null {
  if (environment.ANALYTICS_EXTERNAL_PROCESSING_MODE !== PSEUDONYMOUS_MODE) {
    return null
  }

  const projectKey = exactBoundedString(environment.POSTHOG_PROJECT_KEY, 256)
  const host = exactBoundedString(environment.POSTHOG_HOST, 2_048)
  const pseudonymSecret = exactBoundedString(
    environment.ANALYTICS_PSEUDONYM_SECRET,
    MAX_SECRET_LENGTH
  )

  if (
    !projectKey ||
    !host ||
    !pseudonymSecret ||
    pseudonymSecret.length < MIN_SECRET_LENGTH ||
    !projectKey.startsWith("phc_") ||
    !/^[a-z\d_-]+$/i.test(projectKey) ||
    !isSafePostHogHost(host)
  ) {
    return null
  }

  return { projectKey, host, pseudonymSecret }
}

export function pseudonymizeAnalyticsId(
  domain: AnalyticsIdentityDomain,
  value: string,
  secret: string
): string {
  const safeDomain = exactBoundedString(domain, 64)
  const safeValue = exactBoundedString(value, MAX_IDENTITY_LENGTH)
  const safeSecret = exactBoundedString(secret, MAX_SECRET_LENGTH)

  if (
    !safeDomain ||
    !analyticsIdentityDomainSet.has(safeDomain) ||
    !safeValue ||
    !safeSecret ||
    safeSecret.length < MIN_SECRET_LENGTH
  ) {
    throw new TypeError("Invalid analytics pseudonym input")
  }

  const digest = createHmac("sha256", safeSecret)
    .update(PSEUDONYM_DOMAIN)
    .update("\0")
    .update(safeDomain)
    .update("\0")
    .update(safeValue)
    .digest("base64url")

  return `ana_v1_${digest}`
}

export function buildExternalAnalyticsProperties(
  properties: Record<string, unknown>
): Record<string, string | boolean | number> | null {
  if (!isPlainRecord(properties)) return null

  const descriptors = Object.getOwnPropertyDescriptors(properties)
  const ownKeys = Reflect.ownKeys(properties)

  if (ownKeys.some((key) => typeof key !== "string")) return null

  const output: Record<string, string | boolean | number> = {}

  for (const key of ownKeys as string[]) {
    const descriptor = descriptors[key]
    if (
      !descriptor ||
      !("value" in descriptor) ||
      !descriptor.enumerable ||
      !Object.hasOwn(externalPropertyValues, key)
    ) {
      return null
    }

    const value = descriptor.value
    if (typeof value === "string") {
      if (!isSafeExternalString(value)) return null
      if (!externalPropertyValues[key]?.has(value)) return null
      output[key] = value
      continue
    }

    return null
  }

  return output
}

export function buildPostHogCapturePayload(
  input: {
    eventName: string
    identityDomain: AnalyticsIdentityDomain
    identityValue: string
    eventId?: string | null
    properties: Record<string, unknown>
  },
  config: PostHogConfig
): PostHogCapturePayload | null {
  if (!isSafeExternalString(input.eventName)) return null

  const properties = buildExternalAnalyticsProperties(input.properties)
  if (!properties) return null

  let distinctId: string
  let insertId: string | undefined
  try {
    distinctId = pseudonymizeAnalyticsId(
      input.identityDomain,
      input.identityValue,
      config.pseudonymSecret
    )
    insertId = input.eventId
      ? pseudonymizeAnalyticsId("event", input.eventId, config.pseudonymSecret)
      : undefined
  } catch {
    return null
  }

  return {
    api_key: config.projectKey,
    event: input.eventName,
    distinct_id: distinctId,
    properties: {
      ...properties,
      ...(insertId ? { $insert_id: insertId } : {}),
      $process_person_profile: false,
    },
  }
}

function exactBoundedString(
  value: string | undefined,
  maxLength: number
): string | null {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > maxLength ||
    value !== value.trim()
  ) {
    return null
  }

  return value
}

function isSafePostHogHost(value: string): boolean {
  try {
    const url = new URL(value)
    const permitsLocalHttp =
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")

    return (
      (url.protocol === "https:" || permitsLocalHttp) &&
      url.username === "" &&
      url.password === "" &&
      url.pathname === "/" &&
      url.search === "" &&
      url.hash === ""
    )
  } catch {
    return false
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false
  }

  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function isSafeExternalString(value: string): boolean {
  if (
    value.length === 0 ||
    value.length > MAX_PROPERTY_STRING_LENGTH ||
    value !== value.trim() ||
    !enumStringPattern.test(value)
  ) {
    return false
  }

  if (
    uuidPattern.test(value) ||
    emailPattern.test(value) ||
    ipv4Pattern.test(value) ||
    ipv6Pattern.test(value) ||
    urlPattern.test(value) ||
    coordinatePattern.test(value) ||
    phoneValuePattern.test(value) ||
    providerValuePattern.test(value) ||
    bearerOrJwtPattern.test(value)
  ) {
    return false
  }

  return true
}
