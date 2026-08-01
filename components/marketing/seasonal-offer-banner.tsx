import { CampaignStrip } from "./pricing/campaign-strip"

/**
 * SeasonalOfferBanner — the standalone card-shaped seasonal offer.
 * Retained as a named alias so the landing call site
 * (components/marketing/landing/landing-pricing.tsx), its only remaining
 * consumer, keeps a stable import; the markup now lives in CampaignStrip.
 */
export function SeasonalOfferBanner({ className }: { className?: string }) {
  return <CampaignStrip variant="card" className={className} />
}
