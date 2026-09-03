import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Mint a local browser session through the same passwordless provider boundary
 * as production without depending on an inbox UI. The service-role client may
 * generate the one-use link, but only the ordinary client verifies it and
 * receives the user session.
 */
export async function signInWithGeneratedEmailOtp(
  browserAuth: SupabaseClient,
  admin: SupabaseClient,
  email: string
) {
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  })
  if (generated.error) {
    throw new Error(
      `Local email-code generation failed: ${generated.error.message}`
    )
  }

  const tokenHash = generated.data.properties?.hashed_token
  if (!tokenHash) {
    throw new Error(
      "Local email-code generation returned no verification token."
    )
  }

  return browserAuth.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  })
}
