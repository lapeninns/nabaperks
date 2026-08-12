export const MAX_PUBLIC_CLAIM_TOKEN_LENGTH = 512

export type PublicClaimTokenResult =
  | { readonly status: "valid"; readonly value: string }
  | { readonly status: "invalid" }

/** Parses opaque bearer material without retaining, logging, or transforming it. */
export function parsePublicClaimToken(value: string): PublicClaimTokenResult {
  if (!value || value.length > MAX_PUBLIC_CLAIM_TOKEN_LENGTH) {
    return { status: "invalid" }
  }

  return { status: "valid", value }
}
