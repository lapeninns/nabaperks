import "server-only"

import { createHmac } from "node:crypto"

export type DeliveryChannel = "email" | "sms" | "web-push"

type DeliveryDestination = {
  readonly channel: DeliveryChannel
  readonly destination: string
}

const ALLOWLIST_ENV = "NON_PRODUCTION_DELIVERY_ALLOWLIST"
const SECRET_ENV = "NON_PRODUCTION_DELIVERY_HMAC_SECRET"
const MINIMUM_SECRET_LENGTH = 32

export class NonProductionDeliveryBlockedError extends Error {
  constructor() {
    super("Hosted non-production delivery is disabled for this destination.")
    this.name = "NonProductionDeliveryBlockedError"
  }
}

/**
 * Provider-boundary gate for Vercel Preview and custom Staging deployments.
 * Production and local development retain their existing delivery behaviour.
 */
export function assertDeliveryDestinationAllowed(
  input: DeliveryDestination
): void {
  if (!isHostedNonProduction()) return

  const secret = process.env[SECRET_ENV]?.trim()
  const allowlist = parseAllowlist(process.env[ALLOWLIST_ENV])
  if (!secretIsStrong(secret) || allowlist.size === 0) {
    throw new NonProductionDeliveryBlockedError()
  }

  const fingerprint = deliveryDestinationFingerprint(input, secret)
  if (!allowlist.has(`${input.channel}:${fingerprint}`)) {
    throw new NonProductionDeliveryBlockedError()
  }
}

export function isNonProductionDeliveryBlockedError(
  error: unknown
): error is NonProductionDeliveryBlockedError {
  return error instanceof NonProductionDeliveryBlockedError
}

export function deliveryDestinationFingerprint(
  input: DeliveryDestination,
  secret: string
): string {
  return createHmac("sha256", secret)
    .update(`${input.channel}\0${normalizeDestination(input)}`)
    .digest("base64url")
}

function isHostedNonProduction(): boolean {
  const environment = process.env.VERCEL_ENV?.trim()
  const target = process.env.VERCEL_TARGET_ENV?.trim()

  if (environment === "production") return false
  return (
    environment === "preview" || target === "preview" || target === "staging"
  )
}

function parseAllowlist(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(/[\s,]+/)
      .map((entry) => entry.trim())
      .filter((entry) =>
        /^(?:email|sms|web-push):[A-Za-z0-9_-]{43}$/.test(entry)
      )
  )
}

function secretIsStrong(secret: string | undefined): secret is string {
  return Boolean(
    secret &&
    secret.length >= MINIMUM_SECRET_LENGTH &&
    !/\s/.test(secret) &&
    new Set(secret).size >= 12
  )
}

function normalizeDestination({
  channel,
  destination,
}: DeliveryDestination): string {
  const normalized = destination.trim()
  return channel === "email" ? normalized.toLowerCase() : normalized
}
