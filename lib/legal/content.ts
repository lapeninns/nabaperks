import {
  GUARANTEE,
  GUARANTEE_ROI,
  LEGAL_CONTACT,
  PRODUCT,
} from "@/lib/marketing/facts"

export type LegalSection = {
  id: string
  title: string
  body: string
}

export const CUSTOMER_LEGAL_VERSION = "2026-07-19"

export const NO_ADDITIONAL_EXCLUSIONS = "No additional exclusions configured."

export const PLATFORM_TERMS_SECTIONS: LegalSection[] = [
  {
    id: "using-nabaperks",
    title: "Using Nabaperks",
    body: "Nabaperks provides browser-based loyalty cards for participating venues. Each venue runs its own card and controls its stamp target, rewards, exclusions, and venue-specific terms. Joining one venue does not automatically join another, and no downloaded app or physical card is required.",
  },
  {
    id: "joining",
    title: "Joining a venue",
    body: "You join with a mobile phone number and a one-time code sent by text. You must select the required loyalty-terms control before a membership is created. The join screen provides the current venue terms, these platform terms, and the privacy notice. Nabaperks records the venue terms version and an immutable copy of the venue terms accepted for that membership.",
  },
  {
    id: "marketing",
    title: "Marketing choices",
    body: "Marketing is optional and separate from loyalty participation. Refusing or withdrawing a marketing choice does not stop you collecting stamps, checking progress, or redeeming an eligible reward. Identity codes, reward messages, and other service messages may still be sent when needed to complete a request or operate the loyalty card.",
  },
  {
    id: "stamps",
    title: "Collecting stamps",
    body: "A normal visit stamp requires a valid venue QR and an active membership, loyalty card, venue, and merchant subscription. Only one normal visit stamp can be earned for the same venue location on each Europe/London calendar date. Referral bonuses and audited support adjustments are recorded separately from normal visit stamps.",
  },
  {
    id: "reward-selection",
    title: "Reward selection",
    body: "When the final stamp completes your first loyalty cycle, Nabaperks assigns the venue's first active configured reward, ordered by the venue's display order and then by when the reward was created. Later completed cycles use the venue's configured reward weightings. A live venue card is kept with at least three active reward-pool items, but the reward you receive is fixed when it is issued.",
  },
  {
    id: "redemption",
    title: "Reward redemption",
    body: "A cycle reward becomes redeemable on the next Europe/London weekday after it is issued, skipping Saturday and Sunday. To generate and use the reward QR, you must provide your full name and date of birth, be at least 18, and have a verified email address. The venue completes redemption by scanning the reward QR.",
  },
  {
    id: "additional-rewards",
    title: "Referrals and additional rewards",
    body: "Where available, a referral qualifies only after a genuinely new member receives a normal venue visit stamp. A qualifying referral can add one bonus stamp to the referrer's card, subject to a limit of two referral bonus stamps on one Europe/London date and fraud, availability, and card-capacity checks. Venues may also issue birthday or direct rewards with their own displayed terms and expiry.",
  },
  {
    id: "location-and-fraud",
    title: "Location checks and suspected misuse",
    body: "A venue may enable a soft location check for a configured stamp. The current browser flow asks for location on the third stamp when the check is enabled. Refusing location, receiving an inaccurate result, or encountering a timeout does not by itself stop the stamp. Nabaperks and the venue may review QR misuse, duplicate claims, unusual stamp speed, out-of-range location evidence, manual adjustments, or concentrated referral activity.",
  },
  {
    id: "availability",
    title: "Availability",
    body: "Joining, stamping, issuing rewards, or redeeming may be paused when a venue, loyalty card, or QR is inactive, a reward is not yet redeemable, or the merchant's billing state is not active or trialling. When billing is no longer active or trialling, existing rewards cannot be redeemed through the current product flow.",
  },
  {
    id: "records-and-support",
    title: "Records and support",
    body: `Stamp, reward, consent, fraud, billing, and support actions are kept as event and audit records so later corrections do not silently rewrite the original history. For loyalty, privacy, access, export, deletion, or consent support, contact ${LEGAL_CONTACT.supportEmail}.`,
  },
]

export const PLATFORM_TERMS_META = {
  eyebrow: "For customers · effective 19 July 2026",
  title: "Nabaperks customer terms.",
  description:
    "The terms for keeping venue loyalty cards, collecting stamps, and redeeming rewards through Nabaperks.",
  cardTitle: "Customer terms",
  docNumber: "CT-2026-07",
}

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "data-collected",
    title: "Information held",
    body: "For customers, Nabaperks may hold a verified phone identity, phone country and last four digits, full name, date of birth, email and verification state. It also records venue memberships, accepted venue terms, stamps, rewards, referrals, consent choices, notifications, push subscriptions, fraud signals, sessions, product events, and support activity. For merchants, it may hold account, venue, address, loyalty-card, reward, QR, subscription, billing-reference, operational, support, cancellation-interview, and approved commercial-evidence records. Commercial evidence can include an approved attribution, before-and-after notes, a testimonial, reproducible aggregate metric snapshots, and secure references to supporting screenshots, recordings, or transcripts.",
  },
  {
    id: "identity-protection",
    title: "Identity protection",
    body: "Verified customer phone numbers are encrypted at rest. Nabaperks also stores keyed digests for matching and limited phone details for masked display. Customer sessions use signed cookies backed by revocable server-side session records. Pending reward-invite records use keyed digests and masked contact details rather than storing the invitation contact in plain text.",
  },
  {
    id: "uses",
    title: "How information is used",
    body: "Information is used to verify identity, provide venue loyalty cards, record accepted venue terms, issue stamps and rewards, complete redemptions, operate referrals, send requested or operational messages, manage merchant subscriptions, prevent misuse, answer support requests, run retention and privacy workflows, and maintain product and audit records.",
  },
  {
    id: "location",
    title: "Location information",
    body: "Where a venue enables a soft location check, the browser may ask for your current position. The coordinates are used during the stamp request to calculate distance from the venue. The current stamp record stores the resulting status and broad distance, accuracy, confidence, and timing buckets rather than the submitted raw coordinates. Refusing location, receiving an inaccurate reading, or encountering a timeout does not by itself block the stamp.",
  },
  {
    id: "access",
    title: "Venue and support access",
    body: "Customer loyalty records are linked to the relevant venue. Authenticated venue users can use venue-scoped tools to operate memberships, stamps, rewards, communications, and reporting. Authorised Nabaperks support tools can access records for privacy requests, fraud review, billing support, retention work, and audited corrections. Administrative actions are recorded.",
  },
  {
    id: "services",
    title: "Services used",
    body: "The current application uses Supabase and PostgreSQL for application data and authentication, Stripe for merchant subscriptions, Twilio Verify for customer phone codes, Resend for email, browser Web Push services for optional notifications, and Vercel for deployment and scheduled jobs. Optional integrations include PostHog for pseudonymous server-side analytics, Google Places for merchant venue suggestions, and OpenStreetMap Nominatim for venue-address geocoding.",
  },
  {
    id: "communications",
    title: "Marketing and service messages",
    body: "Marketing choices are optional and recorded separately from loyalty participation. Identity codes, reward messages, invitation messages, and other service communications may still be sent where needed to complete a request or operate the service. A venue may create a one-time reward invitation for a contact it supplies; the stored invite is deduplicated, expires after 90 days, and is matched only after the contact is verified. Separately, a venue on the invitations pilot may email addresses it has a lawful basis to contact a one-off invitation worth two welcome stamps; those addresses are stored encrypted, every email identifies the venue and carries a one-click venue-scoped unsubscribe, and the invitation link expires after 30 days. Accepting an invitation does not opt the customer into any further marketing.",
  },
  {
    id: "analytics",
    title: "Analytics",
    body: "First-party session measurement and product events are stored in Nabaperks. Public marketing pages also send limited browser performance measurements: the metric name, value, rating, page category, and navigation type. These measurements do not include a raw URL, contact details, precise location, or a stored IP address and are deleted after 90 days. Optional pseudonymous PostHog processing is disabled unless it is configured. Contact, form, provider, URL, and precise-location values are excluded and are not sent to PostHog; IP addresses, tokens, secrets, and provider identifiers are also rejected from its payload.",
  },
  {
    id: "retention",
    title: "Retention and anonymisation",
    body: "Pending phone and email verification cookies last 10 minutes, join-journey cookies last two hours, customer sessions normally last 30 days, and the device cookie lasts one year. Public-page browser performance samples are deleted after 90 days. Verified customer identities with no protected loyalty, consent, referral, session, request, or invitation history are eligible for anonymisation after seven days. Other stale customer identifiers are eligible for anonymisation after 365 days without recent customer, membership, stamp, or reward activity. Pending reward invitations expire after 90 days, their matching details are scrubbed, and terminal invite records are eligible for deletion after 365 days. Bulk loyalty invitation recipients are stored as encrypted contact; their address, masked readback, and link tokens are scrubbed when the invitation is claimed, when the campaign is cancelled, or after its 30-day link expiry; abandoned invitation drafts are purged after 24 hours; contact-free terminal recipient records are deleted after 365 days; and unsubscribe suppression hashes are retained to keep honouring opt-outs. Loyalty, consent, fraud, billing, product-event, and audit records do not have a general automatic deletion period encoded in the current application and may remain in anonymised form.",
  },
  {
    id: "requests",
    title: "Access, export, deletion, and consent requests",
    body: "Customers can ask for privacy, access, export, deletion, or consent support. The current workflow uses audited administrative tools. Customer exports can include profile details, memberships, stamps, rewards, consent records, notifications, and first-party product events. Deletion revokes customer sessions, disables push subscriptions, cancels queued notifications, scrubs linked pending invitations, and anonymises direct identifiers where ledger records must remain. Exports and deletions also cover the customer's bulk loyalty invitation records.",
  },
  {
    id: "browser-storage",
    title: "Cookies and browser storage",
    body: "Nabaperks uses essential authentication, verification, device, journey, and interface-state cookies, plus limited local storage, session storage, service-worker caches, and optional push-subscription data. The cookie and browser-storage notice lists the current items and durations.",
  },
  {
    id: "contact",
    title: "Contact",
    body: `For privacy, access, export, deletion, or consent requests, contact ${LEGAL_CONTACT.privacyEmail}. Include enough information to identify the relevant customer or merchant record, but do not send passwords or one-time codes.`,
  },
]

export const PRIVACY_META = {
  eyebrow: "For customers and merchants · effective 15 July 2026",
  title: "Nabaperks privacy notice.",
  description:
    "How Nabaperks collects, uses, shares, retains, and removes information about customers and merchants.",
  cardTitle: "Privacy notice",
  docNumber: "PN-2026-07",
}

export const COOKIE_SECTIONS: LegalSection[] = [
  {
    id: "customer-cookies",
    title: "Customer verification and session cookies",
    body: "The HttpOnly nabaperks_pending_phone and nabaperks_pending_email cookies each last up to 10 minutes while a phone number or email is checked. After phone verification, the signed HttpOnly nabaperks_customer_session cookie normally lasts 30 days and identifies a revocable server-side customer session.",
  },
  {
    id: "device-cookie",
    title: "Device and rate-limit cookie",
    body: "The HttpOnly nabaperks_device cookie is created on application routes and lasts up to one year. It supplies a signed device identifier used by security and rate-limit controls. It is not an authoritative customer, loyalty, reward, or consent record.",
  },
  {
    id: "journey-cookie",
    title: "Join-journey cookie",
    body: "The HttpOnly nabaperks_join_journey cookie lasts up to two hours on QR and customer-join journeys. It links steps in the same join flow for first-party observability without placing contact details in the token.",
  },
  {
    id: "merchant-auth",
    title: "Merchant and administrator authentication",
    body: "Merchant and administrator sign-in uses Supabase authentication cookies. These cookies support authenticated sessions and are refreshed or removed through the authentication flow. Their exact names and duration are controlled by the current Supabase session configuration.",
  },
  {
    id: "interface-cookie",
    title: "Interface preference cookie",
    body: "The merchant interface may store a sidebar_state cookie for up to one year so it can remember whether the sidebar was expanded or collapsed.",
  },
  {
    id: "session-storage",
    title: "Session storage",
    body: "Nabaperks uses sessionStorage for short-lived information in the current browser tab or session. This includes first-party marketing-funnel continuity and rotating venue-proof selections. The funnel uses a session-only token rather than a persistent browser analytics identity.",
  },
  {
    id: "local-storage",
    title: "Local storage",
    body: "Local storage may hold an in-progress merchant onboarding draft, a remembered refusal of the soft location prompt, dismissal of the app-install prompt, and dismissal of the birthday-profile prompt. The birthday dismissal is reconsidered after 30 days. Other entries remain until replaced, removed by the application, or cleared in the browser. None is authoritative server-side loyalty, billing, reward, or consent state.",
  },
  {
    id: "offline-cache",
    title: "Offline cache",
    body: "The Nabaperks service worker caches the offline page, selected icons, and static application assets. Authenticated application routes, customer state, and API requests are treated as network-only and are not used as an offline source of truth.",
  },
  {
    id: "push-and-analytics",
    title: "Push notifications and analytics",
    body: "If you enable browser push notifications, Nabaperks stores the browser push endpoint and encryption keys needed to deliver messages. Erasure disables stored subscriptions and cancels queued notifications. Optional PostHog analytics is sent from the server only when pseudonymous processing is configured; the current implementation does not create a PostHog browser cookie or persistent PostHog browser identity.",
  },
  {
    id: "controls",
    title: "Your browser controls",
    body: "You can remove cookies, local storage, session storage, cached assets, and notification permissions through your browser settings. Blocking authentication or verification cookies prevents the related signed-in or identity-checking features from working. Clearing convenience storage can reset drafts, dismissals, or interface preferences without deleting server-side loyalty records.",
  },
]

export const COOKIE_META = {
  eyebrow: "Browser data · effective 15 July 2026",
  title: "Cookie and browser-storage notice.",
  description:
    "The cookies, local browser storage, offline cache, and push information used by Nabaperks.",
  cardTitle: "Browser storage",
  docNumber: "CS-2026-07",
}

export const MERCHANT_TERMS_SECTIONS: LegalSection[] = [
  {
    id: "service",
    title: "The service",
    body: "The Nabaperks Growth Plan is provided per venue location. It includes browser-based loyalty cards, joining and stamping QR flows, reward configuration, venue-scoped customer and activity records, referrals where available, reporting, notifications, and supported operational tools.",
  },
  {
    id: "account",
    title: "Merchant account",
    body: "A merchant account is created with a name, email address, password, and emailed verification code. The merchant is responsible for keeping its sign-in and billing access secure and for ensuring that people using the account are authorised to act for the venue.",
  },
  {
    id: "price-and-trial",
    title: "Launch fee, recurring price and free pilot",
    body: `The Growth Plan has a one-off ${PRODUCT.launchFee} launch fee per venue, charged at checkout. That fee covers the physical and configured launch and is not waived for annual billing. ${PRODUCT.fulfilmentAllowance} The 28-day platform pilot begins when the posters are delivered and delivery is confirmed in Nabaperks. At checkout, the merchant chooses either ${PRODUCT.price} (${PRODUCT.billingDisclosure}) or ${PRODUCT.annualPrice} paid in advance (${PRODUCT.annualBillingDisclosure} ${PRODUCT.annualSaving}). The selected recurring charge begins after the delivery-anchored pilot unless the subscription is cancelled or the pilot is extended through the First-Regular Guarantee support process. The annual subscription renews yearly at the then-disclosed annual price unless renewal is cancelled before the renewal date. The launch includes venue and loyalty-card configuration, a margin-safe reward setup, and the first bespoke A4 counter-poster run with delivery. Nabaperks does not add a separate card-processing surcharge.`,
  },
  {
    id: "activation",
    title: "Activation and billing state",
    body: "A venue can prepare its profile, loyalty card, and rewards before billing activation. Normal customer joins, stamps, reward issue, and redemption require the stored merchant billing state to be active or trialling. Missing, cancelled, suspended, past-due, unpaid, paused, or otherwise blocked billing states pause the affected loyalty operations.",
  },
  {
    id: "merchant-responsibilities",
    title: "Merchant responsibilities",
    body: "The merchant is responsible for accurate venue details, its stamp target, at least three active rewards while a live join QR is enabled, clear reward terms and exclusions, and honouring valid rewards presented through the venue scan flow. The merchant must not publish or reuse passwords, one-time codes, secret keys, signed claim links, or reward scan tokens outside their intended flow.",
  },
  {
    id: "customer-use",
    title: "Customer records and communications",
    body: "The merchant must use customer records through the venue-scoped Nabaperks tools and for the venue loyalty purposes represented by those tools. Marketing choices remain separate from loyalty participation. Merchant-created announcements are subject to stored consent and delivery controls. Reward invitations are subject to eligibility, deduplication, suppression, expiry, and delivery controls.",
  },
  {
    id: "cancellation",
    title: "Cancellation and exit review",
    body: "The merchant starts cancellation from the Nabaperks billing page and completes a short exit review before Stripe opens the subscription-cancellation flow. The review records the main reason, optional detail, and whether the merchant wants a support call or another available resolution. It does not remove the merchant's right to cancel. A scheduled cancellation takes effect at the end of the current subscription period recorded by Stripe; an annual prepayment is not automatically refunded merely because renewal is cancelled. Cancelling future renewal does not erase loyalty, reward, consent, billing, product-event, cancellation-interview, or audit records. Customer joins, stamps, reward issue, and redemption are paused when the stored subscription is no longer active or trialling.",
  },
  {
    id: "guarantee",
    title: "First-Regular Guarantee",
    body: `${GUARANTEE.line} A returning member is a customer who receives another normal visit stamp on a later Europe/London date. ${GUARANTEE.applies} ${GUARANTEE.claim} An extension delays recurring billing. It is applied manually through support; it is not an automatic refund or cash payment.`,
  },
  {
    id: "roi-extension",
    title: "90-Day ROI Extension",
    body: `${GUARANTEE_ROI.line} ${GUARANTEE_ROI.starts} A verified return visit is a normal visit stamp recorded for a member after that member already received a normal visit stamp on an earlier Europe/London date. ${GUARANTEE_ROI.conditions} ${GUARANTEE_ROI.claimWindow} Nabaperks validates the dashboard ledger and the operating conditions. For a valid claim on 28-day billing, it applies a 100% discount to the next three renewal invoices; unused discounts end if the subscription is cancelled before those invoices. For a valid annual-prepay claim, it refunds £209.97 from the current annual subscription payment. Nabaperks applies the discount or submits the refund within 10 calendar days after validation. The extension is a service-price remedy, not a promise of revenue, profit, or filled tables.`,
  },
  {
    id: "commercial-evidence",
    title: "Commercial evidence and testimonials",
    body: "Nabaperks may invite a merchant to contribute a case study, testimonial, screenshot, or recorded before-and-after account. Participation is optional. Nothing is published unless the merchant's approval, approved attribution, source reference, and approval evidence are recorded. Aggregate product metrics are snapshotted from the underlying loyalty ledgers under a versioned definition so the published figure can be reproduced. A merchant may ask Nabaperks to stop new publication of its attributed evidence; the withdrawal and any required historical record are retained in the audit trail.",
  },
  {
    id: "first-regular-promo",
    title: "Time-limited promotions",
    body: `A seasonal name or time-limited wrapper applies only during its fixed displayed campaign window. It does not change the standard launch deliverables, either Growth Plan billing option, or either guarantee. The checkout must show the active wrapper and deadline; an expired wrapper is not silently renewed. Questions about fulfilment can be sent to ${LEGAL_CONTACT.supportEmail}.`,
  },
  {
    id: "support-and-records",
    title: "Support and records",
    body: "Nabaperks support may use audited tools to investigate billing problems, fraud signals, privacy requests, reward-invite suppression, and ledger corrections. Existing events are preserved or corrected with an additional audit trail rather than silently rewritten.",
  },
]

export const MERCHANT_TERMS_META = {
  eyebrow: "For venue operators · effective 31 July 2026",
  title: "Merchant subscription terms.",
  description:
    "The commercial and operational terms for a venue using the Nabaperks Growth Plan.",
  cardTitle: "Merchant terms",
  docNumber: "MT-2026-07-31",
}

export const DATA_PROCESSING_SECTIONS: LegalSection[] = [
  {
    id: "scope",
    title: "Processing scope",
    body: "This technical schedule describes the information handled while Nabaperks provides a venue subscription. It does not assign controller, processor, or joint-controller roles that are not established by the repository. Processing supports merchant and customer authentication, venue memberships, accepted loyalty terms, stamps, rewards, scans, referrals, communications, subscriptions, fraud controls, support, analytics, retention, and audit records.",
  },
  {
    id: "people-and-data",
    title: "People and data categories",
    body: "Affected people may include customers, prospective reward recipients, merchant owners and users, administrators, and support users. Customer data may include phone identity, phone country and last four digits, name, date of birth, email, verification state, memberships, accepted terms, stamps, rewards, referrals, consent, notifications, push subscriptions, fraud evidence, sessions, and support history. Merchant data may include authentication, venue and address details, coordinates, card and reward settings, QR records, billing references, product events, and audit records.",
  },
  {
    id: "operations",
    title: "Processing operations",
    body: "The application collects, validates, encrypts, hashes, stores, queries, displays, transmits, updates, exports, suppresses, revokes, anonymises, and deletes information according to the relevant product flow. Server state is authoritative; browser storage is used only for authentication, journey continuity, security, convenience, offline assets, and optional notifications.",
  },
  {
    id: "access-and-scoping",
    title: "Access and venue scoping",
    body: "Customer loyalty information is linked to the relevant merchant and membership. Authenticated merchant tools use venue-scoped database operations. Trusted server jobs use privileged credentials only in server-side code. Nabaperks administrative access supports privacy requests, fraud review, billing support, retention jobs, and auditable corrections.",
  },
  {
    id: "security",
    title: "Implemented security measures",
    body: "Implemented controls include encrypted customer phone values, keyed digests for identity and invitation matching, signed and revocable customer sessions, HttpOnly verification and session cookies, Supabase authentication, database row-level controls, service-role-only administrative functions, signed Stripe webhook verification, time-limited one-time checks, single-use merchant-scoped reward scan tokens, rate limits, security headers, and audit records for privileged actions.",
  },
  {
    id: "external-services",
    title: "External services",
    body: "The current application can send relevant data to Supabase and PostgreSQL for data and authentication, Stripe for subscriptions and billing, Twilio Verify for phone codes, Resend for email, browser Web Push services for push delivery, Vercel for deployment and scheduled jobs, Google Places for optional venue suggestions, OpenStreetMap Nominatim for venue-address geocoding, and PostHog for optional pseudonymous server-side analytics.",
  },
  {
    id: "marketing-and-analytics",
    title: "Marketing and analytics controls",
    body: "Customer marketing choices are stored separately from loyalty participation. First-party product events are stored in Supabase. Optional PostHog processing uses server-generated pseudonyms and an allowlist of properties; contact details, IP addresses, URLs, precise coordinates, provider identifiers, tokens, and secrets are rejected from the external analytics payload.",
  },
  {
    id: "requests",
    title: "Privacy requests and exports",
    body: "Privacy, access, export, deletion, and consent requests are executed through audited administrative workflows. Current customer exports include profile information, memberships, stamps, rewards, consent records, notifications, and first-party product events. A deletion request revokes sessions, disables push subscriptions, cancels queued notifications, scrubs linked pending invitations, and anonymises direct customer identifiers where the ledger must remain.",
  },
  {
    id: "retention",
    title: "Retention and deletion",
    body: "Abandoned verified customer identities without protected activity are eligible for anonymisation after seven days. Other stale customer identifiers are eligible for anonymisation after 365 days without recent customer, membership, stamp, or reward activity. Pending reward invitations expire after 90 days, matching details are scrubbed, and terminal invitation rows are eligible for deletion after 365 days. Bulk loyalty invitation recipient contact is stored encrypted and scrubbed at a terminal state or 30-day link expiry, abandoned drafts are purged after 24 hours, and contact-free terminal rows are deleted after 365 days, while unsubscribe suppression hashes are retained. Loyalty, consent, fraud, billing, product-event, and audit records may remain in anonymised form because the current application does not encode a general deletion period for those ledgers.",
  },
  {
    id: "end-of-service",
    title: "End of merchant service",
    body: "When a merchant subscription is cancelled, Stripe and Nabaperks retain the recorded subscription state and cancellation timing. Loyalty operations are paused when billing is no longer active or trialling. Cancellation does not automatically delete customer loyalty, reward, consent, billing, product-event, fraud, or audit records, and privacy requests continue through the audited request workflow.",
  },
]

export const DATA_PROCESSING_META = {
  eyebrow: "Technical schedule · effective 15 July 2026",
  title: "Merchant data-processing schedule.",
  description:
    "The customer and merchant information handled while Nabaperks provides a venue subscription.",
  cardTitle: "Data handling",
  docNumber: "DP-2026-07",
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
      id: "joining",
      title: "Joining the card",
      body: "Join by verifying your mobile phone number and accepting these venue terms and the Nabaperks customer terms after being shown the privacy notice. Marketing is optional and is not required to keep the card, collect stamps, or redeem an eligible reward.",
    },
    {
      id: "earning-rule",
      title: "Earning rule",
      body: `Collect ${stampsRequired} normal visit stamps using a valid venue QR. Only one normal visit stamp can be earned for this venue location on each Europe/London calendar date. A valid QR join normally attempts to add the first eligible stamp.`,
    },
    {
      id: "reward",
      title: "Reward selection",
      body: "When you earn the final stamp, your first completed cycle receives the venue's first active configured reward. Later completed cycles use the venue's configured reward weightings. The assigned reward and its terms are fixed when it is issued.",
    },
    {
      id: "redemption",
      title: "Redemption",
      body: "A cycle reward is redeemable from the next Europe/London weekday after it is issued, skipping Saturday and Sunday. Before generating its reward QR, you must provide your full name and date of birth, be at least 18, and have a verified email address. Show the reward QR at the counter for the venue team to scan.",
    },
    {
      id: "exclusions",
      title: "Exclusions",
      body: rewardTerms || NO_ADDITIONAL_EXCLUSIONS,
    },
    {
      id: "referrals-and-additional-rewards",
      title: "Referrals and additional rewards",
      body: "Where referrals are available, a referral qualifies only after a genuinely new member receives a normal venue visit stamp. A qualifying referral can add one bonus stamp to the referrer's card, subject to a limit of two referral bonus stamps on one Europe/London date and availability, capacity, and fraud checks. The venue may also issue birthday or direct rewards with their own displayed terms and expiry.",
    },
    {
      id: "fraud-and-abuse",
      title: "Location, fraud, and corrections",
      body: "The venue may enable a soft location check. Refusing location, receiving an inaccurate result, or encountering a timeout does not by itself stop the stamp. Nabaperks and the venue may review QR misuse, duplicate claims, unusual stamp speed, out-of-range location evidence, manual adjustments, or concentrated referral activity. Audited support actions may correct the ledger.",
    },
    {
      id: "availability",
      title: "Availability",
      body: "New joins, stamps, reward issue, and redemption may be paused if the venue, card, or QR is inactive, the reward is not yet redeemable, or the venue's Nabaperks subscription is not active or trialling.",
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
      "These venue terms are shown before you join and stay available from your loyalty card.",
    cardTitle: "Reward terms",
  }
}
