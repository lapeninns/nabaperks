import "server-only"

import { revalidateTag, unstable_cache } from "next/cache"

const CACHE_REVALIDATE_SECONDS = 300

export const CACHE_TAGS = {
  loyaltyCardSetup: "loyalty-card-setup",
  merchant: "merchant",
  merchantActivitySummary: "merchant-activity-summary",
  merchantOnboarding: "merchant-onboarding",
  qrImageContext: "qr-image-context",
} as const

export function merchantCacheTag(merchantId: string) {
  return `${CACHE_TAGS.merchant}:${merchantId}`
}

export function merchantActivitySummaryCacheTag(merchantId: string) {
  return `${CACHE_TAGS.merchantActivitySummary}:${merchantId}`
}

export function merchantOnboardingCacheTag(userId: string) {
  return `${CACHE_TAGS.merchantOnboarding}:${userId}`
}

export function loyaltyCardSetupCacheTag(merchantId: string) {
  return `${CACHE_TAGS.loyaltyCardSetup}:${merchantId}`
}

export function qrImageContextCacheTag(qrCodeId: string) {
  return `${CACHE_TAGS.qrImageContext}:${qrCodeId}`
}

type CacheByScopeOptions = {
  /** Override the default revalidation window (seconds). */
  revalidateSeconds?: number
}

export function cacheByScope<Value>(
  load: () => Promise<Value>,
  keyParts: readonly string[],
  tags: readonly string[],
  options: CacheByScopeOptions = {}
) {
  return unstable_cache(load, [...keyParts], {
    revalidate: options.revalidateSeconds ?? CACHE_REVALIDATE_SECONDS,
    tags: [...tags],
  })()
}

export function revalidateCacheTag(tag: string) {
  revalidateTag(tag, "max")
}

export function revalidateMerchantCacheTags(merchantId: string) {
  revalidateCacheTag(merchantCacheTag(merchantId))
  revalidateCacheTag(loyaltyCardSetupCacheTag(merchantId))
  revalidateCacheTag(merchantActivitySummaryCacheTag(merchantId))
}

export function revalidateMerchantOnboardingCache(userId: string) {
  revalidateCacheTag(merchantOnboardingCacheTag(userId))
}
