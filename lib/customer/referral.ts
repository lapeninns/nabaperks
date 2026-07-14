import { absoluteUrl } from "@/lib/seo/structured-data"

/**
 * "Bring a Regular" share helpers. A member's shareable join link carries their
 * opaque per-card `referral_code` as `?ref=` on the existing join route — never
 * the raw membership UUID. Attribution (referral attribution) resolves the
 * code server-side at join; the referrer bonus (referral bonus stamp) then
 * lands when the invited friend collects their first in-venue stamp.
 */

/** Build the absolute, shareable join link for a card's referral code. */
export function buildReferralJoinUrl(
  merchantSlug: string,
  referralCode: string
): string {
  const slug = encodeURIComponent(merchantSlug.trim())
  const code = encodeURIComponent(referralCode.trim())
  return absoluteUrl(`/m/${slug}/join?ref=${code}`)
}

/** A referral code is share-ready only when it is a non-empty opaque token. */
export function isShareableReferralCode(
  code: string | null | undefined
): code is string {
  return typeof code === "string" && /^[a-z0-9_-]{6,}$/.test(code.trim())
}
