import type { CustomerExperienceKind } from "@/lib/customer/experience/types"

export const JOIN_JOURNEY_COOKIE = "nabaperks_join_journey"
export const JOIN_JOURNEY_HEADER = "x-nabaperks-join-journey"
export const JOIN_JOURNEY_TTL_SECONDS = 2 * 60 * 60

export type JoinEntry = "direct" | "qr" | "qr_referral" | "referral"
export type JoinStep = "card" | "otp" | "phone" | "terms" | "welcome"
export type JoinSurface = "customer_card" | "customer_join"

type JoinEntryInput = {
  readonly qrId?: string
  readonly referralCode?: string
}

type JoinMetadataInput = {
  readonly entry?: JoinEntry
  readonly funnelKey: string
  readonly step: JoinStep
  readonly surface: JoinSurface
}

export type ProductEventJoinMetadata = {
  readonly source: "customer_join"
  readonly surface: JoinSurface
  readonly step: JoinStep
  readonly entry?: JoinEntry
  readonly funnel_key: string
}

export function joinEntry({ qrId, referralCode }: JoinEntryInput): JoinEntry {
  if (qrId && referralCode) return "qr_referral"
  if (qrId) return "qr"
  if (referralCode) return "referral"
  return "direct"
}

export function joinStepForExperienceKind(
  kind: CustomerExperienceKind
): JoinStep | null {
  switch (kind) {
    case "join_welcome":
      return "welcome"
    case "join_phone":
      return "phone"
    case "join_otp":
      return "otp"
    case "join_terms":
      return "terms"
    case "join_returning":
      return "card"
    case "card_collecting":
    case "card_stamped_today":
    case "stamp_confirm":
    case "reward_waiting":
    case "reward_ready":
    case "redeemed_proof":
    case "unavailable":
      return null
  }
}

export function productEventJoinMetadata({
  entry,
  funnelKey,
  step,
  surface,
}: JoinMetadataInput): ProductEventJoinMetadata {
  return {
    source: "customer_join",
    surface,
    step,
    ...(entry ? { entry } : {}),
    funnel_key: funnelKey,
  }
}

export function postHogJoinMetadata(
  metadata: ProductEventJoinMetadata
): Omit<ProductEventJoinMetadata, "funnel_key"> {
  return {
    source: metadata.source,
    surface: metadata.surface,
    step: metadata.step,
    ...(metadata.entry ? { entry: metadata.entry } : {}),
  }
}

export function isJoinJourneyPath(pathname: string): boolean {
  return pathname.startsWith("/q/") || /^\/m\/[^/]+\/join$/.test(pathname)
}
