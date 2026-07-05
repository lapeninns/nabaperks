export type LegalSection = {
  id: string
  title: string
  body: string
}

/**
 * Fallback shown for a venue's reward exclusions when the merchant has set none.
 * Exported so the few places that special-case it (e.g. hiding it as a reward
 * description in reward-list-cards) compare against one source of truth rather
 * than a copy-pasted string literal that can silently drift.
 */
export const NO_ADDITIONAL_EXCLUSIONS = "No additional exclusions configured."

export const PLATFORM_TERMS_SECTIONS: LegalSection[] = [
  {
    id: "participation",
    title: "Participation",
    body: "Customers may join a merchant loyalty card after verifying their phone number and accepting the loyalty terms. The card is browser-based and does not require a downloaded app or physical plastic card.",
  },
  {
    id: "merchant-reward-terms",
    title: "Merchant-controlled reward terms",
    body: "Each merchant controls its reward description, earning rules, exclusions, and venue-specific participation terms. Merchant reward terms are shown before joining and on the merchant terms page.",
  },
  {
    id: "marketing",
    title: "Optional marketing opt-in",
    body: "Marketing opt-in is optional and separate from loyalty participation. Declining marketing does not stop a customer collecting stamps, seeing progress, or redeeming earned rewards.",
  },
  {
    id: "abuse",
    title: "Abuse and fraud prevention",
    body: "Nabaperks and merchants may investigate suspicious activity, duplicate claims, QR misuse, manual adjustments, soft geofence anomalies, or fraud signals. Soft location checks use minimized location evidence for fraud prevention; stamps still save if location is denied, unavailable, timed out, or inaccurate. One stamp can be issued per customer per UK business day, and audited support actions preserve event history rather than deleting earned history silently.",
  },
  {
    id: "availability",
    title: "Availability restrictions",
    body: "The service may restrict new joins, stamps, QR scans, or redemptions when a merchant loyalty card is inactive, QR access is disabled, a reward is not yet redeemable, or billing is suspended.",
  },
  {
    id: "first-regular-guarantee",
    title: "First-Regular Guarantee",
    body: "Venue pilots carry the First-Regular Guarantee: if a venue's live loyalty card has not recorded its first returning member — a customer who stamps again on a later UK date — by the end of the 30-day free pilot, Nabaperks extends the free pilot at no charge until it does. The guarantee applies from the day the venue QR goes live and is claimed through support.",
  },
]

export const PLATFORM_TERMS_META = {
  eyebrow: "For venue operators · plain English summary",
  title: "The small print, kept legible.",
  description:
    "How customer participation, rewards, marketing consent, and fraud prevention work on Nabaperks. The full text travels with your merchant agreement.",
  cardTitle: "Terms, condensed",
  docNumber: "T-2026",
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "data-collected",
    title: "Data collected",
    body: "Nabaperks stores the verified phone identity used by a customer, merchant loyalty membership records, stamp events, reward events, consent records, QR and billing status signals, and support audit logs. Customer phone numbers are stored for lookup and display using protected server-side helpers.",
  },
  {
    id: "purposes",
    title: "Purposes",
    body: "Data is used to provide the loyalty card, show progress, unlock and redeem rewards, prevent misuse, support merchants and customers, keep audit evidence, and measure service performance. Where a venue uses soft GPS checks, Nabaperks stores minimized location evidence for fraud prevention; raw coordinates are not stored by default.",
  },
  {
    id: "marketing-consent",
    title: "Marketing consent separation",
    body: "Loyalty participation is separate from marketing. Customers can collect stamps without opting in to marketing, and marketing opt-in or opt-out evidence is kept in consent records.",
  },
  {
    id: "sharing-and-scoping",
    title: "Sharing, scoping, and support access",
    body: "Customer loyalty data is scoped to the relevant merchant and Nabaperks support administrators. Admin access is used for support, fraud review, privacy requests, and audited operational tasks. PostHog analytics receives minimized event properties where configured.",
  },
  {
    id: "data-requests",
    title: "Data requests",
    body: "Customers can ask for privacy, access, deletion, export, or consent support. Internal admins use audited lookup tools to identify the relevant customer and merchant records and record the request channel.",
  },
  {
    id: "audit-records",
    title: "Audit and support records",
    body: "Support notes, consent records, fraud signals, manual adjustments, and admin actions may be retained as audit evidence so reward history and support decisions remain accountable.",
  },
]

export const PRIVACY_META = {
  eyebrow: "For venue operators · plain English summary",
  title: "What happens to your customers' data.",
  description:
    "How Nabaperks handles loyalty records, consent separation, support access, and audit evidence for your venue. The full notice travels with your merchant agreement.",
  cardTitle: "Privacy, condensed",
  docNumber: "P-2026",
}

export type VenueTermsInput = {
  merchantName: string
  stampsRequired: number
  rewardTerms: string
  contact?: string
}

export function buildVenueTermsSections({
  stampsRequired,
  rewardTerms,
  contact,
}: VenueTermsInput): LegalSection[] {
  return [
    {
      id: "reward",
      title: "Reward",
      body: "A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp.",
    },
    {
      id: "earning-rule",
      title: "Earning rule",
      body: `Collect ${stampsRequired} visit stamps from the venue QR. One stamp may be issued per UK date.`,
    },
    {
      id: "stamps-needed",
      title: "Stamps needed",
      body: `${stampsRequired} stamps`,
    },
    {
      id: "redemption",
      title: "Redemption",
      body: "The assigned reward can be redeemed from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it.",
    },
    {
      id: "exclusions",
      title: "Exclusions",
      body: rewardTerms || NO_ADDITIONAL_EXCLUSIONS,
    },
    {
      id: "fraud-and-abuse",
      title: "Fraud and abuse",
      body: "The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. Location checks are non-blocking: stamps still save if location is denied, unavailable, timed out, or inaccurate.",
    },
    {
      id: "merchant-contact",
      title: "Merchant contact",
      body: contact || "Ask the venue team",
    },
  ]
}

export function venueTermsMeta(merchantName: string) {
  return {
    title: `${merchantName} loyalty terms`,
    description:
      "These loyalty terms are shown before you join and stay available from your loyalty card.",
    cardTitle: "Reward terms",
  }
}
