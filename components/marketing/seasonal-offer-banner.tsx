import { CampaignStrip } from "./pricing/campaign-strip"

/**
 * SeasonalOfferBanner — the standalone card-shaped seasonal offer.
 * Retained as a named alias so the merchant billing and landing call sites
 * keep a stable import; the markup now lives in CampaignStrip.
 */
export function SeasonalOfferBanner({ className }: { className?: string }) {
  return <CampaignStrip variant="card" className={className} />
}
