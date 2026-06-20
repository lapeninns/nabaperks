export type LegalSection = {
  id: string
  title: string
  body: string
}

export const PLATFORM_TERMS_SECTIONS: LegalSection[] = [
  {
    id: "participation",
    title: "Participation",
    body: "Customers may join a merchant loyalty card after verifying their phone number and accepting the loyalty terms. The card is browser-based and does not require a downloaded app or physical plastic card.",
  },
  {
    id: "merchant-reward-terms",
    title: "Merchant-controlled reward terms",
    body: "Each merchant controls its reward description, earning rules, minimum spend, exclusions, and venue-specific participation terms. Merchant reward terms are shown before joining and on the merchant terms page.",
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
    body: "The MVP may restrict new joins, stamps, QR scans, or redemptions when a merchant loyalty card is inactive, QR access is disabled, a reward is not yet redeemable, or billing is suspended.",
  },
]

export const PLATFORM_TERMS_META = {
  eyebrow: "Plain English summary · not the full legal text",
  title: "The small print, kept legible.",
  description:
    "Pilot terms for no-app QR loyalty participation, structured for readability. The full text travels with your merchant agreement and requires legal review before launch.",
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
    body: "Data is used to provide the loyalty card, show progress, unlock and redeem rewards, prevent misuse, support merchants and customers, keep audit evidence, and measure whether the MVP works. Where a venue uses soft GPS checks, Nabaperks stores minimized location evidence for fraud prevention; raw coordinates are not stored by default.",
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
  eyebrow: "Plain English summary · not the full legal text",
  title: "What happens to the data.",
  description:
    "MVP privacy wording for pilot support, consent separation, admin support scoping, and audit records. The full notice travels with your merchant agreement and needs legal review before launch.",
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
      id: "minimum-spend",
      title: "Minimum spend",
      body: "Minimum spend is applied by the assigned reward, if that reward has one.",
    },
    {
      id: "redemption",
      title: "Redemption",
      body: "The assigned reward can be redeemed from the next UK business day after it is revealed. Tap redeem from your reward page while you are at the venue.",
    },
    {
      id: "exclusions",
      title: "Exclusions",
      body: rewardTerms || "No additional exclusions configured.",
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
      "These MVP terms are shown to customers before participation and must be reviewed before launch.",
    cardTitle: "Reward terms",
  }
}
