import { describeOfferCampaignJourney } from "./offer-campaign-flow"

/**
 * The Old Crown offer journey on the mobile project. A non-desktop spec runs on
 * mobile-safari only, and the poster, the pass and the counter are all phone
 * surfaces, so this is the primary run — see offer-campaign.desktop.spec.ts for
 * the same body on the desktop projects.
 */
describeOfferCampaignJourney()
