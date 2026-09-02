import { createHash } from "node:crypto"

export type AuthHookClaim =
  | { readonly status: "claimed"; readonly leaseId: string }
  | { readonly status: "replay" }
  | { readonly status: "busy" }

export function parseAuthHookClaim(value: unknown): AuthHookClaim | null {
  if (!isRecord(value) || typeof value.status !== "string") return null
  if (value.status === "replay" || value.status === "busy") {
    return { status: value.status }
  }
  if (
    value.status === "claimed" &&
    typeof value.lease_id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value.lease_id
    )
  ) {
    return { status: "claimed", leaseId: value.lease_id }
  }
  return null
}

export function authHookEmailIdempotencyKey(
  webhookId: string,
  leaseId: string
) {
  return `auth-hook-email:${createHash("sha256")
    .update(`${webhookId}:${leaseId}`)
    .digest("hex")}`
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
