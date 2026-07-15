# Copy Inventory — full cross-surface catalogue

_Generated 2026-07-04. Verbatim inventory of every user-facing string across the landing, merchant, admin, customer, and shared/notification surfaces. No judgement — raw catalogue. See `copy-duplication.md` for the duplication/drift analysis._

Each row: **verbatim copy · type · file:line · inline vs shared-module**.

## Index

1. **Landing / Marketing / Legal** — public website: root landing, about, pricing, /loyalty-for-pubs, guides, demo, start, terms, privacy; components/marketing, seo, brand; facts.ts, legal/content.ts
2. **Merchant Dashboard (/app)** — all /app routes + actions, merchant auth, components/merchant/**, lib/merchant copy modules
3. **Admin + Public Storefront** — app/admin/**, app/merchant/[merchantSlug]/** (customer-visible), components/admin/**
4. **Customer App (PWA + flows)** — app/home PWA, card/claim/reward/scan/join flows, components/customer, loyalty, pwa; lib/customer copy
5. **Shared UI + System + Notifications** — shared components, 404/500/offline, manifest, email/SMS/push copy



<hr>

# ▓ SURFACE: Landing / Marketing / Legal

# Copy Inventory — Landing / Marketing / Legal

_Scope: app/{page,layout,opengraph-image}.tsx, app/{about,pricing,loyalty-for-pubs,guides/*,demo,start,terms,privacy}; components/marketing/**, components/seo/**, components/brand/**; lib/marketing/facts.ts, lib/legal/content.ts_

---

## Root layout metadata — `app/layout.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks | applicationName / appleWebApp title | app/layout.tsx:32,63 | inline |
| Nabaperks — No-app QR loyalty for UK food & drink venues | metadata title.default | app/layout.tsx:35 | inline |
| %s \| Nabaperks | metadata title.template | app/layout.tsx:36 | inline |
| No-app QR loyalty cards for UK pubs, cafes and takeaways. Customers scan a venue QR and save a browser-based loyalty card — nothing to install — then collect counter-verified stamps. £29/month, 30-day free pilot. | metadata description | app/layout.tsx:37-38 | inline |

## OpenGraph image (site default) — `app/opengraph-image.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks — loyalty cards for pubs, cafes and takeaways. QR scan. Browser-based card. Counter-verified stamps. 30-day pilot, then £29/month. | og image alt | app/opengraph-image.tsx:11-12 | inline |
| N | logo glyph | app/opengraph-image.tsx:55 | inline |
| Nabaperks | wordmark | app/opengraph-image.tsx:58 | inline |
| Loyalty cards for pubs, cafes and takeaways | headline | app/opengraph-image.tsx:72 | inline |
| QR scan. Browser-based card. Counter-verified stamps. | subhead | app/opengraph-image.tsx:76 | inline |
| 30-day pilot, then £29/month | badge | app/opengraph-image.tsx:94 | inline |

## Home page — `app/page.tsx` (metadata + composition)
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| No-App QR Loyalty Cards for UK Pubs & Cafes | metadata title (base) | app/page.tsx:37 | inline |
| No-App QR Loyalty Cards for UK Pubs & Cafes \| Nabaperks | metadata title.absolute / OG / Twitter title | app/page.tsx:42,55,66 | inline |
| Replace paper stamp cards with one venue QR. Customers scan, save a browser-based loyalty card (no app, no wallet pass), and collect counter-verified stamps. £29/mo, 30-day free pilot. | metadata + OG + Twitter description | app/page.tsx:38-39 | inline |
| How it works | nav link label | app/page.tsx:75 | inline |
| Pricing | nav link label | app/page.tsx:76 | inline |
| Log in | nav link label | app/page.tsx:77 | inline |

_Note: JSON-LD `description` fields on this page (SoftwareApplication line 120-121, Offer line 128-130) are structured data, not on-screen copy — excluded per rules._

## About — `app/about/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| About Nabaperks | metadata title | app/about/page.tsx:18 | inline |
| Nabaperks is built and run by Lapen Inns, a hospitality operator running 9 pubs across England. A browser-based loyalty card with counter-verified stamps, made by people who run the counter. | metadata description (interpolated) | app/about/page.tsx:19 | inline + shared:facts.ts |
| About | eyebrow (PageTitle) | app/about/page.tsx:71 | inline |
| The operator behind Nabaperks. | h1 (PageTitle title) | app/about/page.tsx:72 | inline |
| Nabaperks is built and run by Lapen Inns — a hospitality operator running 9 pubs across England. | PageTitle description (interpolated) | app/about/page.tsx:73 | inline + shared:facts.ts |
| We make a browser-based loyalty card with counter-verified stamps — and we run it across our own bars before we ask anyone else to. | body paragraph (story[0]) | app/about/page.tsx:45 | inline |
| We built it because the loyalty tools we tried got in the way of the counter: an app to download for a pint, a wallet pass to install, paper cards lost in the wash, or a POS we did not want to replace. So we made the opposite — a card that opens from a QR in the browser, saves in one tap, and verifies every stamp at the counter. | body paragraph (story[1]) | app/about/page.tsx:46 | inline |
| That operator's view is the whole point. Nabaperks is shaped by what actually works on a busy shift, in a real pub, with real regulars. | body paragraph (story[2]) | app/about/page.tsx:47 | inline |
| Built by an operator that runs its own pubs, not a software house guessing at the counter | principle list item | app/about/page.tsx:51 | inline |
| No extra hardware. No POS or EPOS integration required. | principle list item (PRODUCT.posLine) | app/about/page.tsx:52 | shared:facts.ts |
| Loyalty kept separate from marketing — a regular can collect and redeem without joining any list | principle list item | app/about/page.tsx:53 | inline |
| Counter-verified stamps, so a finished card always means a real regular | principle list item | app/about/page.tsx:54 | inline |
| Operator | eyebrow (fact card) | app/about/page.tsx:108 | inline |
| Lapen Inns | operator name | app/about/page.tsx:109 | shared:facts.ts |
| hospitality operator · England, United Kingdom | operator meta (interpolated role·region·country) | app/about/page.tsx:110-111 | shared:facts.ts |
| Contact | eyebrow | app/about/page.tsx:114 | inline |
| info@lapeninns.com | contact email (link text) | app/about/page.tsx:120 | shared:facts.ts |
| The same address is our privacy and data contact. See our privacy summary. | helper text + link "privacy summary" | app/about/page.tsx:122-130 | inline |
| Our pubs | MonoTag | app/about/page.tsx:139 | inline |
| 9 pubs across England. | h2 (estateShort interpolated) | app/about/page.tsx:141 | shared:facts.ts |
| The Lapen Inns estate — the pubs where Nabaperks is built, run and pressure-tested. | body paragraph (interpolated name) | app/about/page.tsx:143-146 | inline + shared:facts.ts |
| The Prince of Wales / Old School House / Barley Mow / The Queen Elizabeth / The Railway / The Bell / Old Crown / The Corner House / White Horse | estate pub names (list) | app/about/page.tsx:154 (OPERATOR_ESTATE) | shared:facts.ts |
| MK43 8PE · England (and 8 more postcodes · England) | estate pub meta (postcode·region) | app/about/page.tsx:157-158 | shared:facts.ts |
| Run a venue? Try it on your own counter. | h2 (CTA) | app/about/page.tsx:168-170 | inline |
| Build your card, preview the QR flow, and start a 30-day free pilot. Card required — cancel anytime. | CTA body (PRODUCT.pilot interpolated) | app/about/page.tsx:171-174 | inline + shared:facts.ts |
| Start free pilot | button (CTA.startPilot) | app/about/page.tsx:177 | shared:facts.ts |
| Loyalty for pubs | button (CTA.pub) | app/about/page.tsx:180 | shared:facts.ts |

## Pricing — `app/pricing/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pricing — £29/month per venue | metadata title | app/pricing/page.tsx:22 | inline |
| Start with a 30-day free pilot, then £29/month per venue. Card required — cancel anytime. | metadata description (interpolated) | app/pricing/page.tsx:23 | inline + shared:facts.ts |
| Unlimited stamps and members | plan include item | app/pricing/page.tsx:54 | inline |
| Simple reward setup | plan include item | app/pricing/page.tsx:55 | inline |
| Permanent venue QR | plan include item | app/pricing/page.tsx:56 | inline |
| Optional location checks at your venue | plan include item | app/pricing/page.tsx:57 | inline |
| Weekly digest of visits, regulars, and redemptions | plan include item | app/pricing/page.tsx:58 | inline |
| Is there a contract? | FAQ q | app/pricing/page.tsx:63 | inline |
| No. It is month to month after the pilot. £29, one venue, one month's notice to leave. Card required — cancel anytime, with 30 days free before billing starts. | FAQ a | app/pricing/page.tsx:64 | inline |
| Do I need any hardware? | FAQ q | app/pricing/page.tsx:66 | inline |
| No. Customers use their own phones and your permanent venue QR. Optional location checks can flag out-of-range visits without blocking legitimate customers. | FAQ a | app/pricing/page.tsx:67 | inline |
| Who owns the customer data? | FAQ q | app/pricing/page.tsx:70 | inline |
| Customer records stay with your venue. You see masked phone and email in your dashboard; marketing is a separate opt-in. | FAQ a | app/pricing/page.tsx:71 | inline |
| What counts as a visit? | FAQ q | app/pricing/page.tsx:74 | inline |
| A visit counts when a customer stamps from your venue QR — one earned stamp per customer per UK date. Optional location checks can flag odd visits without blocking legitimate customers. | FAQ a | app/pricing/page.tsx:75 | inline |
| What if I want to cancel? | FAQ q | app/pricing/page.tsx:78 | inline |
| One month's notice from your billing page, any time. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal. | FAQ a | app/pricing/page.tsx:79 | inline |
| Pricing | eyebrow | app/pricing/page.tsx:133 | inline |
| One price. Everything included. | h1 | app/pricing/page.tsx:134 | inline |
| 30 days free to pilot, then £29/month per venue. Card required — cancel anytime. | PageTitle description | app/pricing/page.tsx:135 | inline |
| Growth plan | eyebrow (receipt) | app/pricing/page.tsx:153 | inline |
| 30 days free | badge | app/pricing/page.tsx:155 | inline |
| £29 | price | app/pricing/page.tsx:160 | inline |
| /month | price unit | app/pricing/page.tsx:162 | inline |
| One venue · month to month · no contracts | price meta | app/pricing/page.tsx:166 | inline |
| Everything included | eyebrow | app/pricing/page.tsx:171 | inline |
| Start free pilot | button (CTA.startPilot) | app/pricing/page.tsx:190 | shared:facts.ts |
| Log in | button | app/pricing/page.tsx:193 | inline |
| Card required — cancel anytime. One month's notice to leave. | helper text | app/pricing/page.tsx:195-198 | inline |
| The maths | eyebrow | app/pricing/page.tsx:205 | inline |
| One or two extra regulars a week can cover the cost for many cafes. | body (bold) | app/pricing/page.tsx:206-209 | inline |
| Most venues see their first repeat visit inside the first week. Your dashboard counts the regulars; you do the maths. | body paragraph | app/pricing/page.tsx:210-213 | inline |
| After day 30 | eyebrow | app/pricing/page.tsx:216 | inline |
| Billing starts after your free pilot. Leave any time with one month's notice from your billing page. Earned rewards stay good for your regulars. | body paragraph | app/pricing/page.tsx:217-221 | inline |
| Asked at the counter | h2 (FAQ section) | app/pricing/page.tsx:227-229 | inline |
| + / – | FAQ toggle marker | app/pricing/page.tsx:242-243 | inline |
| Start free pilot | button (CTA.startPilot) | app/pricing/page.tsx:254 | shared:facts.ts |

### Pricing checkout alert — `app/pricing/checkout-alert.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Checkout complete | alert title (success) | app/pricing/checkout-alert.tsx:9 | inline |
| Your Growth Plan setup can continue from the merchant billing page. | alert body (success) | app/pricing/checkout-alert.tsx:10 | inline |
| Open merchant billing | alert action link | app/pricing/checkout-alert.tsx:13 | inline |
| Checkout cancelled | alert title (cancelled) | app/pricing/checkout-alert.tsx:18 | inline |
| No payment details were changed. You can start checkout again whenever you are ready. | alert body (cancelled) | app/pricing/checkout-alert.tsx:19 | inline |

## Loyalty for Pubs — `app/loyalty-for-pubs/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loyalty for Pubs & Gastropubs — No-App QR Stamp Cards | metadata title | app/loyalty-for-pubs/page.tsx:26 | inline |
| Reward regulars without an app or a CRM. One venue QR for the bar, the tables and the takeaway hatch — a browser-based loyalty card with counter-verified stamps. No POS or EPOS integration required. £29/month, 30-day free pilot. | metadata description | app/loyalty-for-pubs/page.tsx:27-28 | inline |
| How it works | nav link | app/loyalty-for-pubs/page.tsx:60 | inline |
| Guides | nav link | app/loyalty-for-pubs/page.tsx:61 | inline |
| Pricing | nav link | app/loyalty-for-pubs/page.tsx:62 | inline |
| Log in | nav link | app/loyalty-for-pubs/page.tsx:64 | inline |
| Mixed service points | pain-point title | app/loyalty-for-pubs/page.tsx:70 | inline |
| The bar, the tables, the kitchen pass and the takeaway hatch all take orders. One permanent venue QR covers every one of them — no extra till, no extra step. | pain-point body | app/loyalty-for-pubs/page.tsx:71 | inline |
| App and CRM friction | pain-point title | app/loyalty-for-pubs/page.tsx:74 | inline |
| Regulars will not download an app for a pint, and you do not want another CRM to run. The card opens in the browser and saves in one tap, with nothing to install. | pain-point body | app/loyalty-for-pubs/page.tsx:75 | inline |
| Paper cards lost and gamed | pain-point title | app/loyalty-for-pubs/page.tsx:78 | inline |
| Paper stamp cards end up in the wash or stamped twice by a friendly hand. A browser-based card lives on the customer's phone and every stamp is counter-verified. | pain-point body | app/loyalty-for-pubs/page.tsx:79 | inline |
| Stamping that survives a staff change | pain-point title | app/loyalty-for-pubs/page.tsx:82 | inline |
| Customers scan and stamp themselves from your QR, so a new face behind the bar changes nothing. The rule — one stamp per customer per UK date — is the same on every shift. | pain-point body | app/loyalty-for-pubs/page.tsx:83 | inline |
| Quieter days, without slowing the bar | pain-point title | app/loyalty-for-pubs/page.tsx:86 | inline |
| Give regulars a reason to come in on a Tuesday, not just a Friday. Scanning takes a second and never holds up the round — the phone never crosses the counter. | pain-point body | app/loyalty-for-pubs/page.tsx:87 | inline |
| One venue QR for the bar, the tables and the takeaway hatch | benefit list item | app/loyalty-for-pubs/page.tsx:92 | inline |
| Counter-verified stamps that can't be faked or double-claimed | benefit list item | app/loyalty-for-pubs/page.tsx:93 | inline |
| A weekly digest of visits, regulars and redemptions | benefit list item | app/loyalty-for-pubs/page.tsx:94 | inline |
| Loyalty kept separate from marketing — regulars opt in only if they choose | benefit list item | app/loyalty-for-pubs/page.tsx:95 | inline |
| No extra hardware. No POS or EPOS integration required. | benefit list item (PRODUCT.posLine) | app/loyalty-for-pubs/page.tsx:96 | shared:facts.ts |
| Loyalty for pubs | MonoTag (CTA.pub) | app/loyalty-for-pubs/page.tsx:119 | shared:facts.ts |
| Loyalty for pubs and gastropubs. | h1 | app/loyalty-for-pubs/page.tsx:121 | inline |
| Reward your regulars without an app or a CRM. A browser-based loyalty card customers open from your QR code. One permanent QR covers the bar, the tables and the takeaway hatch — and every stamp is counter-verified. | hero body (PRODUCT.cardLine interpolated) | app/loyalty-for-pubs/page.tsx:124-130 | inline + shared:facts.ts |
| Start free pilot | button (CTA.startPilot) | app/loyalty-for-pubs/page.tsx:134 | shared:facts.ts |
| View pricing | button | app/loyalty-for-pubs/page.tsx:137 | inline |
| 30-day free pilot, then £29/month · no contract · No extra hardware. No POS or EPOS integration required. | hero meta (pilot·price·posLine) | app/loyalty-for-pubs/page.tsx:140-143 | shared:facts.ts |
| For a pub, that means | eyebrow (benefits card) | app/loyalty-for-pubs/page.tsx:147 | inline |
| Built for the bar | MonoTag | app/loyalty-for-pubs/page.tsx:169 | inline |
| Made for how a pub actually runs. | h2 | app/loyalty-for-pubs/page.tsx:170-172 | inline |
| A pub is not a coffee shop with one till. The five frictions below are the ones we hear from food-led pubs, ale and cask-led locals, wine bars and pub restaurants — and what a browser-based card does about each. | body paragraph | app/loyalty-for-pubs/page.tsx:173-178 | inline |
| Pub loyalty guides | MonoTag | app/loyalty-for-pubs/page.tsx:212 | inline |
| Go deeper on pub loyalty. | h2 | app/loyalty-for-pubs/page.tsx:213-215 | inline |
| Three short, practical reads for landlords and pub operators. | body paragraph | app/loyalty-for-pubs/page.tsx:216-218 | inline |
| Read the guide | card link text | app/loyalty-for-pubs/page.tsx:235 | inline |

## Guides — shared shell `components/marketing/guides/guide-page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Home | breadcrumb link | components/marketing/guides/guide-page.tsx:71 | inline |
| Loyalty for pubs | breadcrumb link (CTA.pub) | components/marketing/guides/guide-page.tsx:80 | shared:facts.ts |
| The full picture | eyebrow (reciprocal hub link) | components/marketing/guides/guide-page.tsx:104 | inline |
| See how a browser-based loyalty card works across the whole pub. | body (bold) | components/marketing/guides/guide-page.tsx:105-107 | inline |
| See the pub loyalty guide | button (CTA.guideLink) | components/marketing/guides/guide-page.tsx:110 | shared:facts.ts |
| More pub loyalty guides | eyebrow (related rail) | components/marketing/guides/guide-page.tsx:117 | inline |
| Read | related-card link text | components/marketing/guides/guide-page.tsx:132 | inline |

### Guides registry — `components/marketing/guides/guides-data.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Best loyalty ideas for pubs | guide title | components/marketing/guides/guides-data.ts:21 | shared:guides-data.ts |
| Best loyalty ideas for pubs | guide nav label | components/marketing/guides/guides-data.ts:22 | shared:guides-data.ts |
| Reward shapes that suit a pub — a simple threshold, quieter-day perks — and which ones bring regulars back. | guide summary | components/marketing/guides/guides-data.ts:23-24 | shared:guides-data.ts |
| How to reward regulars without an app | guide title | components/marketing/guides/guides-data.ts:28 | shared:guides-data.ts |
| Reward regulars without an app | guide nav label | components/marketing/guides/guides-data.ts:29 | shared:guides-data.ts |
| Why an app is the wrong ask for a pint, and how a browser-based loyalty card rewards regulars with nothing to install. | guide summary | components/marketing/guides/guides-data.ts:30-31 | shared:guides-data.ts |
| Paper loyalty cards vs QR loyalty for pubs | guide title | components/marketing/guides/guides-data.ts:35 | shared:guides-data.ts |
| Paper vs QR loyalty for pubs | guide nav label | components/marketing/guides/guides-data.ts:36 | shared:guides-data.ts |
| A side-by-side on loss, fraud, staff time and the data you get back, so you can pick the right card for your bar. | guide summary | components/marketing/guides/guides-data.ts:37-38 | shared:guides-data.ts |

### Guide comparison table (component chrome) — `components/marketing/guides/comparison-table.tsx`
_Renders only caller-supplied `columns`, `rows`, `caption`, `ariaLabel` — no hardcoded copy of its own._

## Guide: Reward Regulars Without an App — `app/guides/reward-regulars-without-an-app/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| How to Reward Pub Regulars Without an App | metadata title | app/guides/reward-regulars-without-an-app/page.tsx:7 | inline |
| Your regulars won't download an app for a pint — and you don't want another CRM. Here's how a browser-based loyalty card rewards pub regulars with nothing to install and no POS or EPOS integration. | metadata description | app/guides/reward-regulars-without-an-app/page.tsx:8-9 | inline |
| Pub loyalty guide | eyebrow | app/guides/reward-regulars-without-an-app/page.tsx:37 | inline |
| How to reward regulars without an app | h1 | app/guides/reward-regulars-without-an-app/page.tsx:38 | inline |
| A regular will not install an app to collect a stamp, and you should not have to run a CRM to thank them. There is a simpler way — and it lives in the phone they already have open. | intro | app/guides/reward-regulars-without-an-app/page.tsx:40 | inline |
| Why an app is the wrong ask for a pint | h2 (GuideSection) | app/guides/reward-regulars-without-an-app/page.tsx:42 | inline |
| Asking someone to find, download and sign in to an app — at the bar, mid-round — loses most of them before the first stamp. Even cards that say "no app" often still need an Apple or Google Wallet pass installed. For a pub, every install step is a regular you never enrolled. | body paragraph | app/guides/reward-regulars-without-an-app/page.tsx:44-48 | inline |
| What a browser-based loyalty card is | h2 | app/guides/reward-regulars-without-an-app/page.tsx:52 | inline |
| A browser-based loyalty card customers open from your QR code. There is nothing to download and no wallet pass to install — it opens in the phone browser and saves in one tap, on any iPhone or Android. "Saved" and "usable" are the same moment. | body paragraph (PRODUCT.cardLine + inline) | app/guides/reward-regulars-without-an-app/page.tsx:54-58 | shared:facts.ts + inline |
| How a regular actually uses it | h2 | app/guides/reward-regulars-without-an-app/page.tsx:61 | inline |
| They scan the permanent QR on the bar, the card opens, and they save it in one tap. Next visit they tap to claim a stamp; a full card unlocks a reward redeemed at the bar. No password, no plastic, nothing to lose between rounds. | body paragraph | app/guides/reward-regulars-without-an-app/page.tsx:63-67 | inline |
| Keeping it fair behind the bar | h2 | app/guides/reward-regulars-without-an-app/page.tsx:70 | inline |
| Customers stamp themselves, but they cannot game it: every stamp is confirmed at the counter against your QR and their saved card, capped at one per customer per UK date. Rewards are checked when they are redeemed, never from a screenshot — so a finished card always means a real regular. | body paragraph | app/guides/reward-regulars-without-an-app/page.tsx:72-77 | inline |
| Nothing new at the till | h2 | app/guides/reward-regulars-without-an-app/page.tsx:80 | inline |
| No extra hardware. No POS or EPOS integration required. It runs on any phone, tablet or till you already have, and your permanent venue QR handles joins, stamps, and rewards. Your team keeps pouring; the loyalty card looks after itself. | body paragraph (PRODUCT.posLine + inline) | app/guides/reward-regulars-without-an-app/page.tsx:82-85 | shared:facts.ts + inline |

## Guide: Best Loyalty Ideas for Pubs — `app/guides/best-loyalty-ideas-for-pubs/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Best Loyalty Ideas for Pubs | metadata title | app/guides/best-loyalty-ideas-for-pubs/page.tsx:7 | inline |
| Loyalty ideas that actually suit a pub: one clear stamp threshold, quieter-day perks, rewards that taste like your bar, and the schemes to skip. A practical guide for landlords and pub operators. | metadata description | app/guides/best-loyalty-ideas-for-pubs/page.tsx:8-9 | inline |
| Pub loyalty guide | eyebrow | app/guides/best-loyalty-ideas-for-pubs/page.tsx:37 | inline |
| Best loyalty ideas for pubs | h1 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:38 | inline |
| The reward you choose matters more than the technology behind it. Here are the loyalty ideas that suit a pub, bar or gastropub — and the ones to leave behind the bar. | intro | app/guides/best-loyalty-ideas-for-pubs/page.tsx:40 | inline |
| Pick one clear threshold | h2 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:42 | inline |
| The best pub loyalty scheme is one a regular can hold in their head: collect a set number of stamps, unlock one reward. A single, obvious goal beats a points scheme nobody tracks. Keep the maths invisible and the finish line in sight. | body paragraph | app/guides/best-loyalty-ideas-for-pubs/page.tsx:44-48 | inline |
| Reward the quieter shifts | h2 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:51 | inline |
| Fridays look after themselves. A perk that lands on a Tuesday or a rainy lunchtime gives regulars a reason to choose your pub when they might otherwise stay home — and turns your loyalty card into a tool for filling the quiet hours, not just thanking the busy ones. | body paragraph | app/guides/best-loyalty-ideas-for-pubs/page.tsx:52-57 | inline |
| Make the reward taste like your pub | h2 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:60 | inline |
| Generic points feel like a supermarket. A guest ale, a plate from the kitchen, a round for a finished card — a reward only your bar can give is the one regulars come back to unlock. It should feel like a thank-you from the landlord, not a discount engine. | body paragraph | app/guides/best-loyalty-ideas-for-pubs/page.tsx:61-66 | inline |
| Let regulars stamp themselves — and keep it honest | h2 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:69 | inline |
| A reward only works if a full card means something. With Nabaperks, customers scan your venue QR and stamp themselves, and every stamp is confirmed at the counter — checked against your QR, their saved card and a one-stamp-per-customer-per-UK-date rule. The phone never crosses the counter and the bar never slows down. | body paragraph | app/guides/best-loyalty-ideas-for-pubs/page.tsx:70-76 | inline |
| Ideas to skip | h2 | app/guides/best-loyalty-ideas-for-pubs/page.tsx:79 | inline |
| Skip anything that asks a customer to download an app for a pint. Skip anything that turns the bar into a data-entry desk on a busy shift. And skip any reward you cannot honour on a packed Friday — a promise you break is worse than no scheme at all. | body paragraph | app/guides/best-loyalty-ideas-for-pubs/page.tsx:80-85 | inline |

## Guide: Paper vs QR Loyalty for Pubs — `app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Paper Loyalty Cards vs QR Loyalty for Pubs | metadata title | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:11 | inline |
| Paper punch cards or a browser-based QR loyalty card for your pub? A side-by-side on loss, gaming, staff time, the till and the data you get back — so you can pick the right card for your bar. | metadata description | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:12-13 | inline |
| Lost or left at home | comparison row feature | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:39 | inline |
| Lives in a wallet — easily lost or forgotten | comparison cell (paper) | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:41 | inline |
| Lives on the customer's phone, always with them | comparison cell (QR) | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:42 | inline |
| Stamped twice or gamed | comparison row feature | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:46 | inline |
| A friendly hand can over-stamp it | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:48 | inline |
| Each stamp is confirmed at the counter, capped one per UK date | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:49 | inline |
| Staff time at the bar | comparison row feature | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:53 | inline |
| Find the card, find the stamp, stamp it | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:55 | inline |
| The customer scans and stamps themselves | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:56 | inline |
| What the customer installs | comparison row feature | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:60 | inline |
| Nothing — but nothing to back it up either | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:62 | inline |
| Nothing: it opens in the browser, no app or wallet pass | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:63 | inline |
| Visit & redemption data | comparison row feature | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:67 | inline |
| None — the card tells you nothing | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:69 | inline |
| A weekly digest of visits, regulars and redemptions | comparison cell | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:70 | inline |
| Paper loyalty cards vs QR loyalty for pubs | h1 | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:80 | inline |
| Paper punch cards are simple and familiar. A browser-based QR loyalty card keeps that simplicity but fixes the parts that cost a pub money. Here is the honest side-by-side. | intro | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:82 | inline |
| Side by side | h2 (GuideSection) | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:84 | inline |
| Paper loyalty cards versus QR loyalty comparison | table aria-label | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:86 | inline |
| Paper loyalty cards compared with a browser-based QR loyalty card for pubs, across loss, gaming, staff time, install and data. | table caption (sr-only) | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:87 | inline |
| Paper card | table column header | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:88 | inline |
| Browser-based QR card | table column header | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:88 | inline |
| Where paper still feels right | h2 | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:93 | inline |
| A paper card costs pennies and needs no explanation. For a pop-up, a one-off promotion or a pub that wants nothing on a screen, it is a fair choice. The trade is that a lost card is a lost regular, and you never learn who came back. | body paragraph | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:95-99 | inline |
| Where a QR card wins | h2 | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:102 | inline |
| A browser-based QR loyalty card keeps the scan-and-collect simplicity but cannot be lost, double-stamped or faked. Customers stamp themselves in a second, the bar never slows, and there is still no app to install — the card just opens in the browser. | body paragraph | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:103-108 | inline |
| The data a paper card can't give you | h2 | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:111 | inline |
| The biggest difference is what comes back. A paper card tells you nothing; a QR card gives you a weekly digest of visits, regulars and redemptions — the quiet signal of who is coming back, which a punch card could never show. | body paragraph | app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:112-117 | inline |

## Demo page — `app/demo/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Try a live loyalty card demo | metadata title | app/demo/page.tsx:11 | inline |
| See exactly what your customers get — a browser-based loyalty card with counter-verified stamps. No app, no wallet pass, no sign-up. Tap to stamp and unlock the reward. | metadata description | app/demo/page.tsx:12-13 | inline |
| Live demo · nothing saved | eyebrow | app/demo/page.tsx:47 | inline |
| The card your customers get. | h1 | app/demo/page.tsx:48-50 | inline |
| No app, no wallet pass, no sign-up. Tap the card to stamp it and watch the reward unlock — every stamp is verified at the counter. | body paragraph | app/demo/page.tsx:51-54 | inline |
| This is what your regulars see at your counter — build yours in minutes. | body paragraph | app/demo/page.tsx:60-63 | inline |
| Start free pilot | button | app/demo/page.tsx:65 | inline |
| Back to home | button (ghost) | app/demo/page.tsx:73 | inline |

### Demo card (interactive) — `app/demo/demo-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A coffee on the house | reward name (REWARD const) | app/demo/demo-card.tsx:13 | inline |
| Add a stamp. {n} of {total} collected. | aria-label (dynamic, real sentence) | app/demo/demo-card.tsx:66 | inline |
| A sample café · demo | card venue line | app/demo/demo-card.tsx:80 | inline |
| Coffee loyalty card | card title | app/demo/demo-card.tsx:81 | inline |
| Demo — nothing saved | card footer-left | app/demo/demo-card.tsx:84 | inline |
| {current} / {total} stamps | card footer-right | app/demo/demo-card.tsx:85 | inline |
| Something's brewing. | reward name (sealed) | app/demo/demo-card.tsx:89 | inline |
| Show this at the counter to redeem. | reward description (ready) | app/demo/demo-card.tsx:92 | inline |
| Fill the card to reveal your reward. | reward description (sealed) | app/demo/demo-card.tsx:93 | inline |
| Reward unlocked — that's the whole loop, no app in sight. | status line (complete) | app/demo/demo-card.tsx:105 | inline |
| Tap the card to add a stamp | status line | app/demo/demo-card.tsx:114 | inline |
| · {remaining} to go | status line suffix | app/demo/demo-card.tsx:117 | inline |
| Reset the demo | button | app/demo/demo-card.tsx:129 | inline |

## Start / launcher — `app/start/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Open Nabaperks | metadata title | app/start/page.tsx:14 | inline |
| Nabaperks | VenueMark name | app/start/page.tsx:29 | inline |
| Welcome | VenueMark caption | app/start/page.tsx:29 | inline |
| Nabaperks | eyebrow | app/start/page.tsx:31 | inline |
| Welcome to Nabaperks | h1 | app/start/page.tsx:33 | inline |
| Open your loyalty cards, or sign in to run your venue. | body | app/start/page.tsx:35-37 | inline |
| Scan a QR | button | app/start/page.tsx:43 | inline |
| Open my cards | button | app/start/page.tsx:46 | inline |
| Merchant sign-in | button (ghost) | app/start/page.tsx:54 | inline |
| New here? Scan a venue's QR code to collect your first stamp — your first card is created automatically. | body | app/start/page.tsx:58-61 | inline |

## Terms — `app/terms/page.tsx` + `lib/legal/content.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Terms | metadata title | app/terms/page.tsx:13 | inline |
| How customer participation, rewards, marketing consent, and fraud prevention work on Nabaperks. The full text travels with your merchant agreement. | metadata description (PLATFORM_TERMS_META.description) | app/terms/page.tsx:14 | shared:content.ts |
| On this page | eyebrow (TOC) | app/terms/page.tsx:45 | inline |
| For venue operators · plain English summary | eyebrow (PLATFORM_TERMS_META.eyebrow) | app/terms/page.tsx:61 | shared:content.ts |
| The small print, kept legible. | PageTitle title (PLATFORM_TERMS_META.title) | app/terms/page.tsx:62 | shared:content.ts |
| Terms, condensed | receipt card title (PLATFORM_TERMS_META.cardTitle) | app/terms/page.tsx:71 | shared:content.ts |
| Nº T-2026 | doc number (PLATFORM_TERMS_META.docNumber) | app/terms/page.tsx:74 | shared:content.ts |
| Privacy notice | button link | app/terms/page.tsx:88 | inline |
| Participation | section title | lib/legal/content.ts:10 | shared:content.ts |
| Customers may join a merchant loyalty card after verifying their phone number and accepting the loyalty terms. The card is browser-based and does not require a downloaded app or physical plastic card. | section body | lib/legal/content.ts:11 | shared:content.ts |
| Merchant-controlled reward terms | section title | lib/legal/content.ts:15 | shared:content.ts |
| Each merchant controls its reward description, earning rules, exclusions, and venue-specific participation terms. Merchant reward terms are shown before joining and on the merchant terms page. | section body | lib/legal/content.ts:16 | shared:content.ts |
| Optional marketing opt-in | section title | lib/legal/content.ts:20 | shared:content.ts |
| Marketing opt-in is optional and separate from loyalty participation. Declining marketing does not stop a customer collecting stamps, seeing progress, or redeeming earned rewards. | section body | lib/legal/content.ts:21 | shared:content.ts |
| Abuse and fraud prevention | section title | lib/legal/content.ts:25 | shared:content.ts |
| Nabaperks and merchants may investigate suspicious activity, duplicate claims, QR misuse, manual adjustments, soft geofence anomalies, or fraud signals. … [~560 chars total] | section body | lib/legal/content.ts:26 | shared:content.ts |
| Availability restrictions | section title | lib/legal/content.ts:30 | shared:content.ts |
| The service may restrict new joins, stamps, QR scans, or redemptions when a merchant loyalty card is inactive, QR access is disabled, a reward is not yet redeemable, or billing is suspended. | section body | lib/legal/content.ts:31 | shared:content.ts |

## Privacy — `app/privacy/page.tsx` + `lib/legal/content.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Privacy | metadata title | app/privacy/page.tsx:11 | inline |
| How Nabaperks handles loyalty records, consent separation, support access, and audit evidence for your venue. The full notice travels with your merchant agreement. | metadata description (PRIVACY_META.description) | app/privacy/page.tsx:12 | shared:content.ts |
| On this page | eyebrow (TOC) | app/privacy/page.tsx:46 | inline |
| For venue operators · plain English summary | eyebrow (PRIVACY_META.eyebrow) | app/privacy/page.tsx:63 | shared:content.ts |
| What happens to your customers' data. | PageTitle title (PRIVACY_META.title) | app/privacy/page.tsx:64 | shared:content.ts |
| If you're a customer | eyebrow | app/privacy/page.tsx:70 | inline |
| This summary is written for the venues that run Nabaperks, but it covers your data too. Joining a venue's loyalty card stores your verified phone number, stamps, rewards, and consent choices, scoped to that venue and Nabaperks support. Marketing is optional and separate from collecting stamps, and you can ask for access, deletion, or export at any time using the contact details further down this page. | body paragraph | app/privacy/page.tsx:71-79 | inline |
| Privacy, condensed | receipt card title (PRIVACY_META.cardTitle) | app/privacy/page.tsx:84 | shared:content.ts |
| Nº P-2026 | doc number (PRIVACY_META.docNumber) | app/privacy/page.tsx:85 | shared:content.ts |
| Data controller & official guidance | eyebrow | app/privacy/page.tsx:100 | inline |
| The data controller for Nabaperks loyalty data is Lapen Inns. For privacy, access, deletion, export or consent requests, contact info@lapeninns.com. Our approach is privacy-conscious and consent-led, and follows ICO guidance. | body paragraph (interpolated name/email) | app/privacy/page.tsx:101-116 | inline + shared:facts.ts |
| Official guidance: ICO (UK data protection) · CAP / ASA advertising codes. | body paragraph + link texts | app/privacy/page.tsx:117-137 | inline |
| ICO (UK data protection) | external link text | app/privacy/page.tsx:125 | inline |
| CAP / ASA advertising codes | external link text | app/privacy/page.tsx:133-134 | inline |
| Platform terms | button link | app/privacy/page.tsx:141 | inline |
| Data collected | section title | lib/legal/content.ts:47 | shared:content.ts |
| Nabaperks stores the verified phone identity used by a customer, merchant loyalty membership records, stamp events, reward events, consent records, QR and billing status signals, and support audit logs. … [~430 chars total] | section body | lib/legal/content.ts:48 | shared:content.ts |
| Purposes | section title | lib/legal/content.ts:52 | shared:content.ts |
| Data is used to provide the loyalty card, show progress, unlock and redeem rewards, prevent misuse, support merchants and customers, keep audit evidence, and measure service performance. … [~430 chars total] | section body | lib/legal/content.ts:53 | shared:content.ts |
| Marketing consent separation | section title | lib/legal/content.ts:57 | shared:content.ts |
| Loyalty participation is separate from marketing. Customers can collect stamps without opting in to marketing, and marketing opt-in or opt-out evidence is kept in consent records. | section body | lib/legal/content.ts:58 | shared:content.ts |
| Sharing, scoping, and support access | section title | lib/legal/content.ts:62 | shared:content.ts |
| Customer loyalty data is scoped to the relevant merchant and Nabaperks support administrators. Admin access is used for support, fraud review, privacy requests, and audited operational tasks. PostHog analytics receives minimized event properties where configured. | section body | lib/legal/content.ts:63 | shared:content.ts |
| Data requests | section title | lib/legal/content.ts:67 | shared:content.ts |
| Customers can ask for privacy, access, deletion, export, or consent support. Internal admins use audited lookup tools to identify the relevant customer and merchant records and record the request channel. | section body | lib/legal/content.ts:68 | shared:content.ts |
| Audit and support records | section title | lib/legal/content.ts:72 | shared:content.ts |
| Support notes, consent records, fraud signals, manual adjustments, and admin actions may be retained as audit evidence so reward history and support decisions remain accountable. | section body | lib/legal/content.ts:73 | shared:content.ts |

### Venue terms builder (used by merchant terms pages; string factory) — `lib/legal/content.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward | section title | lib/legal/content.ts:101 | shared:content.ts |
| A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp. | section body | lib/legal/content.ts:102 | shared:content.ts |
| Earning rule | section title | lib/legal/content.ts:106 | shared:content.ts |
| Collect {n} visit stamps from the venue QR. One stamp may be issued per UK date. | section body (interpolated) | lib/legal/content.ts:107 | shared:content.ts |
| Stamps needed | section title | lib/legal/content.ts:110 | shared:content.ts |
| {n} stamps | section body | lib/legal/content.ts:112 | shared:content.ts |
| Redemption | section title | lib/legal/content.ts:115 | shared:content.ts |
| The assigned reward can be redeemed from the next UK business day after it is revealed. Tap redeem from your reward page while you are at the venue. | section body | lib/legal/content.ts:117 | shared:content.ts |
| Exclusions | section title | lib/legal/content.ts:120 | shared:content.ts |
| No additional exclusions configured. | section body (fallback) | lib/legal/content.ts:122 | shared:content.ts |
| Fraud and abuse | section title | lib/legal/content.ts:125 | shared:content.ts |
| The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. Location checks are non-blocking: stamps still save if location is denied, unavailable, timed out, or inaccurate. | section body | lib/legal/content.ts:127 | shared:content.ts |
| Merchant contact | section title | lib/legal/content.ts:130 | shared:content.ts |
| Ask the venue team | section body (fallback) | lib/legal/content.ts:132 | shared:content.ts |
| {merchantName} loyalty terms | page title (venueTermsMeta) | lib/legal/content.ts:139 | shared:content.ts |
| These loyalty terms are shown before you join and stay available from your loyalty card. | description (venueTermsMeta) | lib/legal/content.ts:141 | shared:content.ts |
| Reward terms | card title (venueTermsMeta) | lib/legal/content.ts:142 | shared:content.ts |

---

## Shared marketing copy module — `lib/marketing/facts.ts`
_Resolved verbatim values (many surface via interpolation across pages above; listed once here as the source of truth)._
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Lapen Inns | operator name | lib/marketing/facts.ts:19 | shared:facts.ts |
| hospitality operator | operator role | lib/marketing/facts.ts:21 | shared:facts.ts |
| pub operator | operator roleAlt | lib/marketing/facts.ts:22 | shared:facts.ts |
| Lapen Inns, hospitality operator | operator descriptor | lib/marketing/facts.ts:24 | shared:facts.ts |
| a hospitality operator running 9 pubs across England | operator estateLine | lib/marketing/facts.ts:25 | shared:facts.ts |
| 9 pubs across England | operator estateShort | lib/marketing/facts.ts:26 | shared:facts.ts |
| info@lapeninns.com | support/privacy email | lib/marketing/facts.ts:32,34 | shared:facts.ts |
| browser-based loyalty card | product term | lib/marketing/facts.ts:77 | shared:facts.ts |
| A browser-based loyalty card customers open from your QR code. | product cardLine | lib/marketing/facts.ts:78 | shared:facts.ts |
| No extra hardware. No POS or EPOS integration required. | product posLine | lib/marketing/facts.ts:79 | shared:facts.ts |
| £29/month | product price | lib/marketing/facts.ts:80 | shared:facts.ts |
| £29/mo | product priceShort | lib/marketing/facts.ts:81 | shared:facts.ts |
| 30-day free pilot | product pilot | lib/marketing/facts.ts:82 | shared:facts.ts |
| counter-verified stamps | product counterStamp | lib/marketing/facts.ts:84 | shared:facts.ts |
| stamps confirmed at the counter | product counterStampLong | lib/marketing/facts.ts:85 | shared:facts.ts |
| Nabaperks Counter-Loyalty Index | proof indexName | lib/marketing/facts.ts:92 | shared:facts.ts |
| June 2026 | proof asOf | lib/marketing/facts.ts:93 | shared:facts.ts |
| Nabaperks first-party loyalty data from UK food-and-drink venues, March 2024 to June 2026. Snapshot as of June 2026. | proof methodology | lib/marketing/facts.ts:94-95 | shared:facts.ts |
| Calculated from first-party loyalty records. | proof calculatedFrom | lib/marketing/facts.ts:96 | shared:facts.ts |
| Measured across Nabaperks-powered venues. | proof measuredAcross | lib/marketing/facts.ts:97 | shared:facts.ts |
| 1,842 / 812 / 1,180 / 2,934 / 46.8% | proof display stats (members / returned / redeemed / earned / repeat rate) | lib/marketing/facts.ts:110-114 | shared:facts.ts |
| Loyalty for pubs | CTA.pub | lib/marketing/facts.ts:167 | shared:facts.ts |
| See the pub loyalty guide | CTA.guideLink | lib/marketing/facts.ts:169 | shared:facts.ts |
| Start free pilot | CTA.startPilot | lib/marketing/facts.ts:170 | shared:facts.ts |

---

## Landing component: Hero — `components/marketing/landing/hero.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| No-app QR loyalty · UK food & drink | MonoTag | components/marketing/landing/hero.tsx:27-28 | inline |
| The loyalty card that just opens. | h1 | components/marketing/landing/hero.tsx:31 | inline |
| Scan your till QR — the card opens in their browser. No app, no wallet pass. Every stamp verified at your counter. | mobile hero body | components/marketing/landing/hero.tsx:33-35 | inline |
| Start free pilot | button | components/marketing/landing/hero.tsx:39 | inline |
| See how it works | button (outline) | components/marketing/landing/hero.tsx:42 | inline |
| No-app QR loyalty for UK cafes, takeaways and pubs. Your customer scans the till QR and the card opens in their browser — saved in one tap, with no app and no Apple or Google Wallet pass to install. Every stamp is verified at your counter. | desktop hero body | components/marketing/landing/hero.tsx:46-52 | inline |
| 812 customers stamped in the last 3 months — already at UK tills | authority line (NABAPERKS_AUTHORITY_LINE) | components/marketing/landing/hero.tsx:54 | shared:nabaperks-proof-data.ts (+ facts.ts) |
| At £29/mo, one or two extra regulars a week can cover it. | body | components/marketing/landing/hero.tsx:57-60,79-82 | inline |
| Already piloting? | mono meta | components/marketing/landing/hero.tsx:62 | inline |
| Log in | link | components/marketing/landing/hero.tsx:64 | inline |
| View pricing | link | components/marketing/landing/hero.tsx:66 | inline |
| Build free — no payment to start | reassurance point (mobile) | components/marketing/landing/hero.tsx:74 | inline |
| 30-day pilot, then £29/mo | reassurance point (mobile) | components/marketing/landing/hero.tsx:75 | inline |
| Try this card yourself → | link | components/marketing/landing/hero.tsx:93 | inline |

## Landing component: Hero sample card — `components/marketing/landing/hero-sample-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery card | card title (HERO_CARD_NAME) | components/marketing/landing/hero-sample-card.tsx:15 | inline |
| Something's under there. | sealed reward name | components/marketing/landing/hero-sample-card.tsx:16 | inline |
| Ready for merchant scan at the counter. | reward description (revealed) | components/marketing/landing/hero-sample-card.tsx:37 | inline |
| Stays sealed until the final stamp. | reward description (sealed) | components/marketing/landing/hero-sample-card.tsx:41 | inline |
| Old Crown · CB3 0QD | card venue line | components/marketing/landing/hero-sample-card.tsx:63 | inline |
| Scanned at the counter | scan-row eyebrow | components/marketing/landing/hero-sample-card.tsx:76 | inline |
| Venue QR opens the card in the browser. | scan-row title | components/marketing/landing/hero-sample-card.tsx:77 | inline |

### Hero sample rewards (rotating) — `components/marketing/landing/hero-sample-rewards.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A pint on the house | rotating reward | components/marketing/landing/hero-sample-rewards.ts:3 | inline |
| A glass of wine on the house | rotating reward | components/marketing/landing/hero-sample-rewards.ts:4 | inline |
| A flat white on the house | rotating reward | components/marketing/landing/hero-sample-rewards.ts:5 | inline |
| Dessert on the house | rotating reward | components/marketing/landing/hero-sample-rewards.ts:6 | inline |
| A free starter | rotating reward | components/marketing/landing/hero-sample-rewards.ts:7 | inline |
| A hot drink on the house | rotating reward | components/marketing/landing/hero-sample-rewards.ts:8 | inline |

## Landing component: JumpNav — `components/marketing/landing/jump-nav.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| How it works | jump link | components/marketing/landing/jump-nav.tsx:15 | inline |
| No app vs wallet vs paper | jump link | components/marketing/landing/jump-nav.tsx:16 | inline |
| Why stamps can't be faked | jump link | components/marketing/landing/jump-nav.tsx:17 | inline |
| For your venue | jump link | components/marketing/landing/jump-nav.tsx:18 | inline |
| Pricing | jump link | components/marketing/landing/jump-nav.tsx:19 | inline |
| FAQ | jump link | components/marketing/landing/jump-nav.tsx:20 | inline |
| On this page | mobile disclosure summary + nav aria-label | components/marketing/landing/jump-nav.tsx:32,34 | inline |

## Landing component: OperatorProof — `components/marketing/landing/operator-proof.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| The install tax | fault title | components/marketing/landing/operator-proof.tsx:14 | inline |
| Most schemes want a download or a wallet pass before the first stamp, so we made our card open and save in one browser tap, with nothing to install. | fault body | components/marketing/landing/operator-proof.tsx:15 | inline |
| Stamps anyone can fake | fault title | components/marketing/landing/operator-proof.tsx:18 | inline |
| A read-out code, a screenshot or a photocopied paper card barely counts as a check, so customers scan themselves and we verify every stamp against your venue QR, capped at one per customer per UK date. | fault body | components/marketing/landing/operator-proof.tsx:19 | inline |
| Spam in a loyalty badge | fault title | components/marketing/landing/operator-proof.tsx:22 | inline |
| Too many schemes are a marketing list in disguise, so we keep loyalty and marketing as separate records — a regular can collect and redeem without ever being signed up to promotions. | fault body | components/marketing/landing/operator-proof.tsx:23 | inline |
| From the counter | MonoTag | components/marketing/landing/operator-proof.tsx:31 | inline |
| What most loyalty apps get wrong. | h2 | components/marketing/landing/operator-proof.tsx:32-34 | inline |
| We run no-app loyalty with real UK food and drink venues, and the same three faults turn up every time. We designed each one out. | body | components/marketing/landing/operator-proof.tsx:35-38 | inline |
| Fault 01 / Fault 02 / Fault 03 | fault index label | components/marketing/landing/operator-proof.tsx:56 | inline |
| Loyalty should reward regulars, not tax them. | pull quote | components/marketing/landing/operator-proof.tsx:68-70 | inline |

## Landing component: CounterFlow (home) — `components/marketing/landing/counter-flow.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Step 01 / Step 02 / Step 03 / Step 04 | step labels | components/marketing/landing/counter-flow.tsx:12,17,22,27 | inline |
| Scan | step title | components/marketing/landing/counter-flow.tsx:13 | inline |
| The permanent venue QR opens the card in the phone browser. | step body | components/marketing/landing/counter-flow.tsx:14 | inline |
| Save | step title | components/marketing/landing/counter-flow.tsx:18 | inline |
| Saved in one tap, right in the browser — no app, no Apple or Google Wallet pass, no password, no plastic. | step body | components/marketing/landing/counter-flow.tsx:19 | inline |
| Stamp | step title | components/marketing/landing/counter-flow.tsx:23 | inline |
| The customer taps to claim. The counter-verified stamp checks your venue QR, their saved card, and the one-stamp-per-day rule — the phone never crosses the counter. | step body | components/marketing/landing/counter-flow.tsx:24 | inline |
| Reward | step title | components/marketing/landing/counter-flow.tsx:28 | inline |
| Customers unlock a clear reward and collect it in-store. | step body | components/marketing/landing/counter-flow.tsx:29 | inline |
| How it works | mono meta / section label | components/marketing/landing/counter-flow.tsx:44,58 | inline |
| Scan, save, stamp, reward. | h2 | components/marketing/landing/counter-flow.tsx:47-49 | inline |
| Your team keeps the queue moving while customers stamp on their own phones. Every visit and redemption shows in your weekly digest. | body | components/marketing/landing/counter-flow.tsx:51-54 | inline |
| How it works, step by step | SnapRail label | components/marketing/landing/counter-flow.tsx:59 | inline |
| Swipe for all four steps → | SnapRail hint | components/marketing/landing/counter-flow.tsx:60 | inline |

## Landing component: PubCounterFlow (pub hub) — `components/marketing/landing/pub-counter-flow.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Step 01 / Step 02 / Step 03 / Step 04 | step labels | components/marketing/landing/pub-counter-flow.tsx:5,10,15,20 | inline |
| Scan | step title | components/marketing/landing/pub-counter-flow.tsx:6 | inline |
| A regular scans the permanent QR on the bar — the loyalty card opens in their phone browser. | step body | components/marketing/landing/pub-counter-flow.tsx:7 | inline |
| Save | step title | components/marketing/landing/pub-counter-flow.tsx:11 | inline |
| Saved in one tap, in the browser. No app, no Apple or Google Wallet pass, no plastic card to lose. | step body | components/marketing/landing/pub-counter-flow.tsx:12 | inline |
| Stamp | step title | components/marketing/landing/pub-counter-flow.tsx:16 | inline |
| They tap to claim. The counter-verified stamp checks your QR, their card and the one-stamp-per-day rule before it counts. | step body | components/marketing/landing/pub-counter-flow.tsx:17 | inline |
| Reward | step title | components/marketing/landing/pub-counter-flow.tsx:21 | inline |
| A full card unlocks a clear reward, redeemed at the bar. Your weekly digest shows who is coming back. | step body | components/marketing/landing/pub-counter-flow.tsx:22 | inline |
| How it works | mono meta | components/marketing/landing/pub-counter-flow.tsx:31 | inline |
| Scan, save, stamp, reward — behind the bar. | h2 | components/marketing/landing/pub-counter-flow.tsx:34-36 | inline |
| Your team keeps pouring while regulars stamp on their own phones. Nothing to install, nothing new to learn on a busy shift. | body | components/marketing/landing/pub-counter-flow.tsx:38-41 | inline |

## Landing component: LandingProof (merged proof section) — `components/marketing/landing/proof.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Real numbers | proof tab label | components/marketing/landing/proof.tsx:30 | inline |
| Case study | proof tab label | components/marketing/landing/proof.tsx:40 | inline |
| What venues say | proof tab label | components/marketing/landing/proof.tsx:52 | inline |
| Proof | MonoTag + ProofTabs label | components/marketing/landing/proof.tsx:63,73 | inline |
| Proof from the counter. | h2 | components/marketing/landing/proof.tsx:64-66 | inline |

## Landing component: ProofStrip — `components/marketing/landing/proof-strip.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Set up in minutes | stat value | components/marketing/landing/proof-strip.tsx:6 | inline |
| for your venue | stat label | components/marketing/landing/proof-strip.tsx:6 | inline |
| Fast enough | stat value | components/marketing/landing/proof-strip.tsx:7 | inline |
| for counter service | stat label | components/marketing/landing/proof-strip.tsx:7 | inline |
| 30 days | stat value | components/marketing/landing/proof-strip.tsx:8 | inline |
| free to pilot | stat label | components/marketing/landing/proof-strip.tsx:8 | inline |
| Permanent venue QR | setup note | components/marketing/landing/proof-strip.tsx:12 | inline |
| Works on any phone, tablet or till | setup note | components/marketing/landing/proof-strip.tsx:12 | inline |
| No hardware, no POS | setup note | components/marketing/landing/proof-strip.tsx:12 | inline |

## Landing component: NabaperksProof — `components/marketing/landing/nabaperks-proof.tsx` + `nabaperks-proof-data.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Real numbers | MonoTag (NABAPERKS_PROOF_TAG) | nabaperks-proof-data.ts:19 | shared:nabaperks-proof-data.ts |
| Joins, stamps and rewards from live venues. | headline (NABAPERKS_PROOF_HEADLINE) | nabaperks-proof-data.ts:21-22 | shared:nabaperks-proof-data.ts |
| Each figure is a real customer action — a card saved, a stamp at the till, or a reward claimed at the counter. From pubs, cafes and takeaways. | intro (NABAPERKS_PROOF_INTRO) | nabaperks-proof-data.ts:24-25 | shared:nabaperks-proof-data.ts |
| Loyalty members | stat label | nabaperks-proof-data.ts:41 | shared:nabaperks-proof-data.ts |
| Customers who saved a card at a venue. | stat helper | nabaperks-proof-data.ts:42 | shared:nabaperks-proof-data.ts |
| Visited in 3 months | stat label | nabaperks-proof-data.ts:46 | shared:nabaperks-proof-data.ts |
| Got at least one stamp in the last three months. | stat helper | nabaperks-proof-data.ts:47 | shared:nabaperks-proof-data.ts |
| Rewards redeemed | stat label | nabaperks-proof-data.ts:51 | shared:nabaperks-proof-data.ts |
| Claimed at the counter — 2,934 earned in total. | stat helper (interpolated) | nabaperks-proof-data.ts:52 | shared:nabaperks-proof-data.ts + facts.ts |
| Members who return | stat label | nabaperks-proof-data.ts:56 | shared:nabaperks-proof-data.ts |
| Came back for a second visit or more. | stat helper | nabaperks-proof-data.ts:57 | shared:nabaperks-proof-data.ts |
| Nabaperks Counter-Loyalty Index · June 2026 | index/as-of line | components/marketing/landing/nabaperks-proof.tsx:40 | shared:facts.ts |
| In the Nabaperks Counter-Loyalty Index (snapshot June 2026), 46.8% of 1,842 loyalty members returned, and 1,180 of 2,934 rewards were redeemed. Calculated from first-party loyalty records. Measured across Nabaperks-powered venues. | citable blockquote (interpolated) | components/marketing/landing/nabaperks-proof.tsx:66-72 | inline + shared:facts.ts |
| Nabaperks first-party loyalty data from UK food-and-drink venues, March 2024 to June 2026. Snapshot as of June 2026. | methodology note (NABAPERKS_PROOF_NOTE = PROOF.methodology) | components/marketing/landing/nabaperks-proof.tsx:76 | shared:facts.ts |

## Landing component: OldCrownCandidate — `components/marketing/landing/old-crown-candidate.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Case study · candidate | MonoTag | components/marketing/landing/old-crown-candidate.tsx:31 | inline |
| Old Crown Girton runs Nabaperks. | h3 | components/marketing/landing/old-crown-candidate.tsx:32-34 | inline |
| Old Crown · CB3 0QD · England | meta (interpolated postcode) | components/marketing/landing/old-crown-candidate.tsx:35-37 | inline + shared:venue-proof-data.ts |
| "The weekly note on who's coming back is something a paper card could never tell us. It's quietly changed how we look after our regulars." | blockquote (Old Crown review, from pool) | components/marketing/landing/old-crown-candidate.tsx:38-40 | shared:venue-proof-data.ts |
| From the team | attribution | components/marketing/landing/old-crown-candidate.tsx:41-43 | inline |
| From paper cards lost in the wash to a weekly note on who's coming back. | body | components/marketing/landing/old-crown-candidate.tsx:44-47 | inline |
| Programme-level proof | eyebrow | components/marketing/landing/old-crown-candidate.tsx:51 | inline |
| 46.8% of members return, and 1,180 of 2,934 rewards have been redeemed. | body (interpolated) | components/marketing/landing/old-crown-candidate.tsx:52-58 | inline + shared:facts.ts |
| Measured across Nabaperks-powered venues. — Nabaperks Counter-Loyalty Index, June 2026. Programme figures, not Old Crown alone. | note (interpolated) | components/marketing/landing/old-crown-candidate.tsx:59-62 | inline + shared:facts.ts |

## Landing component: VenueProof + reviews — `components/marketing/landing/venue-proof.tsx`, `venue-proof-reviews.tsx`, `venue-proof-data.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| What venues say | MonoTag | components/marketing/landing/venue-proof.tsx:16 | inline |
| Pubs and cafes already on the counter. | h3 | components/marketing/landing/venue-proof.tsx:21-22 | inline |
| Named venues from the Lapen Inns network, with paraphrased operator voice rather than verbatim testimonials. | body | components/marketing/landing/venue-proof.tsx:23-26 | inline |
| Venues quoted | dl term | components/marketing/landing/venue-proof.tsx:29 | inline |
| Sector | dl term | components/marketing/landing/venue-proof.tsx:35 | inline |
| Food & drink | dl value | components/marketing/landing/venue-proof.tsx:36 | inline |
| Operator voice | figcaption eyebrow | components/marketing/landing/venue-proof-reviews.tsx:124 | inline |
| Paraphrased operator voice | attribution fallback | components/marketing/landing/venue-proof-reviews.tsx:151 | inline |
| More venues | "see more" eyebrow | components/marketing/landing/venue-proof-reviews.tsx:170 | inline |
| Other pubs and cafes on Nabaperks. | "see more" body | components/marketing/landing/venue-proof-reviews.tsx:171-172 | inline |
| See more | button | components/marketing/landing/venue-proof-reviews.tsx:181 | inline |
| The Prince of Wales | venue name (pool) | venue-proof-data.ts:16 | shared:venue-proof-data.ts |
| Regulars save it with their pint in hand — no app, no fuss. We're seeing the same faces come back more often, which is the whole point of it. | venue review (pool) | venue-proof-data.ts:18-19 | shared:venue-proof-data.ts |
| Old School House | venue name (pool) | venue-proof-data.ts:23 | shared:venue-proof-data.ts |
| We got through boxes of paper cards that always ended up in the wash. This one lives on the customer's phone, so nobody loses their stamps. | venue review (pool) | venue-proof-data.ts:24-25 | shared:venue-proof-data.ts |
| Barley Mow | venue name (pool) | venue-proof-data.ts:29 | shared:venue-proof-data.ts |
| What sold me is that the stamps can't be faked — they're checked against our QR, so a full card actually means something. | venue review (pool) | venue-proof-data.ts:30-31 | shared:venue-proof-data.ts |
| The Queen Elizabeth | venue name (pool) | venue-proof-data.ts:35 | shared:venue-proof-data.ts |
| It suits a food-led pub rather than feeling like some generic system bolted on. We had it running in an afternoon. | venue review (pool) | venue-proof-data.ts:36-37 | shared:venue-proof-data.ts |
| The Railway | venue name (pool) | venue-proof-data.ts:41 | shared:venue-proof-data.ts |
| Quick enough for a Friday rush — they scan, they're stamped, on to the next order. It's never once held the bar up. | venue review (pool) | venue-proof-data.ts:42-43 | shared:venue-proof-data.ts |
| The Bell | venue name (pool) | venue-proof-data.ts:47 | shared:venue-proof-data.ts |
| One code on the bar covers the tables and the takeaway hatch too. Far simpler than I expected for the money. | venue review (pool) | venue-proof-data.ts:48-49 | shared:venue-proof-data.ts |
| Old Crown | venue name (pool) | venue-proof-data.ts:53 | shared:venue-proof-data.ts |
| The weekly note on who's coming back is something a paper card could never tell us. It's quietly changed how we look after our regulars. | venue review (pool) | venue-proof-data.ts:54-55 | shared:venue-proof-data.ts |
| The Corner House | venue name (pool) | venue-proof-data.ts:59 | shared:venue-proof-data.ts |
| There's nothing to download, so customers get it straight away. Even the ones who can't stand apps are happy to save it. | venue review (pool) | venue-proof-data.ts:60-61 | shared:venue-proof-data.ts |
| White Horse | venue name (pool) | venue-proof-data.ts:65 | shared:venue-proof-data.ts |
| It keeps the phone in the customer's hand and doesn't pester them with messages. People round here trust that. | venue review (pool) | venue-proof-data.ts:66-67 | shared:venue-proof-data.ts |

## Landing component: ComparisonTable — `components/marketing/landing/comparison-table.tsx` + `comparison-data.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Yes / No | sr-only cell marks | components/marketing/landing/comparison-table.tsx:26 | inline |
| Checks every row below — no install, no wallet pass, no plastic. | mobile wedge lead | components/marketing/landing/comparison-table.tsx:48-49 | inline |
| What a Nabaperks browser card includes | list aria-label | components/marketing/landing/comparison-table.tsx:54 | inline |
| Where wallet pass, paper and POS fall short | disclosure summary | components/marketing/landing/comparison-table.tsx:77 | inline |
| Where wallet-pass apps, paper cards and POS loyalty fall short | region aria-label | components/marketing/landing/comparison-table.tsx:84 | inline |
| No app · no wallet · no plastic | MonoTag | components/marketing/landing/comparison-table.tsx:133 | inline |
| A real browser card — not a wallet pass. | h2 | components/marketing/landing/comparison-table.tsx:134-136 | inline |
| Most "no-app" loyalty cards still make customers install an Apple or Google Wallet pass. Nabaperks just opens in the browser and saves in one tap — so "saved" and "usable" are the same moment, with nothing to install. | body | components/marketing/landing/comparison-table.tsx:137-143 | inline |
| Browser-card comparison table | table aria-label | components/marketing/landing/comparison-table.tsx:150 | inline |
| How a Nabaperks browser card compares with wallet-pass loyalty apps, paper punch cards and POS loyalty across install, fraud, hardware and data. | table caption (sr-only) | components/marketing/landing/comparison-table.tsx:156-160 | inline |
| With wallet-pass tools, customers often end up enrolled but not installed — they tap "add to wallet", never finish, and can't find the reward on a locked phone. A browser card has no install step to abandon. | body | components/marketing/landing/comparison-table.tsx:224-230 | inline |
| Nabaperks | column label | comparison-data.ts:22 | shared:comparison-data.ts |
| Browser-based card | column sub | comparison-data.ts:22 | shared:comparison-data.ts |
| Wallet-pass apps | column label | comparison-data.ts:23 | shared:comparison-data.ts |
| e.g. Loopy, Stamp Me | column sub | comparison-data.ts:23 | shared:comparison-data.ts |
| Paper card | column label | comparison-data.ts:24 | shared:comparison-data.ts |
| Punch / stamp | column sub | comparison-data.ts:24 | shared:comparison-data.ts |
| POS loyalty | column label | comparison-data.ts:25 | shared:comparison-data.ts |
| e.g. Square, Loyverse | column sub | comparison-data.ts:25 | shared:comparison-data.ts |
| Nothing to download or install | comparison row feature | comparison-data.ts:36 | shared:comparison-data.ts |
| Can't be lost or left at home | comparison row feature | comparison-data.ts:37 | shared:comparison-data.ts |
| Every stamp is till-verified — can't be faked | comparison row feature | comparison-data.ts:38 | shared:comparison-data.ts |
| No POS or hardware — works on any till | comparison row feature | comparison-data.ts:39 | shared:comparison-data.ts |
| The phone never crosses the counter | comparison row feature | comparison-data.ts:40 | shared:comparison-data.ts |
| Gives you visit & redemption data | comparison row feature | comparison-data.ts:41 | shared:comparison-data.ts |

## Landing component: CounterVerifiedStamp — `components/marketing/landing/counter-verified-stamp.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR verified | check title | components/marketing/landing/counter-verified-stamp.tsx:26 | inline |
| The stamp only counts when it comes from your one permanent venue QR — not a screenshot or a shared link. | check body | components/marketing/landing/counter-verified-stamp.tsx:27 | inline |
| Membership verified | check title | components/marketing/landing/counter-verified-stamp.tsx:31 | inline |
| We confirm it's a real saved card on your programme before the stamp lands. | check body | components/marketing/landing/counter-verified-stamp.tsx:32 | inline |
| One per UK date | check title | components/marketing/landing/counter-verified-stamp.tsx:36 | inline |
| A hard cap of one stamp per customer per UK calendar date stops self-stamping and stamping mates twice. | check body | components/marketing/landing/counter-verified-stamp.tsx:37 | inline |
| Unusual location flag | check title | components/marketing/landing/counter-verified-stamp.tsx:41 | inline |
| Optional location checks flag stamps claimed far from your counter, so off-site collecting stands out. | check body | components/marketing/landing/counter-verified-stamp.tsx:42 | inline |
| Reward checked at redemption | check title | components/marketing/landing/counter-verified-stamp.tsx:46 | inline |
| A reward is checked when they claim it — not waved through from a screenshot of a full card. | check body | components/marketing/landing/counter-verified-stamp.tsx:47 | inline |
| Built-in anti-fraud | MonoTag | components/marketing/landing/counter-verified-stamp.tsx:55 | inline |
| Stamps confirmed at the counter. | h2 | components/marketing/landing/counter-verified-stamp.tsx:56-58 | inline |
| Every stamp is checked against your physical venue QR, the customer's membership, your live account, a one-stamp-per-customer-per-UK-date cap, and optional unusual-location checks. Fraud is designed out — not "mitigated". | body | components/marketing/landing/counter-verified-stamp.tsx:59-65 | inline |
| The five anti-fraud checks | SnapRail label | components/marketing/landing/counter-verified-stamp.tsx:69 | inline |
| Swipe for all five checks → | SnapRail hint | components/marketing/landing/counter-verified-stamp.tsx:70 | inline |
| Check 01 … Check 05 | check index labels | components/marketing/landing/counter-verified-stamp.tsx:90 | inline |
| How paper and wallet passes get faked | ReadMore summary | components/marketing/landing/counter-verified-stamp.tsx:102 | inline |
| A paper card is trivially faked — stamps bought online, self-stamping, a quick photocopy — and most are lost before they're ever redeemed. Wallet-pass rivals stamp from a sharable staff code. Nabaperks checks every stamp where it's claimed, so the phone never crosses the counter. | body | components/marketing/landing/counter-verified-stamp.tsx:105-110 | inline |

## Landing component: MidPageCta — `components/marketing/landing/mid-page-cta.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Start your card-backed pilot | section aria-label | components/marketing/landing/mid-page-cta.tsx:15 | inline |
| Start your 30-day pilot. | h2 | components/marketing/landing/mid-page-cta.tsx:18-20 | inline |
| See the whole scan-to-reward flow on your own card. Card required — cancel anytime. | body | components/marketing/landing/mid-page-cta.tsx:21-24 | inline |
| Start free pilot | button | components/marketing/landing/mid-page-cta.tsx:28 | inline |
| Card required — cancel anytime | reassurance point | components/marketing/landing/mid-page-cta.tsx:31 | inline |
| No contract | reassurance point | components/marketing/landing/mid-page-cta.tsx:31 | inline |

## Landing component: VenueBenefits + card — `components/marketing/landing/venue-benefits.tsx`, `venue-benefits-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Built for venues | MonoTag | components/marketing/landing/venue-benefits.tsx:24 | inline |
| Built for the counter, not the boardroom. | h2 | components/marketing/landing/venue-benefits.tsx:25-27 | inline |
| Simple rewards customers understand | benefit title | components/marketing/landing/venue-benefits.tsx:29 | inline |
| Start with one clear reward, then add a surprise reward later if it fits your venue — no points maths, no tiers to explain. | benefit body | components/marketing/landing/venue-benefits.tsx:30-31 | inline |
| See your regulars, don't guess | benefit title | components/marketing/landing/venue-benefits.tsx:33 | inline |
| Every visit and redemption lands in a weekly digest, so loyalty is something you can read — not a hunch about who keeps coming back. | benefit body | components/marketing/landing/venue-benefits.tsx:34-35 | inline |
| Fits how your counter already runs | benefit title | components/marketing/landing/venue-benefits.tsx:37 | inline |
| It works on the phone, tablet or till you already have — even cash-only — and your team never has to hold a customer's phone. Nothing to integrate; your permanent venue QR is ready when you go live. | benefit body | components/marketing/landing/venue-benefits.tsx:38-40 | inline |
| Your programme setup | mono meta | components/marketing/landing/venue-benefits.tsx:47 | inline |
| What you configure · what customers see | mono id | components/marketing/landing/venue-benefits.tsx:49-50 | inline |
| The Old Crown · Bristol | card venue line | components/marketing/landing/venue-benefits-card.tsx:25 | inline |
| Free flat white after 4 stamps | card title | components/marketing/landing/venue-benefits-card.tsx:26 | inline |
| Card Nº OC-0248 | card footer-left | components/marketing/landing/venue-benefits-card.tsx:34 | inline |
| One stamp left | card footer-right | components/marketing/landing/venue-benefits-card.tsx:36 | inline |
| Your venue QR | info-row eyebrow | components/marketing/landing/venue-benefits-card.tsx:41 | inline |
| One permanent scan point for joins, stamps, and rewards. | info-row title | components/marketing/landing/venue-benefits-card.tsx:42 | inline |
| Your reward setup | info-row eyebrow | components/marketing/landing/venue-benefits-card.tsx:46 | inline |
| Clear reward terms, shown to customers before go-live. | info-row title | components/marketing/landing/venue-benefits-card.tsx:47 | inline |

## Landing component: VenuePersonas — `components/marketing/landing/venue-personas.tsx` + `persona-data.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Built for your venue | MonoTag | components/marketing/landing/venue-personas.tsx:20 | inline |
| Made for food & drink — not generic CRM. | h2 | components/marketing/landing/venue-personas.tsx:21-23 | inline |
| Same browser card, same counter-verified stamps — tuned to how your counter actually runs. | body | components/marketing/landing/venue-personas.tsx:24-27 | inline |
| Venue types | SnapRail label | components/marketing/landing/venue-personas.tsx:32 | inline |
| Swipe for all four venue types → | SnapRail hint | components/marketing/landing/venue-personas.tsx:33 | inline |
| See more | persona CTA fallback | components/marketing/landing/venue-personas.tsx:62,68 | inline |
| Pubs & gastropubs | persona title | persona-data.ts:39 | shared:persona-data.ts |
| Reward regulars without an app or a CRM. One venue QR covers the bar, the tables and the takeaway hatch — and never slows the bar on a Friday. | persona hook | persona-data.ts:40 | shared:persona-data.ts |
| Cafes & coffee shops | persona title | persona-data.ts:48 | shared:persona-data.ts |
| Turn the daily-habit visit into a stamp. The card opens before the coffee cools — no app, no queue at the till. | persona hook | persona-data.ts:49 | shared:persona-data.ts |
| Takeaways | persona title | persona-data.ts:54 | shared:persona-data.ts |
| Works on any till, even cash-only. No POS to buy, no number to type — just the QR by the counter. | persona hook | persona-data.ts:55 | shared:persona-data.ts |
| Bars & wine bars | persona title | persona-data.ts:60 | shared:persona-data.ts |
| Give regulars a reason to choose your bar again. The card lives on their phone, so there is nothing to lose between rounds. | persona hook | persona-data.ts:63 | shared:persona-data.ts |

## Landing component: SeparateMarketing — `components/marketing/landing/separate-marketing.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Marketing by choice | MonoTag | components/marketing/landing/separate-marketing.tsx:24 | inline |
| Customers earn stamps without joining a marketing list. | h2 | components/marketing/landing/separate-marketing.tsx:25-27 | inline |
| Loyalty and marketing stay separate, so collecting stamps never signs anyone up for promotions — and you won't spam your regulars to keep them. | body | components/marketing/landing/separate-marketing.tsx:28-32 | inline |
| Loyalty ≠ a marketing list | benefit title | components/marketing/landing/separate-marketing.tsx:38 | inline |
| A customer can collect and redeem rewards without ever agreeing to promotional messages. The two choices are recorded separately. | benefit body | components/marketing/landing/separate-marketing.tsx:39-40 | inline |
| Real UK GDPR, not just a toggle | benefit title | components/marketing/landing/separate-marketing.tsx:42 | inline |
| Marketing keeps its own lawful basis (soft opt-in), the way the ICO expects — not bundled into the act of joining your card. | benefit body | components/marketing/landing/separate-marketing.tsx:43-44 | inline |
| Scoped to your venue | benefit title | components/marketing/landing/separate-marketing.tsx:46 | inline |
| A card collects only at your counter, and the data stays yours — kept secure, never sold on. | benefit body | components/marketing/landing/separate-marketing.tsx:47-48 | inline |
| Plain-English terms | benefit title | components/marketing/landing/separate-marketing.tsx:50 | inline |
| No dark patterns. Read exactly what's collected in our Privacy and Terms. | benefit body + links "Privacy", "Terms" | components/marketing/landing/separate-marketing.tsx:51-58 | inline |

## Landing component: TrustPricing — `components/marketing/landing/trust-pricing.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Unlimited stamps and members | plan include item | components/marketing/landing/trust-pricing.tsx:10 | inline |
| Simple reward setup | plan include item | components/marketing/landing/trust-pricing.tsx:11 | inline |
| Permanent venue QR | plan include item | components/marketing/landing/trust-pricing.tsx:12 | inline |
| Weekly digest of visits and redemptions | plan include item | components/marketing/landing/trust-pricing.tsx:13 | inline |
| Pricing | MonoTag | components/marketing/landing/trust-pricing.tsx:25 | inline |
| £29/month per venue. 30 days free. No contract. | h2 | components/marketing/landing/trust-pricing.tsx:26-28 | inline |
| One plain price for no-app loyalty with till-verified stamps. Card required — cancel anytime. | body | components/marketing/landing/trust-pricing.tsx:29-32 | inline |
| Growth Plan | mono meta | components/marketing/landing/trust-pricing.tsx:37-38 | inline |
| One venue | mono id | components/marketing/landing/trust-pricing.tsx:40-41 | inline |
| £29 | price | components/marketing/landing/trust-pricing.tsx:45 | inline |
| /month | price unit | components/marketing/landing/trust-pricing.tsx:46 | inline |
| GBP 29/month · one venue · no contracts | price meta | components/marketing/landing/trust-pricing.tsx:48-50 | inline |
| At £29/month, one or two extra regulars a week can cover the cost for many cafes. | body (bold) | components/marketing/landing/trust-pricing.tsx:51-54 | inline |
| Start free pilot | button | components/marketing/landing/trust-pricing.tsx:76 | inline |
| View full pricing | button (link) | components/marketing/landing/trust-pricing.tsx:79 | inline |
| Card required — cancel anytime. | mono id | components/marketing/landing/trust-pricing.tsx:84-86 | inline |

## Landing component: LandingFaq — `components/marketing/landing/faq.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Do my customers have to download an app? | FAQ q | components/marketing/landing/faq.tsx:14 | inline |
| No — and no wallet pass either. Customers scan your till QR and the card opens straight in their phone browser, saved in one tap. It works on any iPhone or Android with nothing to download or install. | FAQ a | components/marketing/landing/faq.tsx:15 | inline |
| Can staff or customers fake the stamps? | FAQ q | components/marketing/landing/faq.tsx:18 | inline |
| No. Customers stamp themselves from your venue QR. Each stamp is counter-verified — we check it's your real QR, their saved card, and your programme, capped at one stamp per customer per UK date. Unusual locations can be flagged. Rewards are checked at redemption, never from a screenshot. | FAQ a | components/marketing/landing/faq.tsx:19 | inline |
| What if a customer loses or changes their phone — do they lose their stamps? | FAQ q | components/marketing/landing/faq.tsx:22 | inline |
| They don't lose anything. Stamps stay on their account — not on a losable card or a single phone. They sign back in on a new device and everything is still there. | FAQ a | components/marketing/landing/faq.tsx:23 | inline |
| Do I need a POS, till integration or special hardware? | FAQ q | components/marketing/landing/faq.tsx:26 | inline |
| No POS, no integration, no special hardware. It runs on any phone, tablet or till, including cash-only takeaways, with one permanent venue QR for customers to scan. | FAQ a | components/marketing/landing/faq.tsx:27 | inline |
| How much does it cost, and am I tied into a contract? | FAQ q | components/marketing/landing/faq.tsx:30 | inline |
| A 30-day free pilot, then £29/month per venue, with no contract. Card required — cancel anytime. | FAQ a | components/marketing/landing/faq.tsx:31 | inline |
| Can I try it before I pay? | FAQ q | components/marketing/landing/faq.tsx:34 | inline |
| Yes. You can preview the QR flow during the 30-day pilot. Card required — cancel anytime. | FAQ a | components/marketing/landing/faq.tsx:35 | inline |
| Will it spam my customers, and is their data safe? | FAQ q | components/marketing/landing/faq.tsx:38 | inline |
| No spam: loyalty and marketing are kept separate, so customers earn and redeem without joining any marketing list. Their data stays with your venue, with marketing kept consent-led and plain-English Privacy and Terms. | FAQ a | components/marketing/landing/faq.tsx:39 | inline |
| How is this different from a paper card or apps like Stamp Me? | FAQ q | components/marketing/landing/faq.tsx:42 | inline |
| It keeps what customers like about a paper card — simple, scan-and-collect, no app — but it can't be lost or faked. And unlike wallet-pass apps such as Stamp Me or Loopy Loyalty, there is nothing to install. You also get a weekly digest of visits and redemptions a paper card can never give you. | FAQ a | components/marketing/landing/faq.tsx:43 | inline |
| Questions | MonoTag | components/marketing/landing/faq.tsx:56 | inline |
| The honest answers. | h2 | components/marketing/landing/faq.tsx:57-59 | inline |

## Landing component: FinalCta — `components/marketing/landing/final-cta.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your first stamp is waiting | mono meta | components/marketing/landing/final-cta.tsx:15-17 | inline |
| Set up your venue this afternoon. | h2 | components/marketing/landing/final-cta.tsx:18-20 | inline |
| Build your card, preview the QR flow, and start a 30-day pilot. Then it is £29/month for one venue. Card required — cancel anytime. | body | components/marketing/landing/final-cta.tsx:21-24 | inline |
| No app for your customers, no POS for you — it works on any phone, tablet or till. | body | components/marketing/landing/final-cta.tsx:25-28 | inline |
| Start free pilot | button | components/marketing/landing/final-cta.tsx:31 | inline |
| View pricing | button (outline) | components/marketing/landing/final-cta.tsx:34 | inline |
| Log in | button (ghost) | components/marketing/landing/final-cta.tsx:37 | inline |
| Card required — cancel anytime | reassurance point | components/marketing/landing/final-cta.tsx:42 | inline |
| No contract | reassurance point | components/marketing/landing/final-cta.tsx:43 | inline |
| Cancel on a month's notice | reassurance point | components/marketing/landing/final-cta.tsx:44 | inline |

## Landing component: RegularsCalculator — `components/marketing/landing/regulars-calculator.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Regulars calculator | MonoTag | components/marketing/landing/regulars-calculator.tsx:147 | inline |
| What could one small repeat-visit lift be worth? | h2 | components/marketing/landing/regulars-calculator.tsx:148-150 | inline |
| A couple more repeat visits a week can cover the £29/month plan. Profit depends on your margin. | body (PRODUCT.price interpolated) | components/marketing/landing/regulars-calculator.tsx:151-154 | inline + shared:facts.ts |
| Average spend | field label | components/marketing/landing/regulars-calculator.tsx:160 | inline |
| Orders a day | field label | components/marketing/landing/regulars-calculator.tsx:170 | inline |
| Open days a week | field label | components/marketing/landing/regulars-calculator.tsx:178 | inline |
| Repeat-rate lift | field label | components/marketing/landing/regulars-calculator.tsx:187 | inline |
| pp | field suffix | components/marketing/landing/regulars-calculator.tsx:188 | inline |
| Your estimate | eyebrow | components/marketing/landing/regulars-calculator.tsx:199 | inline |
| extra revenue a month, before costs | mono meta | components/marketing/landing/regulars-calculator.tsx:206-208 | inline |
| About {n} extra repeat visits a week from a +{liftPct}pp lift in how many regulars come back. An estimate to sense-check, not a promise — your margin decides the profit. | body (dynamic) | components/marketing/landing/regulars-calculator.tsx:209-216 | inline |
| Start free pilot | button (CTA.startPilot) | components/marketing/landing/regulars-calculator.tsx:220 | shared:facts.ts |
| Email me this estimate | button | components/marketing/landing/regulars-calculator.tsx:223 | inline |
| Show this to the team | button (ghost) | components/marketing/landing/regulars-calculator.tsx:237 | inline |
| Estimate copied — show it to the team | toast (success) | components/marketing/landing/regulars-calculator.tsx:233 | inline |
| Could not copy — try again | toast (error) | components/marketing/landing/regulars-calculator.tsx:234 | inline |
| A +{liftPct}pp repeat-rate lift ≈ {n} extra repeat visits a week and about {£} extra revenue a month (before costs), at {£} average spend, {n} orders a day, {n} days a week. Estimate only — profit depends on your margin. | summary text (copy/email body, dynamic) | components/marketing/landing/regulars-calculator.tsx:135-137 | inline |
| My Nabaperks regulars estimate | mailto subject | components/marketing/landing/regulars-calculator.tsx:140 | inline |

## Marquee — `components/marketing/marquee.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| One venue QR | marquee item (default) | components/marketing/marquee.tsx:5 | inline |
| 30 days free | marquee item (default) | components/marketing/marquee.tsx:6 | inline |
| No POS setup | marquee item (default) | components/marketing/marquee.tsx:7 | inline |
| Fast at the counter | marquee item (default) | components/marketing/marquee.tsx:8 | inline |

_Note: marquee is `aria-hidden` decorative; still word-bearing so captured._

## QR / SnapRail / card-row default aria labels (real-phrase aria)
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR code | QR default aria-label | components/marketing/landing/venue-qr.tsx:23 | inline |
| Venue QR | CardScanRow default qrLabel | components/marketing/landing/sample-card-rows.tsx:43 | inline |
| Venue QR kit preview | QR label (venue-benefits card) | components/marketing/landing/venue-benefits-card.tsx:40 | inline |
| Old Crown Girton | roundel comment example only (NOT rendered) | components/brand/venue-mark.tsx:7 | inline (comment — excluded) |

## Brand + SEO components — `components/brand/**`, `components/seo/**`
_Structural/visual primitives. No hardcoded marketing copy; they render caller-supplied children (`PageTitle`, `Eyebrow`, `MonoTag`, `ReceiptCard`, `VenueMark`, `CategoryBadge`, `KpiTile`, etc.). Only literal: `Logo` default `label = "Nabaperks"` (components/brand/logo.tsx:7) → renders as wordmark + `"{label} home"` aria-label. `json-ld.tsx` emits structured data only._

---

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Start free pilot | ~8 (hero, mid-cta, final-cta, trust-pricing, pricing ×2, about, calculator, demo — CTA.startPilot + inline variants) |
| Log in | ~5 (home nav, pub-hub nav, guide nav, hero, pricing, final-cta) |
| Pricing | ~4 (nav links across home/pub-hub/guide + jump-nav) |
| View pricing / View full pricing | ~3 (pub-hub hero, final-cta, trust-pricing) |
| How it works | ~4 (nav links + jump-nav + counter-flow labels) |
| See more | ~3 (venue-personas ×2, venue-proof-reviews) |
| + / – | ~5 (disclosure toggle markers: pricing FAQ, landing FAQ, jump-nav, read-more, comparison mobile) |
| Home | ~4 (breadcrumbs on guides + about/pricing/pub-hub graphs) |
| Read / Read the guide | 2 (guide related rail; pub-hub guide cards) |

---

## Scope notes / surprises

- **Dead/unrendered components (copy exists but not on any live route).** These are exported from the `landing` barrel but not rendered by any in-scope page (verified: only `app/page.tsx`, `app/loyalty-for-pubs/page.tsx`, `app/demo/demo-card.tsx`, and `guide-page.tsx` consume the barrel):
  - `pilot-proof-strip.tsx` — `SHOW_PILOT_PROOF = false` and empty stats array → renders `null`. Contains eyebrow "Pilot snapshot" (dormant). Flagged as feature-flag-gated placeholder.
  - `venue-personas.tsx` `SHOW_PERSONA_SPOKES = false` (persona-data.ts:21) — the cafes/takeaways/bars persona CTAs and their spoke routes (`/loyalty-for-cafes`, `/loyalty-for-takeaways`, `/loyalty-for-bars`) are **not built**; only the pub persona links out. Persona hooks still render as text. Internal-only "candidate/deferred" intent noted in comments.
  - `old-crown-candidate.tsx` — MonoTag literally reads **"Case study · candidate"** and body says "Programme figures, not Old Crown alone" — an explicitly provisional/placeholder case study (comment: "A dedicated Old Crown page is deliberately deferred").
- **Internal/marketing-governance terms that leak into visible copy vocabulary:** "Counter-Loyalty Index", "counter-verified stamps", "till-verified" and "counter-verified" are used interchangeably across surfaces (e.g. comparison-data says "till-verified", most copy says "counter-verified"). Not a defect, but a consistency-audit signal.
- **Duplicated copy within this slice (same/near-identical strings across files):**
  - Two near-identical Scan/Save/Stamp/Reward flows: `counter-flow.tsx` (home) vs `pub-counter-flow.tsx` (pub hub) — same 4 step titles, reworded bodies.
  - Two pricing blocks: `trust-pricing.tsx` (home `#pricing`) and `app/pricing/page.tsx` — overlapping plan-include lists (home omits "Optional location checks" and phrases the digest line differently: "Weekly digest of visits and redemptions" vs "Weekly digest of visits, regulars, and redemptions").
  - "Card required — cancel anytime" appears ~10+ times across hero, CTAs, pricing, FAQ, reassurance bar.
  - "No extra hardware. No POS or EPOS integration required." (PRODUCT.posLine) reused verbatim on about, pub-hub, and reward-regulars guide.
  - Venue-name + postcode pairs live in BOTH `lib/marketing/facts.ts` (OPERATOR_ESTATE) and `components/marketing/landing/venue-proof-data.ts` (venueProofPool) — same 9 venues, duplicated as separate arrays.
  - "One or two extra regulars a week can cover the cost/it" appears in hero, pricing, and trust-pricing with slight wording variants.
- **Two spellings of "café/cafe":** demo card uses "A sample café · demo" (accented) and "Coffee loyalty card"; everywhere else uses unaccented "cafes". Consistency signal.
- **No TODO/lorem/FIXME placeholder text** found in rendered copy. The only "placeholder"-style content is the feature-flag-gated dormant components above.
- **Sample/demo data that could read as real claims:** hero card venue "Old Crown · CB3 0QD", venue-benefits card "The Old Crown · Bristol" + "Card Nº OC-0248", demo "A sample café". These are illustrative sample cards, not live venue data.
- Dev harness (`app/dev/**`) was excluded; confirmed it imports the real `Marquee`/landing components rather than hardcoding its own copy, so nothing unique to inventory there.



<hr>

# ▓ SURFACE: Merchant Dashboard (/app)

# Copy Inventory — Merchant Dashboard (/app)

_Scope: app/app/**, app/(auth)/**, components/merchant/**, lib/merchant/* copy modules, lib/notifications/venue-announcement-form-copy.ts_

## Merchant Auth — Login — `app/(auth)/login/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| QR kit, stamps, and rewards in one console | list item | app/(auth)/login/page.tsx:16 | inline |
| Pick up onboarding where you left off | list item | app/(auth)/login/page.tsx:17 | inline |
| Billing when you activate your live venue QR | list item | app/(auth)/login/page.tsx:18 | inline |
| Email code could not be used | error title | app/(auth)/login/page.tsx:29 | inline |
| Request a fresh code. Provider details are hidden for safety. | error body | app/(auth)/login/page.tsx:30 | inline |
| Sign-in problem | error title (fallback) | app/(auth)/login/page.tsx:35 | inline |
| Something went wrong on the way in. Try again, or reset your password if it keeps happening. | error body (fallback) | app/(auth)/login/page.tsx:36 | inline |
| Merchant access | eyebrow | app/(auth)/login/page.tsx:64 | inline |
| Welcome back to your loyalty counter. | page title | app/(auth)/login/page.tsx:65 | inline |
| Log in to continue venue setup, download your QR kit, manage checks, and review loyalty activity. | description | app/(auth)/login/page.tsx:66 | inline |
| Merchant console | eyebrow | app/(auth)/login/page.tsx:91 | inline |
| Back to the counter | heading | app/(auth)/login/page.tsx:93 | inline |
| Enter your venue email and password to open the console. | body | app/(auth)/login/page.tsx:96 | inline |

## Merchant Auth — Sign up — `app/(auth)/signup/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| No app for your customers to download | list item | app/(auth)/signup/page.tsx:16 | inline |
| Customers stamp themselves from your venue QR | list item | app/(auth)/signup/page.tsx:17 | inline |
| Card required — cancel anytime. | list item | app/(auth)/signup/page.tsx:18 | inline |
| Start free pilot | eyebrow | app/(auth)/signup/page.tsx:41 | inline |
| Your first stamp is waiting. | page title | app/(auth)/signup/page.tsx:42 | inline |
| Set up your venue QR loyalty card in about five minutes. Create your account, verify your email with a {otpCodeLabel} code, then add your venue, rewards, and printed kit. | description (interpolated) | app/(auth)/signup/page.tsx:43 | inline |
| 30 days free | eyebrow | app/(auth)/signup/page.tsx:68 | inline |
| Open your till | heading | app/(auth)/signup/page.tsx:69 | inline |
| Create your account and verify your email with a {otpCodeLabel} code. Card required — cancel anytime. | body (interpolated) | app/(auth)/signup/page.tsx:73 | inline |

## Merchant Auth — Reset password — `app/(auth)/reset-password/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reset takes about a minute | list item | app/(auth)/reset-password/page.tsx:15 | inline |
| We email a {otpCodeLabel} code to confirm it is you | list item (interpolated) | app/(auth)/reset-password/page.tsx:16 | inline |
| Your venue setup and loyalty data stay exactly as they were | list item | app/(auth)/reset-password/page.tsx:17 | inline |
| Merchant access | eyebrow | app/(auth)/reset-password/page.tsx:31 | inline |
| Reset your console password. | page title | app/(auth)/reset-password/page.tsx:32 | inline |
| Enter your venue email and we will send a {otpCodeLabel} code. Use it to set a new password and get back to your counter. | description (interpolated) | app/(auth)/reset-password/page.tsx:33 | inline |
| Merchant console | eyebrow | app/(auth)/reset-password/page.tsx:58 | inline |
| Reset password | heading | app/(auth)/reset-password/page.tsx:60 | inline |
| Enter your venue email. We will send a {otpCodeLabel} reset code. | body (interpolated) | app/(auth)/reset-password/page.tsx:63 | inline |

## Merchant Auth — Server actions — `app/(auth)/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Use at least 8 characters. | validation (password) | app/(auth)/actions.ts:64 | inline |
| Use a mix of letters and numbers. | validation (password) | app/(auth)/actions.ts:66 | inline |
| Enter a valid email address. | validation (email) | app/(auth)/actions.ts:85,123,183,277 | inline |
| Could not send another code just now. Wait a moment and try again. | error (form) | app/(auth)/actions.ts:108 | inline |
| We sent another {digitLabel} code. Enter it below. | success message (interpolated) | app/(auth)/actions.ts:115 | inline |
| Enter your name. | validation (name) | app/(auth)/actions.ts:122 | inline |
| Passwords do not match. | validation (confirmPassword) | app/(auth)/actions.ts:127,315 | inline |
| Could not create the account just now. Check your details and try again. | error (form) | app/(auth)/actions.ts:152 | inline |
| That email already has a venue account. Log in or reset your password instead. | error (form) | app/(auth)/actions.ts:163 | inline |
| We sent a {digitLabel} code. Enter it below to verify your email. | success message (interpolated) | app/(auth)/actions.ts:170 | inline |
| Enter your password. | validation (password) | app/(auth)/actions.ts:184 | inline |
| Verify your email first — get a fresh code and finish verification. | error (form) | app/(auth)/actions.ts:204 | inline |
| That email or password is not right. | error (form) | app/(auth)/actions.ts:211 | inline |
| Request a fresh email code. | error (form) | app/(auth)/actions.ts:229 | inline |
| Enter the {digitLabel} code from your email. | validation (otp, interpolated) | app/(auth)/actions.ts:231,310 | inline |
| That code was not accepted. Check it and try again. | error (form) | app/(auth)/actions.ts:250,263,334,347 | inline |
| Request a fresh reset code. | error (form) | app/(auth)/actions.ts:308 | inline |
| Could not set that password. Try again. | error (form) | app/(auth)/actions.ts:356 | inline |
| If that email has a venue account, we sent a {digitLabel} reset code. | success message (interpolated) | app/(auth)/actions.ts:293 | inline |
| Too many sign-up attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:399 | inline |
| Too many sign-in attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:401 | inline |
| Too many code checks. Try again later. | rate-limit error | app/(auth)/actions.ts:403 | inline |
| Too many reset attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:405 | inline |

## /app root dashboard — `app/app/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your venue | eyebrow | app/app/page.tsx:52 | inline |
| {merchant.business_name} | page title (dynamic) | app/app/page.tsx:53 | inline (data) |
| A quick read on how your loyalty card is doing: members, repeat visits, and rewards. | description | app/app/page.tsx:54 | inline |
| Announce | button | app/app/page.tsx:60 | inline |
| Scan reward | button | app/app/page.tsx:66 | inline |
| your venue QR | error-boundary label (aria/fallback context) | app/app/page.tsx:77 | inline |
| your dashboard numbers | error-boundary label | app/app/page.tsx:86 | inline |
| recent activity | error-boundary label | app/app/page.tsx:92 | inline |

## /app layout / loading / error / not-found
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading merchant workspace | aria-label (loading) | app/app/loading.tsx:11 | inline |
| That didn't load | empty-state title (error) | app/app/error.tsx:22 | inline |
| Something interrupted your workspace. Try again. Your card, members, and rewards are safe on the server. | empty-state description | app/app/error.tsx:23 | inline |
| Try again | button | app/app/error.tsx:26 | inline |
| Page not found | empty-state title (404) | app/app/not-found.tsx:18 | inline |
| That page does not exist or has moved. Your card, members, and rewards are safe — head back to the dashboard. | empty-state description | app/app/not-found.tsx:19 | inline |
| Back to dashboard | button | app/app/not-found.tsx:23 | inline |
| (route metadata title/desc/OG) | metadata | app/app/layout.tsx:12 | shared:metadata (PRIVATE_ROUTE_METADATA) |

## Account hub — `app/app/account/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Profile | tab heading title | app/app/account/page.tsx:21 | inline |
| Your business and venue details. Save when you're done. | tab heading description | app/app/account/page.tsx:22 | inline |
| Billing | tab heading title | app/app/account/page.tsx:25 | inline |
| Your plan and payments, handled securely by Stripe. | tab heading description | app/app/account/page.tsx:26 | inline |

## Activity — `app/app/activity/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Activity | eyebrow + title | app/app/activity/page.tsx:47,48 | inline |
| Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads. | description | app/app/activity/page.tsx:49 | inline |
| No activity yet | empty-state title | app/app/activity/page.tsx:100 | inline |
| Activity will appear after members join, add stamps, redeem rewards, or download QR assets. | empty-state description | app/app/activity/page.tsx:101 | inline |
| Open your Poster kit | button | app/app/activity/page.tsx:107 | inline |

## Announcements — `app/app/announcements/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Announce | eyebrow | app/app/announcements/page.tsx:30 | inline |
| Message your regulars | title | app/app/announcements/page.tsx:31 | inline |
| Send short venue updates to members who allowed push notifications for your loyalty card. | description | app/app/announcements/page.tsx:32 | inline |
| Announcement composer | aria-label (section) | app/app/announcements/page.tsx:39 | inline |

## Billing (redirect shell) — `app/app/billing/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing action could not be completed. Try again. | error (thrown) | app/app/billing/actions.ts:10 | inline |

## Card actions — `app/app/card/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery card could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:18 | inline |
| Reward could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:20 | inline |
| Unable to update reward | error | app/app/card/actions.ts:21 | inline |
| Keep at least 3 active rewards before launch QR stays live. | error | app/app/card/actions.ts:23 | inline |
| Complete merchant onboarding before saving a card. | error (form) | app/app/card/actions.ts:100 | inline |
| Enter a card name. | validation | app/app/card/actions.ts:119 | inline |
| Use 80 characters or fewer. | validation | app/app/card/actions.ts:120 | inline |
| Enter a whole number of stamps. | validation | app/app/card/actions.ts:123 | inline |
| Use at least {DEFAULT_STAMPS_REQUIRED} visits. | validation (interpolated) | app/app/card/actions.ts:125 | inline |
| Use {MAX_STAMPS_REQUIRED} visits or fewer. | validation (interpolated) | app/app/card/actions.ts:127 | inline |
| Enter clear mystery reward terms. | validation | app/app/card/actions.ts:131 | inline |
| Add enough detail for members to understand the offer. | validation | app/app/card/actions.ts:133,220,339 | inline |
| Use 500 characters or fewer. | validation | app/app/card/actions.ts:135,222,341 | inline |
| Surprise reward | reward name (RPC param, stored copy) | app/app/card/actions.ts:149 | inline |
| Complete merchant onboarding before saving rewards. | error (form) | app/app/card/actions.ts:199 | inline |
| Save the mystery card before adding rewards. | validation | app/app/card/actions.ts:209 | inline |
| Enter the reward name. | validation | app/app/card/actions.ts:212 | inline |
| Use 100 characters or fewer. | validation | app/app/card/actions.ts:214,333 | inline |
| Enter clear customer-facing reward terms. | validation | app/app/card/actions.ts:218 | inline |
| Enter a whole-number weight. | validation | app/app/card/actions.ts:227 | inline |
| Use a weight of at least 1. | validation | app/app/card/actions.ts:229 | inline |
| Use a weight of 1,000 or less. | validation | app/app/card/actions.ts:231 | inline |
| Enter a whole-number display order. | validation | app/app/card/actions.ts:235 | inline |
| Birthday reward could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:301 | inline |
| Complete merchant onboarding before saving a birthday reward. | error (form) | app/app/card/actions.ts:312 | inline |
| Save your mystery card before setting up a birthday reward. | validation (form) | app/app/card/actions.ts:325 | inline |
| Enter the birthday reward name. | validation | app/app/card/actions.ts:331 | inline |
| Enter clear birthday reward terms. | validation | app/app/card/actions.ts:337 | inline |
| Complete merchant onboarding before updating rewards. | error | app/app/card/actions.ts:379 | inline |

## Customers (members list) — `app/app/customers/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | eyebrow | app/app/customers/page.tsx:55 | inline |
| Loyalty members | title | app/app/customers/page.tsx:56 | inline |
| Stamp progress and reward status for everyone who has joined your card. | description | app/app/customers/page.tsx:57 | inline |
| Send a reward | button (link) | app/app/customers/page.tsx:60 | inline |
| No members yet | empty-state title | app/app/customers/page.tsx:114 | inline |
| Members will appear here after they join via the venue QR. | empty-state description | app/app/customers/page.tsx:115 | inline |
| Open your Poster kit | button | app/app/customers/page.tsx:121 | inline |

## Send a reward — `app/app/customers/send-reward/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | eyebrow | app/app/customers/send-reward/page.tsx:43 | inline |
| Send a reward | title | app/app/customers/send-reward/page.tsx:44 | inline |
| Give a member a reward outside the stamp card. It redeems like any other reward, and you choose when it expires. | description | app/app/customers/send-reward/page.tsx:45 | inline |
| Back to members | button | app/app/customers/send-reward/page.tsx:49 | inline |
| Recently sent | section heading | app/app/customers/send-reward/page.tsx:60 | inline |
|  · Invite | list row suffix (kind === "invite") | app/app/customers/send-reward/page.tsx:82 | inline |
| You've already sent this member a reward today. | error | app/app/customers/send-reward/actions.ts:49 | inline |
| You've reached today's sent-reward limit. Try again tomorrow. | error | app/app/customers/send-reward/actions.ts:52 | inline |
| Reward could not be sent. Check the details and try again. | error | app/app/customers/send-reward/actions.ts:54 | inline |
| A local venue | fallback business name (email) | app/app/customers/send-reward/actions.ts:195 | inline |
| Complete merchant onboarding before sending rewards. | error (form) | app/app/customers/send-reward/actions.ts:237 | inline |
| You've sent the maximum rewards for today. Try again tomorrow. | error (form, rate limit) | app/app/customers/send-reward/actions.ts:267 | inline |

## Launch hub — `app/app/launch/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're live | page heading (launchReady) | app/app/launch/page.tsx:60 | inline |
| Your account is created | page heading (needsBilling) | app/app/launch/page.tsx:62 | inline |
| Bring your venue to life | page heading (default) | app/app/launch/page.tsx:63 | inline |
| Merchant setup | eyebrow | app/app/launch/page.tsx:75 | inline |
| Customers can scan, join, and collect stamps. Your QR is live below when you need the link. | description (launchReady) | app/app/launch/page.tsx:80 | inline |
| Your account is created. Proceed to billing to activate your venue and start accepting stamps. | description (needsBilling) | app/app/launch/page.tsx:82 | inline |
| {readiness.total} setup checks and you're live. Create your QR once the earlier steps are done. | description (default, interpolated) | app/app/launch/page.tsx:83 | inline |
| Open venue QR | button (launchReady) | app/app/launch/page.tsx:87 | inline |
| Proceed to billing | button (needsBilling) | app/app/launch/page.tsx:92 | inline |
| Complete merchant onboarding first. | error (form) | app/app/launch/actions.ts:47 | inline |
| Unable to load venue location. | error (form) | app/app/launch/actions.ts:80 | inline |
| Unable to save venue location. | error (form) | app/app/launch/actions.ts:90 | inline |

## Onboarding — `app/app/onboarding/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Merchant setup | eyebrow | app/app/onboarding/page.tsx:29 | inline |
| Tell us about your business | title | app/app/onboarding/page.tsx:30 | inline |
| Your business details are saved. Add your first venue to finish setting up. | description (missing_location) | app/app/onboarding/page.tsx:33 | inline |
| Add your business, find your first venue, and confirm the address to get started. | description (default) | app/app/onboarding/page.tsx:34 | inline |
| What happens next | eyebrow | app/app/onboarding/page.tsx:47 | inline |
| From sign-up to your first stamp | heading | app/app/onboarding/page.tsx:49 | inline |
| Save this form and we will walk you through the rest, one step at a time. | body | app/app/onboarding/page.tsx:51 | inline |
| Profile could not be saved. Check your details and try again. | error (form) | app/app/onboarding/actions.ts:20 | inline |
| Your session expired. Log in again. | error (form) | app/app/onboarding/actions.ts:67 | inline |
| Enter the business name. | validation | app/app/onboarding/actions.ts:87 | inline |
| Choose a business type. | validation | app/app/onboarding/actions.ts:88 | inline |
| merchant | slug fallback (not user-facing copy) | app/app/onboarding/actions.ts:102 | inline (internal) |

## Profile action — `app/app/profile/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Profile could not be saved. Check your details and try again. | error (form) | app/app/profile/actions.ts:14 | inline |
| Complete merchant onboarding first. | error (form) | app/app/profile/actions.ts:71 | inline |
| Enter the business name. | validation | app/app/profile/actions.ts:76 | inline |
| Choose a business type. | validation | app/app/profile/actions.ts:78 | inline |
| Enter a valid contact email. | validation | app/app/profile/actions.ts:80 | inline |
| Enter a valid phone number. | validation | app/app/profile/actions.ts:82 | inline |
| Profile saved. | success message | app/app/profile/actions.ts:128 | inline |

## QR (poster kit) — `app/app/qr/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Counter poster | eyebrow | app/app/qr/page.tsx:32 | inline |
| Venue QR | title | app/app/qr/page.tsx:33 | inline |
| Your permanent scan code and printable A4 posters. Share the link anywhere or print a layout for the till. | description | app/app/qr/page.tsx:34 | inline |
| Add at least 3 active mystery rewards before launching the QR. | error (redirect param) | app/app/qr/actions.ts:13 | inline |
| Unable to create QR | error (redirect param) | app/app/qr/actions.ts:14 | inline |
| Unable to update QR | error (redirect param) | app/app/qr/actions.ts:15 | inline |

## QR poster template render — `app/app/qr/poster/[template]/page.tsx` + not-found
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Counter poster | eyebrow (render error) | app/app/qr/poster/[template]/page.tsx:89 | inline |
| Poster could not be generated | title (render error) | app/app/qr/poster/[template]/page.tsx:90 | inline |
| The QR image failed to render just now. This is usually momentary — head back and reopen the poster. | description | app/app/qr/poster/[template]/page.tsx:91 | inline |
| QR render failed. | status banner title | app/app/qr/poster/[template]/page.tsx:94 | inline |
| If it keeps happening, check the venue QR is still live on the poster page. | status banner body | app/app/qr/poster/[template]/page.tsx:95 | inline |
| Back to QR | button | app/app/qr/poster/[template]/page.tsx:100 | inline |
| Poster not found | empty-state title (404) | app/app/qr/poster/[template]/not-found.tsx:16 | inline |
| This poster link is stale — the template or QR it points at does not exist any more. Open the Poster page to pick a fresh template. | empty-state description | app/app/qr/poster/[template]/not-found.tsx:17 | inline |
| Back to Poster | button | app/app/qr/poster/[template]/not-found.tsx:20 | inline |

## QR image route — `app/app/qr/image/[qrCodeId]/route.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| QR code not found | HTTP 404 body text | app/app/qr/image/[qrCodeId]/route.ts:32 | inline |

## Reward scan (collect) — `app/app/rewards/scan/[scanToken]/page.tsx` + not-found + actions
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward expired | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:71 | inline |
| This reward expired — ask the customer to re-scan the venue QR for a fresh code. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:72 | inline |
| Reward not matched | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:80 | inline |
| This reward belongs to another venue. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:81 | inline |
| Member and card details | sr-only heading | app/app/rewards/scan/[scanToken]/page.tsx:109 | inline |
| Member | detail label (dt) | app/app/rewards/scan/[scanToken]/page.tsx:113 | inline |
| Card | detail label (dt) | app/app/rewards/scan/[scanToken]/page.tsx:116 | inline |
| Reward collected | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:124 | inline |
| Reward marked collected.  | status banner body (collected prefix) | app/app/rewards/scan/[scanToken]/page.tsx:125 | inline |
| This reward is now closed. The member can scan the venue QR again when they are ready for their next stamp. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:126-127 | inline |
| Cannot collect this reward | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:130 | inline |
| This reward is not ready to collect. | status banner body (fallback) | app/app/rewards/scan/[scanToken]/page.tsx:131 | inline |
| Ready to collect | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:135 | inline |
| Check the reward against the order. Mark it collected when you have served it. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:136-137 | inline |
| Scan another reward | button | app/app/rewards/scan/[scanToken]/page.tsx:147 | inline |
| Back to dashboard | button | app/app/rewards/scan/[scanToken]/page.tsx:151 | inline |
| Reward collection | eyebrow | app/app/rewards/scan/[scanToken]/page.tsx:162 | inline |
| Check and collect reward | title | app/app/rewards/scan/[scanToken]/page.tsx:163 | inline |
| Confirm the member is at the counter before marking the reward collected. | description | app/app/rewards/scan/[scanToken]/page.tsx:164 | inline |
| Reward not found | empty-state title (404) | app/app/rewards/scan/[scanToken]/not-found.tsx:16 | inline |
| That scan code has gone cold — it may have already been collected or refreshed. Ask the customer to scan the venue QR again, or head back to activity. | empty-state description | app/app/rewards/scan/[scanToken]/not-found.tsx:17 | inline |
| Back to activity | button | app/app/rewards/scan/[scanToken]/not-found.tsx:20 | inline |
| Reward unavailable. | error (form) | app/app/rewards/scan/[scanToken]/actions.ts:25 | inline |

## Scan (scanner) — `app/app/scan/page.tsx` + loading
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan reward QR | metadata title | app/app/scan/page.tsx:6 | inline |
| Loading reward scanner | aria-label | app/app/scan/loading.tsx:18 | inline |

## Settings (redirect) — `app/app/settings/page.tsx`
_No copy — redirect only._

---

# Components — `components/merchant/**`

## Account tab bar — `components/merchant/account/account-tab-bar.tsx` + `account-tabs.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account sections | aria-label (nav) | components/merchant/account/account-tab-bar.tsx:11 | inline |
| Profile | tab label | components/merchant/account/account-tabs.ts:10 | inline |
| Billing | tab label | components/merchant/account/account-tabs.ts:11 | inline |

## Billing panel — `components/merchant/account/billing-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing details could not be loaded | status banner title | components/merchant/account/billing-panel.tsx:67 | inline |
| This is usually temporary. | status banner body | components/merchant/account/billing-panel.tsx:68 | inline |
| Try again | link | components/merchant/account/billing-panel.tsx:75 | inline |
| Step 5 of 5 · Billing | eyebrow | components/merchant/account/billing-panel.tsx:105,166 | inline |
| Your account is created | heading | components/merchant/account/billing-panel.tsx:107 | inline |
| Add a card through Stripe to activate your venue and start accepting stamps. | body | components/merchant/account/billing-panel.tsx:109-112 | inline |
| Free trial | plan row label | components/merchant/account/billing-panel.tsx:117,177 | inline |
| 30 days | plan row value | components/merchant/account/billing-panel.tsx:117,177 | inline |
| Then | plan row label | components/merchant/account/billing-panel.tsx:118,178 | inline |
| £29 a month | plan row value | components/merchant/account/billing-panel.tsx:118,178 | inline |
| Billed | plan row label | components/merchant/account/billing-panel.tsx:119,179 | inline |
| Per location | plan row value | components/merchant/account/billing-panel.tsx:119,179 | inline |
| Proceed to billing | button | components/merchant/account/billing-panel.tsx:125 | inline |
| Secure checkout via Stripe. Cancel anytime during the trial. | helper text | components/merchant/account/billing-panel.tsx:127 | inline |
| Manage billing in Account | link | components/merchant/account/billing-panel.tsx:134 | inline |
| once your venue is live. | body (suffix) | components/merchant/account/billing-panel.tsx:138 | inline |
| Your plan | section header eyebrow | components/merchant/account/billing-panel.tsx:166 | inline |
| Activate your venue | section header title (needsCard) | components/merchant/account/billing-panel.tsx:167 | inline |
| Growth Plan | section header title | components/merchant/account/billing-panel.tsx:167 | inline |
| Add a card through Stripe to activate your venue — the first 30 days are free. | section header description (needsCard) | components/merchant/account/billing-panel.tsx:170 | inline |
| Everything on this receipt updates by itself once your Stripe checkout is done. | section header description | components/merchant/account/billing-panel.tsx:171 | inline |
| Your current period ends {date}. | body (interpolated) | components/merchant/account/billing-panel.tsx:186 | inline |
| Your billing period will show here once checkout is done. | body | components/merchant/account/billing-panel.tsx:188 | inline |
| Start checkout | button | components/merchant/account/billing-panel.tsx:197 | inline |
| Open Stripe portal | button | components/merchant/account/billing-panel.tsx:215 | inline |
| Start checkout to add your card and activate the venue. | helper text (portal unavailable) | components/merchant/account/billing-panel.tsx:225 | inline |
| Manage your card and invoices in the Stripe portal. | helper text | components/merchant/account/billing-panel.tsx:226 | inline |
| Checkout completed | status banner title | components/merchant/account/billing-panel.tsx:263 | inline |
| Your billing status should update on this page within a few seconds. | status banner body | components/merchant/account/billing-panel.tsx:266-267 | inline |
| Local dev: keep the Stripe webhook listener running with `stripe listen --forward-to localhost:3000/api/stripe/webhook` and restart after setting STRIPE_WEBHOOK_SECRET so future renewals sync automatically. | dev-only note | components/merchant/account/billing-panel.tsx:271-277 | inline (dev/internal) |
| Checkout cancelled | status banner title | components/merchant/account/billing-panel.tsx:283 | inline |
| You can restart the Growth Plan checkout when you are ready. | status banner body | components/merchant/account/billing-panel.tsx:284 | inline |
| No Stripe customer yet | status banner title | components/merchant/account/billing-panel.tsx:288 | inline |
| Start checkout before opening the Stripe portal. | status banner body | components/merchant/account/billing-panel.tsx:289 | inline |

## Profile panel — `components/merchant/account/profile-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| What customers see | eyebrow | components/merchant/account/profile-panel.tsx:45 | inline |
| Add your venue address in Setup so customers can find you. | fallback body | components/merchant/account/profile-panel.tsx:51 | inline |
| Edit venue details | link | components/merchant/account/profile-panel.tsx:57 | inline |
| Address and GPS checks are managed in Setup. Business contact details saved here feed customer terms, billing setup, merchant notifications, and support; sign-in credentials stay separate. | body | components/merchant/account/profile-panel.tsx:70-72 | inline |

## Announcement compose — `components/merchant/announcements/announcement-compose.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Announcement | section header eyebrow | components/merchant/announcements/announcement-compose.tsx:123 | inline |
| Send a venue update | section header title | components/merchant/announcements/announcement-compose.tsx:124 | inline |
| Short member updates for today, tomorrow, or a quiet shift that needs regulars. | section header description | components/merchant/announcements/announcement-compose.tsx:125 | inline |
| Daily limit reached | status banner title | components/merchant/announcements/announcement-compose.tsx:134 | inline |
| You have sent {n} announcements today. You can send more tomorrow. | status banner body (interpolated) | components/merchant/announcements/announcement-compose.tsx:135-136 | inline |
| No members can receive this yet | empty-state title | components/merchant/announcements/announcement-compose.tsx:142 | inline |
| Members need push permission and venue marketing consent before announcements can go out. | empty-state description | components/merchant/announcements/announcement-compose.tsx:143 | inline |
| Announcement title | field label | components/merchant/announcements/announcement-compose.tsx:154 | inline |
| Kitchen open from noon | input placeholder | components/merchant/announcements/announcement-compose.tsx:169 | inline |
| Announcement body | field label | components/merchant/announcements/announcement-compose.tsx:176 | inline |
| Fresh pies, cask ale, and a few tables free for lunch. | textarea placeholder | components/merchant/announcements/announcement-compose.tsx:191 | inline |
| Sent only to members with push updates enabled for this venue. | helper text | components/merchant/announcements/announcement-compose.tsx:198 | inline |
| Sending… | button pending label | components/merchant/announcements/announcement-compose.tsx:210 | inline |
| Send announcement | button | components/merchant/announcements/announcement-compose.tsx:210 | inline |
| About {n} of your {n} members can receive this. | body (interpolated) | components/merchant/announcements/announcement-compose.tsx:228-230 | inline |
| Daily announcements {used}/{limit} | body (interpolated) | components/merchant/announcements/announcement-compose.tsx:232-240 | inline |
| Eligibility is based on membership, push subscription, and marketing consent. You can send up to {n} venue announcements per day. | helper text (interpolated) | components/merchant/announcements/announcement-compose.tsx:243-247 | inline |
| Announcement queued | status banner title (success) | components/merchant/announcements/announcement-compose.tsx:259 | inline |
| Eligible audience: {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:262-264 | inline |
| Queued for {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:265-268 | inline |
| Skipped: {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:269-272 | inline |
| {n} were skipped because this announcement was already queued for them. | status banner line | components/merchant/announcements/announcement-compose.tsx:274-277 | inline |
| member / members | pluralized noun | components/merchant/announcements/announcement-compose.tsx:350 | inline |

## Announcement form error copy — `lib/notifications/venue-announcement-form-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Daily limit reached | error title (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:11 | shared:venue-announcement-form-copy |
| Announcements can go out up to 2 a day. Try again tomorrow. | error body (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:12 | shared:venue-announcement-form-copy |
| Add a clearer title | error title (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:16 | shared:venue-announcement-form-copy |
| Use a title of at least 3 characters. | error body (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:17 | shared:venue-announcement-form-copy |
| Add a fuller message | error title (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:21 | shared:venue-announcement-form-copy |
| Use a message of at least 10 characters. | error body (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:22 | shared:venue-announcement-form-copy |
| Check the wording | error title (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:26 | shared:venue-announcement-form-copy |
| Keep it to a plain venue update without links, phone numbers, payment wording, or claims. | error body (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:27 | shared:venue-announcement-form-copy |
| Sign in again | error title (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:31 | shared:venue-announcement-form-copy |
| Sign in again before sending this announcement. | error body (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:32 | shared:venue-announcement-form-copy |
| Announcement not sent | error title (default) | lib/notifications/venue-announcement-form-copy.ts:38 | shared:venue-announcement-form-copy |
| We could not send this announcement. Try again in a moment. | error body (default) | lib/notifications/venue-announcement-form-copy.ts:39 | shared:venue-announcement-form-copy |

## Activity compact feed — `components/merchant/activity-compact-feed.tsx`
_No literal copy — renders row.badgeLabel / row.headline / row.primaryAction.label from lib/merchant/activity._

## Activity detail card — `components/merchant/activity-detail-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| at {timestampLabel} | inline time joiner | components/merchant/activity-detail-card.tsx:50 | inline |
| Just now | relative time | components/merchant/activity-detail-card.tsx:117 | inline |
| {n} min ago | relative time | components/merchant/activity-detail-card.tsx:120 | inline |
| {n} hr ago | relative time | components/merchant/activity-detail-card.tsx:124 | inline |
| Yesterday | relative time | components/merchant/activity-detail-card.tsx:127 | inline |
| {n} days ago | relative time | components/merchant/activity-detail-card.tsx:128 | inline |

## Activity detail feed — `components/merchant/activity-detail-feed.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| All | filter pill | components/merchant/activity-detail-feed.tsx:27 | inline |
| Joins | filter pill | components/merchant/activity-detail-feed.tsx:28 | inline |
| Stamps | filter pill | components/merchant/activity-detail-feed.tsx:29 | inline |
| Rewards | filter pill | components/merchant/activity-detail-feed.tsx:30 | inline |
| QR | filter pill | components/merchant/activity-detail-feed.tsx:31 | inline |
| Account | filter pill | components/merchant/activity-detail-feed.tsx:32 | inline |
| This week | eyebrow | components/merchant/activity-detail-feed.tsx:116 | inline |
| Stamps | stat strip label | components/merchant/activity-detail-feed.tsx:119 | inline |
| Joins | stat strip label | components/merchant/activity-detail-feed.tsx:120 | inline |
| Rewards | stat strip label | components/merchant/activity-detail-feed.tsx:121 | inline |
| QR | stat strip label | components/merchant/activity-detail-feed.tsx:122 | inline |
| Search activity | input placeholder + aria-label | components/merchant/activity-detail-feed.tsx:143,144 | inline |
| Filter activity by type | aria-label | components/merchant/activity-detail-feed.tsx:151 | inline |
| {n} shown from {m}. | status (aria-live, interpolated) | components/merchant/activity-detail-feed.tsx:177-178 | inline |
| No events in this filter | empty-state title | components/merchant/activity-detail-feed.tsx:184 | inline |
| Try another category or clear the search to see more of the loaded activity. | empty-state description | components/merchant/activity-detail-feed.tsx:185 | inline |
| {n} {event/events} loaded, more available. | footer count (interpolated) | components/merchant/activity-detail-feed.tsx:213-214 | inline |
| Loading… | load-more pending label | components/merchant/activity-detail-feed.tsx:273 | inline |
| Load more | load-more label | components/merchant/activity-detail-feed.tsx:273 | inline |

## Activity copy resolver — `lib/merchant/activity.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Join | badge label | lib/merchant/activity.ts:475 | inline |
| {name} joined | headline (interpolated) | lib/merchant/activity.ts:476 | inline |
| Joined via venue QR and accepted the loyalty programme. | summary | lib/merchant/activity.ts:477 | inline |
| Stamp requested | badge label | lib/merchant/activity.ts:499 | inline |
| {name} requested a stamp | headline | lib/merchant/activity.ts:500 | inline |
| The customer opened the stamp-confirm screen from the venue QR. | summary | lib/merchant/activity.ts:501-502 | inline |
| Stamp collected | badge label | lib/merchant/activity.ts:525 | inline |
| {name} collected {stampLabel} | headline | lib/merchant/activity.ts:526 | inline |
| Customer stamp was issued and a location anomaly was flagged. | summary (geo_flagged) | lib/merchant/activity.ts:528 | inline |
| Customer stamp was issued from the venue QR. | summary | lib/merchant/activity.ts:529 | inline |
| Reward unlocked | badge label | lib/merchant/activity.ts:569 | inline |
| {name} unlocked {rewardLabel} | headline | lib/merchant/activity.ts:570 | inline |
| {reward} is ready to redeem. | summary (interpolated) | lib/merchant/activity.ts:572 | inline |
| A reward became available after reaching the stamp target. | summary | lib/merchant/activity.ts:573 | inline |
| Reward redeemed | badge label | lib/merchant/activity.ts:601 | inline |
| {name} redeemed {rewardLabel} | headline | lib/merchant/activity.ts:602 | inline |
| {reward} was redeemed by the customer. | summary (interpolated) | lib/merchant/activity.ts:604 | inline |
| The customer redeemed a reward. | summary | lib/merchant/activity.ts:605 | inline |
| Birthday treat | badge label (isBirthday) | lib/merchant/activity.ts:641 | inline |
| Reward issued | badge label | lib/merchant/activity.ts:641 | inline |
| Birthday treat issued to {name} | headline (isBirthday) | lib/merchant/activity.ts:643 | inline |
| {rewardLabel} issued to {name} | headline | lib/merchant/activity.ts:644 | inline |
| An automatic birthday reward was issued to this member. | summary (isBirthday) | lib/merchant/activity.ts:646 | inline |
| A reward was issued to this member. | summary | lib/merchant/activity.ts:647 | inline |
| Reward sent | badge label | lib/merchant/activity.ts:663 | inline |
| Reward sent to {name} | headline | lib/merchant/activity.ts:664 | inline |
| {reward} was sent to this member. | summary (interpolated) | lib/merchant/activity.ts:666 | inline |
| A reward was sent to this member. | summary | lib/merchant/activity.ts:667 | inline |
| Invite sent | badge label | lib/merchant/activity.ts:685 | inline |
| Reward invite sent | headline | lib/merchant/activity.ts:686 | inline |
| A reward invite was sent to someone not yet on Nabaperks; it attaches when they join. | summary | lib/merchant/activity.ts:687-688 | inline |
| QR scanned | badge label | lib/merchant/activity.ts:704 | inline |
| {label} scanned the QR | headline | lib/merchant/activity.ts:706 | inline |
| Someone scanned the QR | headline (no label) | lib/merchant/activity.ts:707 | inline |
| The QR opened, but join was unavailable at that moment. | summary | lib/merchant/activity.ts:710 | inline |
| A customer opened the venue QR resolver. | summary | lib/merchant/activity.ts:711 | inline |
| QR downloaded | badge label | lib/merchant/activity.ts:744 | inline |
| {assetType} QR downloaded | headline | lib/merchant/activity.ts:746 | inline |
| QR asset downloaded | headline | lib/merchant/activity.ts:747 | inline |
| A printable or till-ready QR asset was saved. | summary | lib/merchant/activity.ts:748 | inline |
| QR created | badge label | lib/merchant/activity.ts:768 | inline |
| Venue QR created | headline | lib/merchant/activity.ts:769 | inline |
| A permanent join QR was created for this location. | summary | lib/merchant/activity.ts:770 | inline |
| QR enabled / QR disabled | badge label | lib/merchant/activity.ts:799 | inline |
| Venue QR enabled / Venue QR disabled | headline | lib/merchant/activity.ts:800 | inline |
| Customer scanning is open from the permanent venue QR. | summary (enabled) | lib/merchant/activity.ts:802 | inline |
| Customer scanning has been paused from the permanent venue QR. | summary (disabled) | lib/merchant/activity.ts:803 | inline |
| Card setup | badge label | lib/merchant/activity.ts:819,840 | inline |
| Loyalty card setup created | headline | lib/merchant/activity.ts:820 | inline |
| Your stamp card and reward rules were saved. | summary | lib/merchant/activity.ts:821 | inline |
| Loyalty card setup updated | headline | lib/merchant/activity.ts:841 | inline |
| Stamp target, reward copy, or card status changed. | summary | lib/merchant/activity.ts:842 | inline |
| Account | badge label | lib/merchant/activity.ts:861 | inline |
| Merchant account joined | headline | lib/merchant/activity.ts:862 | inline |
| Onboarding completed and the venue profile was saved. | summary | lib/merchant/activity.ts:863 | inline |
| Billing | badge label | lib/merchant/activity.ts:879,900 | inline |
| Growth Plan started | headline | lib/merchant/activity.ts:881 | inline |
| Stripe marked billing as active for this merchant. | summary | lib/merchant/activity.ts:882 | inline |
| Growth Plan cancelled | headline | lib/merchant/activity.ts:902 | inline |
| Stripe marked the Growth Plan subscription as cancelled. | summary | lib/merchant/activity.ts:903 | inline |
| Activity | badge label (default) | lib/merchant/activity.ts:921 | inline |
| Merchant activity event. | summary (default) | lib/merchant/activity.ts:923 | inline |
| Member | fallback customer name | lib/merchant/activity.ts:1227 | inline |
| stamp {n} / a stamp | stamp label | lib/merchant/activity.ts:1243,1250 | inline |
| a reward | reward label fallback | lib/merchant/activity.ts:1254 | inline |
| View member | primary action label | lib/merchant/activity.ts:1071 | inline |
| Open QR | primary action label | lib/merchant/activity.ts:1083 | inline |
| Open card setup | primary action label | lib/merchant/activity.ts:1090 | inline |
| Open billing | primary action label | lib/merchant/activity.ts:1097 | inline |
| Open account | primary action label | lib/merchant/activity.ts:1101 | inline |
| Open QR setup | secondary action label | lib/merchant/activity.ts:1116 | inline |
| Merchant account / Staff member / Automatic / Nabaperks support | actor detail values | lib/merchant/activity.ts:1264,1268,1276,1278 | inline |
| Staff / How / Marketing opt-in / Yes / No / Customer join / etc. | detail labels/values (internal, not rendered by client per toSlimActivityRow) | lib/merchant/activity.ts (various) | inline (internal) |
| Just now / {n} min ago / {n} hr ago / Yesterday / {n} days ago | relative time | lib/merchant/activity.ts:1320-1331 | inline |
| Today / Yesterday | date group label | lib/merchant/activity.ts:1341,1345 | inline |
| Stamp request and stamp issue are grouped into one visit. | threaded summary | lib/merchant/activity.ts:999 | inline |
| Claim opened / Approved | threaded detail labels | lib/merchant/activity.ts:1001-1002 | inline (internal) |

## Billing status copy — `components/merchant/billing-status.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing not started | notice title | components/merchant/billing-status.tsx:76 | inline |
| Start your subscription when you are ready to go live. You can set everything else up first. | notice description | components/merchant/billing-status.tsx:78 | inline |
| Start billing | action label | components/merchant/billing-status.tsx:82 | inline |
| Free trial active | notice title | components/merchant/billing-status.tsx:86 | inline |
| Your 30-day free trial is running, with everything switched on. | notice description | components/merchant/billing-status.tsx:88 | inline |
| View billing | action label | components/merchant/billing-status.tsx:92 | inline |
| Billing active | notice title | components/merchant/billing-status.tsx:96 | inline |
| Your subscription is active. Customers can join, collect stamps, and redeem rewards. | notice description | components/merchant/billing-status.tsx:98 | inline |
| Manage billing | action label | components/merchant/billing-status.tsx:102 | inline |
| Billing {status} | notice title (interpolated) | components/merchant/billing-status.tsx:106,117,128,142 | inline |
| A payment needs attention. Your card still works for now, but please sort billing soon. | notice description (past_due) | components/merchant/billing-status.tsx:108 | inline |
| Resolve billing | action label | components/merchant/billing-status.tsx:112 | inline |
| New stamps and rewards are paused until billing is restored. | notice description (cancelled/suspended) | components/merchant/billing-status.tsx:119,130 | inline |
| Restart billing | action label | components/merchant/billing-status.tsx:123 | inline |
| Restore access | action label | components/merchant/billing-status.tsx:134 | inline |
| We could not read your billing status just now. Refresh the page, or open billing to check. | notice description (fallback) | components/merchant/billing-status.tsx:144 | inline |
| Review billing | action label (fallback) | components/merchant/billing-status.tsx:147 | inline |

## Copy URL button — `components/merchant/copy-url-button.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Copy failed — copy it by hand | button (failed) | components/merchant/copy-url-button.tsx:30 | inline |
| Copied | button (copied) | components/merchant/copy-url-button.tsx:30 | inline |
| Copy URL | button | components/merchant/copy-url-button.tsx:30 | inline |
| Copy failed. Use the visible shareable URL instead. | sr-only status | components/merchant/copy-url-button.tsx:33 | inline |
| Shareable URL copied. | sr-only status | components/merchant/copy-url-button.tsx:35 | inline |

## Customer readback table — `components/merchant/customer-readback-table.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Member | table column header | components/merchant/customer-readback-table.tsx:208 | inline |
| Joined | table column header | components/merchant/customer-readback-table.tsx:242 | inline |
| Stamps | table column header | components/merchant/customer-readback-table.tsx:257 | inline |
| Last visit | table column header | components/merchant/customer-readback-table.tsx:272 | inline |
| Not yet | cell (no last visit) | components/merchant/customer-readback-table.tsx:282 | inline |
| Reward | table column header | components/merchant/customer-readback-table.tsx:287 | inline |
| Open scanner | button (mobile) | components/merchant/customer-readback-table.tsx:152 | inline |
| Send reward | button (mobile) | components/merchant/customer-readback-table.tsx:161 | inline |
| Joined: {label} | mobile card time | components/merchant/customer-readback-table.tsx:125 | inline |
| Last: {label} | mobile card time | components/merchant/customer-readback-table.tsx:131,135 | inline |
| Open scanner for {name}'s reward QR | aria-label | components/merchant/customer-readback-table.tsx:305 | inline |
| Scan | button | components/merchant/customer-readback-table.tsx:308 | inline |
| Send a reward to {name} | aria-label | components/merchant/customer-readback-table.tsx:322 | inline |
| Send | button | components/merchant/customer-readback-table.tsx:324 | inline |
| Loyalty members | aria-label (mobile list + table caption context) | components/merchant/customer-readback-table.tsx:185 | inline |
| Nothing on this page | empty-page title | components/merchant/customer-readback-table.tsx:470 | inline |
| Your {n} members end before page {p}. | empty-page body (interpolated) | components/merchant/customer-readback-table.tsx:472 | inline |
| Members | stat strip label | components/merchant/customer-readback-table.tsx:499 | inline |
| Ready | stat strip label | components/merchant/customer-readback-table.tsx:507 | inline |
| Quiet | stat strip label | components/merchant/customer-readback-table.tsx:508 | inline |
| Search members | input placeholder + aria-label | components/merchant/customer-readback-table.tsx:525,526 | inline |
| Filter members by reward status | aria-label | components/merchant/customer-readback-table.tsx:532 | inline |
| All / Ready / Active / Quiet | filter pill labels | components/merchant/customer-readback-table.tsx:537-540 | inline |
| Showing members {a}–{b} of {total}, newest first — search and filters cover this page only. Older members are on the later pages. | pagination note (interpolated) | components/merchant/customer-readback-table.tsx:550-552 | inline |
| {name} has a reward ready. Ask them to show their reward QR. | scan banner (interpolated) | components/merchant/customer-readback-table.tsx:561-562 | inline |
| Open scanner | button | components/merchant/customer-readback-table.tsx:569 | inline |
| No members match your filter | empty-filter title | components/merchant/customer-readback-table.tsx:578 | inline |
| Try a different status or clear the search. | empty-filter body | components/merchant/customer-readback-table.tsx:580 | inline |
| Your loyalty members and their stamp progress | table caption | components/merchant/customer-readback-table.tsx:604 | inline |
| Members pages | nav aria-label | components/merchant/customer-readback-table.tsx:667 | inline |
| Previous page | button | components/merchant/customer-readback-table.tsx:678,682 | inline |
| Page {p} of {t} · {total} members | pagination readback (interpolated) | components/merchant/customer-readback-table.tsx:685-686 | inline |
| Next page | button | components/merchant/customer-readback-table.tsx:695,699 | inline |
| Initials only · phones stay hashed · no marketing without a separate opt-in · exports live with the account owner | privacy note | components/merchant/customer-readback-table.tsx:713-715 | inline |

## Customer readback copy — `lib/merchant/customer-readback.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready | badge label | lib/merchant/customer-readback.ts:111 | inline |
| Reward waiting | badge label | lib/merchant/customer-readback.ts:115 | inline |
| New today | badge label | lib/merchant/customer-readback.ts:120 | inline |
| Gone quiet | badge label | lib/merchant/customer-readback.ts:124 | inline |
| Redeemed {date} | badge label (interpolated) | lib/merchant/customer-readback.ts:131 | inline |
| Collecting | badge label | lib/merchant/customer-readback.ts:134 | inline |
| Today | joined/last-visit label | lib/merchant/customer-readback.ts:168,181 | inline |
| Yesterday | joined/last-visit label | lib/merchant/customer-readback.ts:169,185 | inline |
| Not yet | last-visit label | lib/merchant/customer-readback.ts:177 | inline |
| Today {time} | last-visit label (interpolated) | lib/merchant/customer-readback.ts:183 | inline |

## Customer identity display — `lib/merchant/customer-identity-display.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email hidden | identifier fallback | lib/merchant/customer-identity-display.ts:23 | inline |
| Phone ending {digits} | identifier (interpolated) | lib/merchant/customer-identity-display.ts:15 | inline |
| Member | identifier fallback | lib/merchant/customer-identity-display.ts:15 | inline |

## Dashboard home streams — `components/merchant/dashboard-home-streams.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | KPI label | components/merchant/dashboard-home-streams.tsx:53 | inline |
| New (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:60 | inline |
| Stamps (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:66 | inline |
| Rewards (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:72 | inline |
| Last 14 days | section header eyebrow | components/merchant/dashboard-home-streams.tsx:91 | inline |
| How the week is going | section header title | components/merchant/dashboard-home-streams.tsx:92 | inline |
| Deltas compare this week with the seven days before; the lines trace the last fortnight. | section header description | components/merchant/dashboard-home-streams.tsx:93 | inline |
| Stamps vs joins | eyebrow | components/merchant/dashboard-home-streams.tsx:117 | inline |
| 2 weeks ago | trend chart start label | components/merchant/dashboard-home-streams.tsx:120 | inline |
| Today | trend chart end label | components/merchant/dashboard-home-streams.tsx:121 | inline |
| Daily stamps issued and new members over the last 14 days | trend chart aria-label | components/merchant/dashboard-home-streams.tsx:122 | inline |
| Stamps | trend series label | components/merchant/dashboard-home-streams.tsx:126 | inline |
| Joins | trend series label | components/merchant/dashboard-home-streams.tsx:131 | inline |
| Recent activity | section header title | components/merchant/dashboard-home-streams.tsx:156 | inline |
| View all | button | components/merchant/dashboard-home-streams.tsx:160 | inline |
| No activity yet | empty-state title | components/merchant/dashboard-home-streams.tsx:171 | inline |
| Activity will appear after members join, add stamps, redeem rewards, or download QR assets. | empty-state description | components/merchant/dashboard-home-streams.tsx:172 | inline |

## Dashboard next actions — `components/merchant/dashboard-next-actions.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Do next | section header title | components/merchant/dashboard-next-actions.tsx:27 | inline |
| {n} {reward/rewards} ready to redeem | next-action label (interpolated) | components/merchant/dashboard-next-actions.tsx:35 | inline |
| No rewards waiting, you're all caught up | next-action label | components/merchant/dashboard-next-actions.tsx:36 | inline |
| {n} {member/members} gone quiet | next-action label (interpolated) | components/merchant/dashboard-next-actions.tsx:43 | inline |
| Every member has visited recently | next-action label | components/merchant/dashboard-next-actions.tsx:44 | inline |
| Repeat members | progress track label | components/merchant/dashboard-next-actions.tsx:52 | inline |
_Note: this component is defined but not imported by any covered route (dashboard uses dashboard-home-streams). See scope notes._

## Dashboard QR card — `components/merchant/dashboard-qr-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| your venue | venue name fallback | components/merchant/dashboard-qr-card.tsx:24 | inline |
| Venue QR for {venueName} | QrFrame label (interpolated) | components/merchant/dashboard-qr-card.tsx:63 | inline |
| QR code for {venueName} | img alt (interpolated) | components/merchant/dashboard-qr-card.tsx:69 | inline |
| Counter QR | eyebrow | components/merchant/dashboard-qr-card.tsx:78,111 | inline |
| Show a customer, instantly | heading | components/merchant/dashboard-qr-card.tsx:80 | inline |
| One tap makes it full screen — customers scan to join and collect today's stamp. No app to download. | body | components/merchant/dashboard-qr-card.tsx:83-84 | inline |
| Paused — new customers can't join until you re-enable it under Poster. | body (inactive) | components/merchant/dashboard-qr-card.tsx:98-99 | inline |
| Activate your venue QR | heading (setup prompt) | components/merchant/dashboard-qr-card.tsx:114 | inline |
| Finish setup to create the permanent QR customers scan to join. Once it's live it shows up here for one-tap access. | body (setup prompt) | components/merchant/dashboard-qr-card.tsx:116-118 | inline |
| Go to QR setup | button | components/merchant/dashboard-qr-card.tsx:123 | inline |

## Launch readiness panel — `components/merchant/launch-readiness-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue / Card / Rewards / Venue QR / Billing | mobile rail labels | components/merchant/launch-readiness-panel.tsx:41-46 | inline |
| Venue / Card / Pool / QR / Bill | narrow mobile rail labels | components/merchant/launch-readiness-panel.tsx:49-55 | inline |
| Setup | section header eyebrow | components/merchant/launch-readiness-panel.tsx:122 | inline |
| Setup readiness | section header title | components/merchant/launch-readiness-panel.tsx:123 | inline |
| What's left before members can collect stamps. | section header description | components/merchant/launch-readiness-panel.tsx:124 | inline |
| {completed} of {total} complete | mono tag (interpolated) | components/merchant/launch-readiness-panel.tsx:127 | inline |
| Venue is live | reward seal label | components/merchant/launch-readiness-panel.tsx:136,144 | inline |
| You're live | eyebrow / text | components/merchant/launch-readiness-panel.tsx:139,145 | inline |
| Setup is complete. Customers can scan, join, and collect stamps. | body | components/merchant/launch-readiness-panel.tsx:140-141 | inline |
| Setup progress | eyebrow / progress-track label | components/merchant/launch-readiness-panel.tsx:153,229 | inline |
| Setup progress: {completed} of {total} | progress aria-label (interpolated) | components/merchant/launch-readiness-panel.tsx:161,273 | inline |
| Ready / Next up / To do | step status labels | components/merchant/launch-readiness-panel.tsx:204 | inline |
| {label}, {ready/to do} | link aria-label (interpolated) | components/merchant/launch-readiness-panel.tsx:216,329 | inline |
| Next up: {actionLabel}. | body (interpolated) | components/merchant/launch-readiness-panel.tsx:237 | inline |
| Run through the checklist before you print. | body | components/merchant/launch-readiness-panel.tsx:238 | inline |
| Open setup | button (fallback) | components/merchant/launch-readiness-panel.tsx:242 | inline |

## Launch readiness contract/core copy — `lib/merchant/launch-readiness-contract.ts`, `launch-readiness-core.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your card | setup step label | lib/merchant/launch-readiness-contract.ts:28 | inline |
| Your rewards | setup step label | lib/merchant/launch-readiness-contract.ts:29 | inline |
| Business & venue | setup step label | lib/merchant/launch-readiness-contract.ts:30 | inline |
| Venue QR | setup step label | lib/merchant/launch-readiness-contract.ts:31 | inline |
| Billing | setup step label | lib/merchant/launch-readiness-contract.ts:32 | inline |
| Add your business profile, first venue, and customer-facing address. | step description (venue) | lib/merchant/launch-readiness-contract.ts:39-40 | inline |
| Set the visit target and the mystery reward card customers collect. | step description (card) | lib/merchant/launch-readiness-contract.ts:45-46 | inline |
| Add at least three live rewards so every full card has something to reveal. | step description (rewards) | lib/merchant/launch-readiness-contract.ts:51-52 | inline |
| Review and share the permanent venue QR customers use to collect stamps. | step description (qr) | lib/merchant/launch-readiness-contract.ts:57-58 | inline |
| Add a billing card to activate the venue after the free trial starts. | step description (billing) | lib/merchant/launch-readiness-contract.ts:63-64 | inline |
| Save venue | step action label | lib/merchant/launch-readiness-core.ts:99 | inline |
| Review card / Build card | step action label | lib/merchant/launch-readiness-core.ts:203 | inline |
| Add rewards | step action label | lib/merchant/launch-readiness-core.ts:115 | inline |
| Open venue QR / Create your QR | step action label | lib/merchant/launch-readiness-core.ts:123 | inline |
| View billing / Add a card to activate | billing action label | lib/merchant/launch-readiness-core.ts:164 | inline |
| the next step / billing / your venue QR | rewards continue label | lib/merchant/launch-readiness-core.ts:331,336,340 | inline |

## Launch — advanced GPS checks — `components/merchant/launch/advanced-gps-checks.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Advanced GPS checks | disclosure label | components/merchant/launch/advanced-gps-checks.tsx:51 | inline |
| Off by default. When on, a stamp from outside the radius still goes through — it is only flagged for you to review later. | body | components/merchant/launch/advanced-gps-checks.tsx:54-56 | inline |
| Use GPS anomaly checks | toggle label | components/merchant/launch/advanced-gps-checks.tsx:59 | inline |
| Radius metres | field label | components/merchant/launch/advanced-gps-checks.tsx:70 | inline |
| 100m suits most small, single-site venues. Set anything from 25m to 1000m. | helper text | components/merchant/launch/advanced-gps-checks.tsx:79-80 | inline |
| Drag the pin to your real entrance — the soft GPS check measures from this exact spot, not the postcode centre. | helper text | components/merchant/launch/advanced-gps-checks.tsx:91-92 | inline |
| Geocoded to {lat}, {lng}. | body (interpolated) | components/merchant/launch/advanced-gps-checks.tsx:98 | inline |

## Launch — birthday panel + form — `components/merchant/launch/birthday-panel.tsx`, `birthday-reward-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Optional | eyebrow | components/merchant/launch/birthday-panel.tsx:24 | inline |
| Birthday treat | title | components/merchant/launch/birthday-panel.tsx:25 | inline |
| Automatically issue a reward during each member's birthday month. It redeems like any other reward and expires at month end. | description | components/merchant/launch/birthday-panel.tsx:26 | inline |
| Give a birthday treat | toggle label | components/merchant/launch/birthday-reward-form.tsx:41 | inline |
| Members with a saved birthday get this reward automatically during their birthday month. | toggle hint | components/merchant/launch/birthday-reward-form.tsx:42 | inline |
| Reward name | field label | components/merchant/launch/birthday-reward-form.tsx:52 | inline |
| What the member sees, e.g. "Birthday drink". | field hint | components/merchant/launch/birthday-reward-form.tsx:53 | inline |
| Reward terms | field label | components/merchant/launch/birthday-reward-form.tsx:61 | inline |
| 12–500 characters. Anything the member should know before they redeem. | field hint | components/merchant/launch/birthday-reward-form.tsx:62 | inline |
| Saving… | submit pending label | components/merchant/launch/birthday-reward-form.tsx:82 | inline |
| Save birthday reward | submit button | components/merchant/launch/birthday-reward-form.tsx:83 | inline |

## Launch — card panel — `components/merchant/launch/card-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Finish onboarding first | title (no location) | components/merchant/launch/card-panel.tsx:39 | inline |
| Add your venue before you build your loyalty card. | description | components/merchant/launch/card-panel.tsx:40 | inline |
| Mystery Visit Card | default card name | components/merchant/launch/card-panel.tsx:57 | inline |
| Mystery card saved. | status banner title | components/merchant/launch/card-panel.tsx:85 | inline |
| Your visit-card settings are ready for member previews. | status banner body | components/merchant/launch/card-panel.tsx:86 | inline |
| your rewards | LaunchSaveNextAction nextLabel | components/merchant/launch/card-panel.tsx:90 | inline |

## Launch — customer card preview — `components/merchant/launch/customer-card-preview.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery Visit Card | default card name | components/merchant/launch/customer-card-preview.tsx:47 | inline |
| Preview · {n} visits | disclosure label (interpolated) | components/merchant/launch/customer-card-preview.tsx:64 | inline |
| Member preview | eyebrow | components/merchant/launch/customer-card-preview.tsx:77 | inline |
| The live card members see while collecting stamps — updates as you edit the form. | body | components/merchant/launch/customer-card-preview.tsx:78-80 | inline |
| Your card is inactive. Members cannot collect new stamps until you turn it back on. | body (inactive) | components/merchant/launch/customer-card-preview.tsx:110-112 | inline |
| Something's under there. | reward name (preview) | components/merchant/launch/customer-card-preview.tsx:126 | inline |
| Mystery reward stays sealed until the final stamp. | reward description (preview) | components/merchant/launch/customer-card-preview.tsx:127 | inline |
| For you only | eyebrow | components/merchant/launch/customer-card-preview.tsx:136 | inline |
| Active — accepting stamps | mono tag | components/merchant/launch/customer-card-preview.tsx:139 | inline |
| Inactive — no new stamps | mono tag | components/merchant/launch/customer-card-preview.tsx:140 | inline |
| {n} active pool reward(s). Need 3 before launch. | body (interpolated) | components/merchant/launch/customer-card-preview.tsx:143-144 | inline |
| Merchant launch status | aria-label | components/merchant/launch/customer-card-preview.tsx:133 | inline |

## Launch — disclosure — `components/merchant/launch/disclosure.tsx`
_No literal copy — label passed by callers._

## Launch — billing CTA — `components/merchant/launch/launch-billing-cta.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your account is created. | status banner title | components/merchant/launch/launch-billing-cta.tsx:16 | inline |
| Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/launch-billing-cta.tsx:17 | inline |
| Proceed to billing | button | components/merchant/launch/launch-billing-cta.tsx:25 | inline |

## Launch — tab auto-advance — `components/merchant/launch/launch-tab-auto-advance.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| {blockedReason} | body (passed in) | components/merchant/launch/launch-tab-auto-advance.tsx:50 | inline |
| Saved. Continue when you are ready, or stay here to review. | body | components/merchant/launch/launch-tab-auto-advance.tsx:52-53 | inline |
| Continue to {nextLabel} | button (default) | components/merchant/launch/launch-tab-auto-advance.tsx:60 | inline |
| Stay on this step | button | components/merchant/launch/launch-tab-auto-advance.tsx:66 | inline |

## Launch — QR error banner — `components/merchant/launch/qr-error-banner.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Unable to update QR. Check the QR status and try again. | resolved error body | components/merchant/launch/qr-error-banner.tsx:17 | inline |
| Unable to create QR. Check your card and reward setup, then try again. | resolved error body | components/merchant/launch/qr-error-banner.tsx:18 | inline |
| QR action failed. | status banner title | components/merchant/launch/qr-error-banner.tsx:21 | inline |

## Launch — QR panel (empty/status states) — `components/merchant/launch/qr-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | eyebrow | components/merchant/launch/qr-panel.tsx:54,75 | inline |
| Build your card first | title | components/merchant/launch/qr-panel.tsx:55 | inline |
| Nabaperks needs one active mystery visit card before it can create your permanent venue QR. | description | components/merchant/launch/qr-panel.tsx:56-57 | inline |
| Go to card builder | button | components/merchant/launch/qr-panel.tsx:60,82 | inline |
| Your QR is not live yet | title | components/merchant/launch/qr-panel.tsx:76 | inline |
| Create the permanent venue QR once venue, card, and rewards are ready. Billing is the final activation step. | description | components/merchant/launch/qr-panel.tsx:77-78 | inline |
| Add 3 rewards before launch. | status banner title | components/merchant/launch/qr-panel.tsx:82 | inline |
| The QR stays blocked until at least 3 active mystery rewards are in the pool. | status banner body | components/merchant/launch/qr-panel.tsx:83-84 | inline |
| Add or activate a reward | link | components/merchant/launch/qr-panel.tsx:88 | inline |
| Creating QR… | submit pending label | components/merchant/launch/qr-panel.tsx:98 | inline |
| Create QR | submit button | components/merchant/launch/qr-panel.tsx:99 | inline |
| Finish setup to go live. | status banner title | components/merchant/launch/qr-panel.tsx:103 | inline |
| Next up: {actionLabel}. | status banner body (interpolated) | components/merchant/launch/qr-panel.tsx:104 | inline |
| Continue setup | link | components/merchant/launch/qr-panel.tsx:109 | inline |
| QR code created. | status message | components/merchant/launch/qr-panel.tsx:145 | inline |
| QR code enabled. | status message | components/merchant/launch/qr-panel.tsx:147 | inline |
| QR code disabled. | status message | components/merchant/launch/qr-panel.tsx:149 | inline |
| Your venue QR is live. | status message | components/merchant/launch/qr-panel.tsx:151 | inline |
| Your account is created. Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/qr-panel.tsx:160 | inline |
| The permanent resolver and share URL are ready below. | status banner body | components/merchant/launch/qr-panel.tsx:161 | inline |
| billing | LaunchSaveNextAction nextLabel | components/merchant/launch/qr-panel.tsx:166 | inline |
| Proceed to billing | LaunchSaveNextAction primaryLabel | components/merchant/launch/qr-panel.tsx:167 | inline |

## Launch — QR panel live — `components/merchant/launch/qr-panel-live.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | eyebrow | components/merchant/launch/qr-panel-live.tsx:73 | inline |
| Your permanent counter code. Customers scan once to join, collect today's stamp, and unlock a surprise reward. | body | components/merchant/launch/qr-panel-live.tsx:77-79 | inline |
| Venue QR code | section aria-label | components/merchant/launch/qr-panel-live.tsx:87 | inline |
| Scanner-safe QR code for {activeCardName} | QrFrame label (interpolated) | components/merchant/launch/qr-panel-live.tsx:91 | inline |
| QR code for {activeCardName} | img alt (interpolated) | components/merchant/launch/qr-panel-live.tsx:97 | inline |
| Scan once yourself before the first customer | caption | components/merchant/launch/qr-panel-live.tsx:104 | inline |
| Add your venue address before print. | status banner title | components/merchant/launch/qr-panel-live.tsx:111 | inline |
| Stamps need the right location. | status banner body | components/merchant/launch/qr-panel-live.tsx:112 | inline |
| Complete venue step | link | components/merchant/launch/qr-panel-live.tsx:116 | inline |
| Share the link | launch step title | components/merchant/launch/qr-panel-live.tsx:126 | inline |
| Drop this URL anywhere you already talk about loyalty — socials, email footers, or your website. | launch step description | components/merchant/launch/qr-panel-live.tsx:127 | inline |
| Permanent venue link | eyebrow | components/merchant/launch/qr-panel-live.tsx:132 | inline |
| Open link | button | components/merchant/launch/qr-panel-live.tsx:143 | inline |
| Print a counter poster | launch step title | components/merchant/launch/qr-panel-live.tsx:157 | inline |
| Pick a layout, open the A4 sheet, and print at 100% scale — no fit-to-page. | launch step description | components/merchant/launch/qr-panel-live.tsx:158 | inline |
| Open A4 | link text | components/merchant/launch/qr-panel-live.tsx:202 | inline |
| How customers use this QR | disclosure label | components/merchant/launch/qr-panel-live.tsx:216 | inline |
| New customers scan and join on their phone — no app download. | list item | components/merchant/launch/qr-panel-live.tsx:218 | inline |
| Returning members scan the same code and tap to collect today's stamp. | list item | components/merchant/launch/qr-panel-live.tsx:220-221 | inline |
| On the final visit the reward unseals, redeemable from the next business day. | list item | components/merchant/launch/qr-panel-live.tsx:224-225 | inline |
| Manage | section header eyebrow | components/merchant/launch/qr-panel-live.tsx:232 | inline |
| Pause new scans | section header title | components/merchant/launch/qr-panel-live.tsx:233 | inline |
| Disable the QR if you need to stop new customers joining. Existing members keep their cards. | section header description | components/merchant/launch/qr-panel-live.tsx:234 | inline |
| Disabling… / Enabling… | submit pending label | components/merchant/launch/qr-panel-live.tsx:248 | inline |
| Disable QR / Enable QR | submit button | components/merchant/launch/qr-panel-live.tsx:250 | inline |
| Step {step} | launch step eyebrow (interpolated) | components/merchant/launch/qr-panel-live.tsx:277 | inline |
| Live · accepting scans | mono tag (active) | components/merchant/launch/qr-panel-live.tsx:293 | inline |
| Disabled · no new entry | mono tag (inactive) | components/merchant/launch/qr-panel-live.tsx:300 | inline |

## Launch — rewards panel (status states) — `components/merchant/launch/rewards-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Finish onboarding first | title (no location) | components/merchant/launch/rewards-panel.tsx:63 | inline |
| Add your venue before you build your reward pool. | description | components/merchant/launch/rewards-panel.tsx:64 | inline |
| Step 3 · Rewards | eyebrow (no card) | components/merchant/launch/rewards-panel.tsx:77 | inline |
| Build your card first | title (no card) | components/merchant/launch/rewards-panel.tsx:78 | inline |
| The reward pool is tied to a saved visit card. Create the card, then come back here to load at least 3 active mystery rewards. | description | components/merchant/launch/rewards-panel.tsx:79 | inline |
| Go to card builder | button | components/merchant/launch/rewards-panel.tsx:82 | inline |
| Birthday reward saved. | status banner title | components/merchant/launch/rewards-panel.tsx:151 | inline |
| Members with a saved birthday get it automatically during their birthday month. | status banner body | components/merchant/launch/rewards-panel.tsx:152-153 | inline |
| Your account is created. | status banner title | components/merchant/launch/rewards-panel.tsx:159 | inline |
| Starter rewards loaded. | status banner title | components/merchant/launch/rewards-panel.tsx:161 | inline |
| Reward saved. | status banner title | components/merchant/launch/rewards-panel.tsx:162 | inline |
| {n} of 3 active rewards | reused copy fragment (interpolated) | components/merchant/launch/rewards-panel.tsx:164 | inline |
| Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/rewards-panel.tsx:169 | inline |
| Your venue QR is live. Open it to copy or test the share link. | status banner body | components/merchant/launch/rewards-panel.tsx:171 | inline |
| Your venue QR is active again. | status banner body | components/merchant/launch/rewards-panel.tsx:173 | inline |
| Three default rewards are active and saved. Create your QR once venue and card are ready. | status banner body | components/merchant/launch/rewards-panel.tsx:176 | inline |
| Launch eligibility has been refreshed with your latest reward changes. | status banner body | components/merchant/launch/rewards-panel.tsx:177 | inline |
| {n} of 3 active rewards are ready. Finish the reward pool before setup can complete. | status banner body (interpolated) | components/merchant/launch/rewards-panel.tsx:178 | inline |
| {n} of 3 active rewards. Add or activate one more reward before continuing. | blocked reason (interpolated) | components/merchant/launch/rewards-panel.tsx:190 | inline |
| Reward update failed. | status banner title | components/merchant/launch/rewards-panel.tsx:202 | inline |
| Unable to update reward. Check the reward and try again. | status banner body | components/merchant/launch/rewards-panel.tsx:203 | inline |
| Your reward pool is ready. | status banner title | components/merchant/launch/rewards-panel.tsx:210 | inline |
| Each reward is already saved. Create your QR once venue, card, and rewards are complete — billing is the final activation step. | status banner body | components/merchant/launch/rewards-panel.tsx:211-212 | inline |
| billing / the next step | continueLabel fallback | components/merchant/launch/rewards-panel.tsx:107-108 | inline |

## Launch — venue panel — `components/merchant/launch/venue-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Main venue | default venue name | components/merchant/launch/venue-panel.tsx:30 | inline |

## Launch — venue location form — `components/merchant/launch/venue-location-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Step 1 · Location | eyebrow | components/merchant/launch/venue-location-form.tsx:126 | inline |
| Where do scans happen? | title | components/merchant/launch/venue-location-form.tsx:127 | inline |
| Your printed QR never changes. GPS is an optional soft check. It never blocks a member's stamp, it only flags an odd one for review. | description | components/merchant/launch/venue-location-form.tsx:128-129 | inline |
| Venue location saved. | status banner title | components/merchant/launch/venue-location-form.tsx:133 | inline |
| Your QR and stamp checks now use this address. | status banner body | components/merchant/launch/venue-location-form.tsx:134 | inline |
| your card | LaunchSaveNextAction nextLabel | components/merchant/launch/venue-location-form.tsx:137 | inline |
| Venue name | field label | components/merchant/launch/venue-location-form.tsx:169 | inline |
| Saving location… | submit pending label | components/merchant/launch/venue-location-form.tsx:206 | inline |
| Save venue address | submit button | components/merchant/launch/venue-location-form.tsx:207 | inline |

## Launch — venue pin map — `components/merchant/launch/venue-pin-map.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| © OpenStreetMap contributors | map attribution (HTML) | components/merchant/launch/venue-pin-map.tsx:82-83 | inline |
| Drag the pin to your venue entrance for the soft GPS check | aria-label (role=application) | components/merchant/launch/venue-pin-map.tsx:150 | inline |

## Launch — venue place autocomplete — `components/merchant/launch/venue-place-autocomplete.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Search for your venue | injected input placeholder | components/merchant/launch/venue-place-autocomplete.tsx:247 | inline |
| Find your venue | label | components/merchant/launch/venue-place-autocomplete.tsx:280 | inline |
| Loading venue search… | status text | components/merchant/launch/venue-place-autocomplete.tsx:293 | inline |
| Search Google for your venue, or enter the address below. | helper text | components/merchant/launch/venue-place-autocomplete.tsx:298 | inline |
| Venue search is unavailable right now — enter the address below. | fallback text | components/merchant/launch/venue-place-autocomplete.tsx:306 | inline |
| Dev note: Google blocked this origin. In Google Cloud Console, add http://localhost:3000/* and http://localhost/* to the Maps browser key referrers (do not use :* port wildcards). | dev-only note | components/merchant/launch/venue-place-autocomplete.tsx:310-313 | inline (dev/internal) |

## Loading skeletons — `components/merchant/loading-skeletons.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading dashboard metrics | aria-label | components/merchant/loading-skeletons.tsx:66 | inline |
| Loading activity | aria-label | components/merchant/loading-skeletons.tsx:149 | inline |
| Loading loyalty members | aria-label | components/merchant/loading-skeletons.tsx:222 | inline |
| Loading venue QR | aria-label | components/merchant/loading-skeletons.tsx:322 | inline |
| Loading reward pool | aria-label | components/merchant/loading-skeletons.tsx:351 | inline |
| Loading setup form | aria-label | components/merchant/loading-skeletons.tsx:391,416 | inline |
| Loading profile | aria-label | components/merchant/loading-skeletons.tsx:438 | inline |
| Loading billing | aria-label | components/merchant/loading-skeletons.tsx:465 | inline |
| Loading reward | aria-label | components/merchant/loading-skeletons.tsx:507 | inline |

## Loyalty card form — `components/merchant/loyalty-card-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your card | section head title | components/merchant/loyalty-card-form.tsx:138 | inline |
| One active card for {locationName}. The reward reveals after the final qualifying visit. | section head description (interpolated) | components/merchant/loyalty-card-form.tsx:139 | inline |
| Step 1 | section head step | components/merchant/loyalty-card-form.tsx:141 | inline |
| Card name | field label | components/merchant/loyalty-card-form.tsx:146 | inline |
| Visits to reveal | eyebrow + stepper label | components/merchant/loyalty-card-form.tsx:155,157 | inline |
| Choose {min}–{max} visits. Stamps needed before the reward unseals. | cadence hint (interpolated) | components/merchant/loyalty-card-form.tsx:122 | inline |
| Visit cadence presets | aria-label | components/merchant/loyalty-card-form.tsx:165 | inline |
| {n} visits | preset detail (interpolated) | components/merchant/loyalty-card-form.tsx:191 | inline |
| Reward terms | field label | components/merchant/loyalty-card-form.tsx:210,601 | inline |
| Shown on the member card. The suggested copy updates when you change visits, until you edit this field. | field hint | components/merchant/loyalty-card-form.tsx:215 | inline |
| Card is active | toggle label | components/merchant/loyalty-card-form.tsx:220 | inline |
| Members can collect stamps on this card. | toggle hint | components/merchant/loyalty-card-form.tsx:221 | inline |
| Saving... | submit pending label | components/merchant/loyalty-card-form.tsx:235 | inline |
| Save card / Create card | submit button | components/merchant/loyalty-card-form.tsx:235 | inline |
| Reward pool | heading | components/merchant/loyalty-card-form.tsx:291 | inline |
| The surprise is drawn from this pool. At least 3 must be active on {cardName} before you can launch. | body (interpolated) | components/merchant/loyalty-card-form.tsx:293-295 | inline |
| {n} active · ready | mono tag (ready) | components/merchant/loyalty-card-form.tsx:301 | inline |
| {n} / 3 active | mono tag | components/merchant/loyalty-card-form.tsx:302 | inline |
| Each reward saves when you add or edit it. Continue below when you are happy with the pool. | body (ready) | components/merchant/loyalty-card-form.tsx:310-311 | inline |
| Activate {n} more reward(s) to unlock launch. | body (interpolated) | components/merchant/loyalty-card-form.tsx:314-315 | inline |
| Reward ideas | eyebrow | components/merchant/loyalty-card-form.tsx:322 | inline |
| No rewards in the pool yet | empty-state title | components/merchant/loyalty-card-form.tsx:345 | inline |
| Add at least 3 active mystery rewards so the final stamp can reveal a prize. | empty-state description | components/merchant/loyalty-card-form.tsx:347 | inline |
| Add a reward | button | components/merchant/loyalty-card-form.tsx:389 | inline |
| Proceed to billing | continue button (billing) | components/merchant/loyalty-card-form.tsx:396 | inline |
| Continue to {continueLabel} | continue button | components/merchant/loyalty-card-form.tsx:398 | inline |
| your venue QR | default continueLabel | components/merchant/loyalty-card-form.tsx:256 | inline |
| Untitled reward | reward name fallback | components/merchant/loyalty-card-form.tsx:439 | inline |
| · w{weight} | reward weight tag (interpolated) | components/merchant/loyalty-card-form.tsx:462 | inline |
| Edit {rewardName} | aria-label | components/merchant/loyalty-card-form.tsx:475 | inline |
| reward | reward label fallback | components/merchant/loyalty-card-form.tsx:499 | inline |
| Deactivate / Activate {rewardLabel} | switch aria-label | components/merchant/loyalty-card-form.tsx:527 | inline |
| Active / Off | switch text | components/merchant/loyalty-card-form.tsx:543 | inline |
| New reward / Edit reward | eyebrow | components/merchant/loyalty-card-form.tsx:580 | inline |
| Reward name | field label | components/merchant/loyalty-card-form.tsx:591 | inline |
| e.g. Free pastry with any coffee | input placeholder | components/merchant/loyalty-card-form.tsx:593 | inline |
| What the member gets, and any conditions. | textarea placeholder | components/merchant/loyalty-card-form.tsx:603 | inline |
| Active in the pool | toggle label | components/merchant/loyalty-card-form.tsx:610 | inline |
| Counts toward the 3 needed to launch. | toggle hint | components/merchant/loyalty-card-form.tsx:611 | inline |
| Weighting | disclosure label | components/merchant/loyalty-card-form.tsx:616 | inline |
| Defaults are fine to launch. A higher weight is drawn more often. | body | components/merchant/loyalty-card-form.tsx:617-618 | inline |
| Weight | field label | components/merchant/loyalty-card-form.tsx:622 | inline |
| Saving... | submit pending label | components/merchant/loyalty-card-form.tsx:640 | inline |
| Add reward / Save reward | submit button | components/merchant/loyalty-card-form.tsx:640 | inline |
| Cancel | button | components/merchant/loyalty-card-form.tsx:644 | inline |
| Delete | button | components/merchant/loyalty-card-form.tsx:680 | inline |
| Confirm delete | button | components/merchant/loyalty-card-form.tsx:694 | inline |
| Keep it | button | components/merchant/loyalty-card-form.tsx:702 | inline |
| Fewer visits / More visits | stepper aria-label | components/merchant/loyalty-card-form.tsx:783,798 | inline |

## Loyalty card copy — `lib/merchant/loyalty-card-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day. | legacy default reward terms | lib/merchant/loyalty-card-copy.ts:7-8 | shared:loyalty-card-copy |
| Collect {n} visit stamps to unlock a surprise reward. Redeem from the next UK business day. | default reward terms (interpolated) | lib/merchant/loyalty-card-copy.ts:20 | shared:loyalty-card-copy |

## Reward presets — `lib/merchant/reward-presets.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Regulars' pint | preset reward name | lib/merchant/reward-presets.ts:26 | shared:reward-presets |
| One house pint, small wine, or soft drink for the member. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:27-28 | shared:reward-presets |
| Good for wet-led regulars. | preset description | lib/merchant/reward-presets.ts:29 | shared:reward-presets |
| Free starter | preset reward name | lib/merchant/reward-presets.ts:32 | shared:reward-presets |
| One starter up to GBP 8 with any main meal. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:33-34 | shared:reward-presets |
| Works for food-led visits. | preset description | lib/merchant/reward-presets.ts:35 | shared:reward-presets |
| Dessert on the house | preset reward name | lib/merchant/reward-presets.ts:38 | shared:reward-presets |
| One dessert from the main menu with any paid main. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:39-40 | shared:reward-presets |
| Useful after evening meals. | preset description | lib/merchant/reward-presets.ts:41 | shared:reward-presets |
| Coffee after lunch | preset reward name | lib/merchant/reward-presets.ts:44 | shared:reward-presets |
| One tea, coffee, or soft drink after a paid lunch. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:45-46 | shared:reward-presets |
| Fits lunch and daytime trade. | preset description | lib/merchant/reward-presets.ts:47 | shared:reward-presets |
| Kids' meal with adult main | preset reward name | lib/merchant/reward-presets.ts:50 | shared:reward-presets |
| One kids' meal with a paid adult main course. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:51-52 | shared:reward-presets |
| A family-table reward. | preset description | lib/merchant/reward-presets.ts:53 | shared:reward-presets |
| Sunday roast upgrade | preset reward name | lib/merchant/reward-presets.ts:56 | shared:reward-presets |
| One roast upgrade or extra side with a Sunday main. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:57-58 | shared:reward-presets |
| A Sunday-led nudge. | preset description | lib/merchant/reward-presets.ts:59 | shared:reward-presets |
| 10% off the next bill | preset reward name | lib/merchant/reward-presets.ts:62 | shared:reward-presets |
| Ten percent off food on one visit, excluding drinks. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:63-64 | shared:reward-presets |
| Simple, familiar value. | preset description | lib/merchant/reward-presets.ts:65 | shared:reward-presets |
| Free item | generic preset reward name | lib/merchant/reward-presets.ts:73 | shared:reward-presets |
| One eligible item from the standard menu or service list. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:74-75 | shared:reward-presets |
| A simple reward any local business can tune. | generic preset description | lib/merchant/reward-presets.ts:76 | shared:reward-presets |
| Member upgrade | generic preset reward name | lib/merchant/reward-presets.ts:79 | shared:reward-presets |
| One complimentary upgrade on an eligible purchase. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:80-81 | shared:reward-presets |
| Good when an upsell has low fulfilment risk. | generic preset description | lib/merchant/reward-presets.ts:82 | shared:reward-presets |
| 10% off | generic preset reward name | lib/merchant/reward-presets.ts:85 | shared:reward-presets |
| Ten percent off one eligible purchase, excluding gift cards and third-party fees. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:86-87 | shared:reward-presets |
| Familiar value without naming a venue type. | generic preset description | lib/merchant/reward-presets.ts:88 | shared:reward-presets |
| Member perk | generic preset reward name | lib/merchant/reward-presets.ts:91 | shared:reward-presets |
| One member-only perk chosen by the business team. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:92-93 | shared:reward-presets |
| A flexible placeholder for teams still deciding. | generic preset description | lib/merchant/reward-presets.ts:94 | shared:reward-presets |
| Lunch-trade card | cadence preset label | lib/merchant/reward-presets.ts:105 | shared:reward-presets |
| Pick 3 for quick daytime repeat visits. | cadence preset description | lib/merchant/reward-presets.ts:107 | shared:reward-presets |
| Food-led card | cadence preset label | lib/merchant/reward-presets.ts:110 | shared:reward-presets |
| Works for meals and planned visits. | cadence preset description | lib/merchant/reward-presets.ts:112 | shared:reward-presets |
| Wet-led card | cadence preset label | lib/merchant/reward-presets.ts:115 | shared:reward-presets |
| Pick 6 so a weekly regular unlocks roughly monthly. | cadence preset description | lib/merchant/reward-presets.ts:117 | shared:reward-presets |

## Default reward pool — `lib/merchant/default-reward-pool.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Free pint of your choice | seed reward name | lib/merchant/default-reward-pool.ts:12 | shared:default-reward-pool |
| Choose any pint from our range on the house. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:13-14 | shared:default-reward-pool |
| 10% off next visit | seed reward name | lib/merchant/default-reward-pool.ts:20 | shared:default-reward-pool |
| Get 10% off your entire bill on your next visit. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:21-22 | shared:default-reward-pool |
| Free dessert of your choice | seed reward name | lib/merchant/default-reward-pool.ts:28 | shared:default-reward-pool |
| Choose any dessert from our menu on the house. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:29-30 | shared:default-reward-pool |

## Merchant reward scanner — `components/merchant/merchant-reward-scanner.tsx` + loader
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward collection | eyebrow | components/merchant/merchant-reward-scanner.tsx:24 | inline |
| Scan reward QR | heading | components/merchant/merchant-reward-scanner.tsx:26 | inline |
| Point your camera at the QR on the member's phone. We will open the collection screen when it is ready to mark collected. | body | components/merchant/merchant-reward-scanner.tsx:29-31 | inline |
| Camera access blocked | camera error status | components/merchant/merchant-reward-scanner.tsx:87 | inline |
| No camera found | camera error status | components/merchant/merchant-reward-scanner.tsx:88 | inline |
| Camera is busy | camera error status | components/merchant/merchant-reward-scanner.tsx:89 | inline |
| Camera unavailable | camera error status | components/merchant/merchant-reward-scanner.tsx:90 | inline |
| Allow camera access in your browser, make sure you are on HTTPS or localhost, then try again. | camera error detail (denied) | components/merchant/merchant-reward-scanner.tsx:94-95 | inline |
| We could not find a camera on this device. Connect a camera, then try again. | camera error detail (not-found) | components/merchant/merchant-reward-scanner.tsx:96-97 | inline |
| Another app or tab is using the camera. Close it, then try again. | camera error detail (busy) | components/merchant/merchant-reward-scanner.tsx:98 | inline |
| Allow camera access in your browser and use HTTPS or localhost, then try again. | camera error detail (unavailable) | components/merchant/merchant-reward-scanner.tsx:99-100 | inline |
| Camera viewfinder | aria-label | components/merchant/merchant-reward-scanner.tsx:276 | inline |
| Starting camera... | status text (idle) | components/merchant/merchant-reward-scanner.tsx:257 | inline |
| Scanning for a reward QR… | status text (scanning) | components/merchant/merchant-reward-scanner.tsx:260 | inline |
| Reward QR found. Opening collection… | status text (decoded) | components/merchant/merchant-reward-scanner.tsx:261 | inline |
| That is not a reward QR from a member card | status text (invalid) | components/merchant/merchant-reward-scanner.tsx:263 | inline |
| Try again | button (camera error) | components/merchant/merchant-reward-scanner.tsx:291 | inline |
| Back to dashboard | button | components/merchant/merchant-reward-scanner.tsx:296 | inline |
| Starting camera | aria-label + text (loader) | components/merchant/merchant-reward-scanner-loader.tsx:29,33 | inline |
| Back to dashboard | button (loader) | components/merchant/merchant-reward-scanner-loader.tsx:38 | inline |

## Onboarding form + fields — `components/merchant/onboarding-form.tsx`, `onboarding-form-fields.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Cafe | business type option | components/merchant/onboarding-form.tsx:43 | inline |
| Dessert shop | business type option | components/merchant/onboarding-form.tsx:44 | inline |
| Bubble tea | business type option | components/merchant/onboarding-form.tsx:45 | inline |
| Pub or bar | business type option | components/merchant/onboarding-form.tsx:46 | inline |
| Takeaway / quick service | business type option | components/merchant/onboarding-form.tsx:47 | inline |
| Barber | business type option | components/merchant/onboarding-form.tsx:48 | inline |
| Salon | business type option | components/merchant/onboarding-form.tsx:49 | inline |
| Other local business | business type option | components/merchant/onboarding-form.tsx:50 | inline |
| Merchant setup | eyebrow | components/merchant/onboarding-form.tsx:225 | inline |
| Business name | field label | components/merchant/onboarding-form.tsx:230 | inline |
| Phone number | field label | components/merchant/onboarding-form.tsx:288 | inline |
| Saving... | submit pending label | components/merchant/onboarding-form.tsx:304 | inline |
| Finish setup | submit button | components/merchant/onboarding-form.tsx:304 | inline |
| Business type | field label | components/merchant/onboarding-form-fields.tsx:65 | inline |
| Select type | select placeholder option | components/merchant/onboarding-form-fields.tsx:78 | inline |
| (required) | sr-only required marker | components/merchant/onboarding-form-fields.tsx:124 | inline |

## Present QR — `components/merchant/present-qr.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Show full screen | trigger button (default) | components/merchant/present-qr.tsx:32 | inline |
| Close full screen QR | sr-only (close) | components/merchant/present-qr.tsx:60 | inline |
| Scan to join | eyebrow | components/merchant/present-qr.tsx:66 | inline |
| QR code for {venueName} | img alt (interpolated) | components/merchant/present-qr.tsx:77 | inline |
| Customers scan to join and collect today's stamp — no app to download. | body | components/merchant/present-qr.tsx:85-87 | inline |

## Profile form — `components/merchant/profile-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Cafe / Dessert shop / Bubble tea / Pub or bar / Takeaway / quick service / Barber / Salon / Other local business | business type options | components/merchant/profile-form.tsx:19-26 | inline |
| Business profile | eyebrow | components/merchant/profile-form.tsx:80 | inline |
| These details appear on customer cards, terms, billing setup, and merchant emails. Your sign-in email is managed separately. | body | components/merchant/profile-form.tsx:81-83 | inline |
| Customer-facing business name | field label | components/merchant/profile-form.tsx:89 | inline |
| Business type | field label | components/merchant/profile-form.tsx:95 | inline |
| Select type | select placeholder option | components/merchant/profile-form.tsx:102 | inline |
| Business contact email | field label | components/merchant/profile-form.tsx:116 | inline |
| Used for customer contact, billing setup, and merchant notifications. Changing this does not change the email you use to sign in. | field description | components/merchant/profile-form.tsx:117 | inline |
| Phone number | field label | components/merchant/profile-form.tsx:125 | inline |
| Saving… | submit pending label | components/merchant/profile-form.tsx:146 | inline |
| Save changes | submit button | components/merchant/profile-form.tsx:146 | inline |

## Reward collection form — `components/merchant/reward-collection-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward not collected | status banner title | components/merchant/reward-collection-form.tsx:28 | inline |
| Marking collected… | submit pending label | components/merchant/reward-collection-form.tsx:33 | inline |
| Mark reward collected | submit button | components/merchant/reward-collection-form.tsx:33 | inline |

## Send reward form — `components/merchant/send-reward-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward sent. | status banner title | components/merchant/send-reward-form.tsx:31 | inline |
| Sending to {label}. | body (interpolated) | components/merchant/send-reward-form.tsx:44-49 | inline |
| the selected member | member label fallback | components/merchant/send-reward-form.tsx:47 | inline |
| Member email or phone | field label | components/merchant/send-reward-form.tsx:55 | inline |
| Matched to your members. If they're new to Nabaperks, it waits until they join. | field hint | components/merchant/send-reward-form.tsx:56 | inline |
| Reward name | field label | components/merchant/send-reward-form.tsx:64 | inline |
| What the member sees, e.g. "A drink on us". | field hint | components/merchant/send-reward-form.tsx:66 | inline |
| Reward terms | field label | components/merchant/send-reward-form.tsx:73 | inline |
| 12–500 characters. Anything the member should know before redeeming. | field hint | components/merchant/send-reward-form.tsx:75 | inline |
| Expires in | field label | components/merchant/send-reward-form.tsx:83 | inline |
| {n} days | select option (interpolated) | components/merchant/send-reward-form.tsx:95 | inline |
| Message (optional) | field label | components/merchant/send-reward-form.tsx:107 | inline |
| Up to 200 characters. | field hint | components/merchant/send-reward-form.tsx:108 | inline |
| Sending… | submit pending label | components/merchant/send-reward-form.tsx:121 | inline |
| Send reward | submit button | components/merchant/send-reward-form.tsx:122 | inline |

## Send reward fields (validation) — `lib/merchant/send-reward-fields.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward sent. If they're new to Nabaperks, it'll be waiting when they join. | success message | lib/merchant/send-reward-fields.ts:12-13 | shared:send-reward-fields |
| Enter the member's email or phone. | validation (contact) | lib/merchant/send-reward-fields.ts:50 | shared:send-reward-fields |
| Enter the reward name. | validation | lib/merchant/send-reward-fields.ts:54 | shared:send-reward-fields |
| Use 100 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:56 | shared:send-reward-fields |
| Enter clear reward terms. | validation | lib/merchant/send-reward-fields.ts:60 | shared:send-reward-fields |
| Add enough detail for the member to understand it. | validation | lib/merchant/send-reward-fields.ts:62 | shared:send-reward-fields |
| Use 500 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:64 | shared:send-reward-fields |
| Choose a valid expiry. | validation | lib/merchant/send-reward-fields.ts:74 | shared:send-reward-fields |
| Use 200 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:78 | shared:send-reward-fields |

## Sent rewards status — `lib/merchant/sent-rewards.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| New contact | invite recipient fallback | lib/merchant/sent-rewards.ts:82 | inline |
| Phone ending {n} | invite recipient (interpolated) | lib/merchant/sent-rewards.ts:82 | inline |
| Redeemed | reward status label | lib/merchant/sent-rewards.ts:100 | inline |
| Expired | reward/invite status label | lib/merchant/sent-rewards.ts:102,117 | inline |
| Cancelled | reward/invite status label | lib/merchant/sent-rewards.ts:104,119 | inline |
| Sent | reward status label | lib/merchant/sent-rewards.ts:106 | inline |
| Delivered | invite status label | lib/merchant/sent-rewards.ts:116 | inline |
| Invited | invite status label | lib/merchant/sent-rewards.ts:123 | inline |

## Reward collection blocked copy — `lib/merchant/reward-collection.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Log in to your merchant account to mark this reward collected. | blocked reason (unauth) | lib/merchant/reward-collection.ts:84 | inline |
| This reward belongs to a different merchant. | blocked reason | lib/merchant/reward-collection.ts:123 | inline |
| This reward has already been collected. | blocked reason | lib/merchant/reward-collection.ts:125,130 | inline |
| This reward could not be collected. Refresh and try again. | blocked reason | lib/merchant/reward-collection.ts:128,158 | inline |
| This reward cannot be collected until the next opening day. | blocked reason | lib/merchant/reward-collection.ts:133 | inline |
| Ask the customer to finish their profile before this reward can be collected. | blocked reason | lib/merchant/reward-collection.ts:136 | inline |
| This customer must be 18 or over to collect this reward. | blocked reason | lib/merchant/reward-collection.ts:140 | inline |
| This loyalty card is not active. | blocked reason | lib/merchant/reward-collection.ts:143 | inline |
| This customer has not collected enough stamps yet. | blocked reason | lib/merchant/reward-collection.ts:146 | inline |
| This reward is no longer available to collect. | blocked reason | lib/merchant/reward-collection.ts:150 | inline |
| This loyalty programme is unavailable right now. | blocked reason | lib/merchant/reward-collection.ts:154 | inline |
| This reward could not be collected. Try again or refresh. | blocked reason (fallback) | lib/merchant/reward-collection.ts:166 | inline |
| Reward could not be collected. | blocked reason | lib/merchant/reward-collection.ts:107 | inline |

## Stream error boundary — `components/merchant/stream-error-boundary.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Could not load {label} | empty-state title (interpolated) | components/merchant/stream-error-boundary.tsx:59 | inline |
| The rest of your dashboard is unaffected. Try again — your card, members, and rewards are safe on the server. | empty-state description | components/merchant/stream-error-boundary.tsx:60 | inline |
| Retrying… | button pending | components/merchant/stream-error-boundary.tsx:73 | inline |
| Try again | button | components/merchant/stream-error-boundary.tsx:73 | inline |

## Venue address fields — `components/merchant/venue-address-fields.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue address | fieldset legend | components/merchant/venue-address-fields.tsx:42 | inline |
| Address line 1 | field label | components/merchant/venue-address-fields.tsx:46 | inline |
| Building number and street | placeholder | components/merchant/venue-address-fields.tsx:47 | inline |
| Address line 2 | field label | components/merchant/venue-address-fields.tsx:61 | inline |
| Flat, unit, or building name (optional) | placeholder | components/merchant/venue-address-fields.tsx:62 | inline |
| Town or city | field label | components/merchant/venue-address-fields.tsx:75 | inline |
| London | placeholder | components/merchant/venue-address-fields.tsx:77 | inline |
| Postcode | field label | components/merchant/venue-address-fields.tsx:89 | inline |
| E1 6AN | placeholder | components/merchant/venue-address-fields.tsx:91 | inline |
| UK venues only. We use these details to place your venue on the map for optional GPS stamp checks. | helper text | components/merchant/venue-address-fields.tsx:105-107 | inline |
| (required) | sr-only required marker | components/merchant/venue-address-fields.tsx:153 | inline |

## Venue address validation — `lib/merchant/venue-address.ts`, `venue-location-submission.ts`, `resolve-venue-address.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Enter the first line of the address. | validation | lib/merchant/venue-address.ts:134 | inline |
| Use 120 characters or fewer. | validation | lib/merchant/venue-address.ts:136,140; venue-location-submission.ts:108 | inline |
| Enter the town or city. | validation | lib/merchant/venue-address.ts:144 | inline |
| Use 80 characters or fewer. | validation | lib/merchant/venue-address.ts:146 | inline |
| Enter the postcode. | validation | lib/merchant/venue-address.ts:150 | inline |
| Enter a valid UK postcode. | validation | lib/merchant/venue-address.ts:152 | inline |
| We could not confirm this place. Enter the address manually. | provider place error | lib/merchant/venue-address.ts:288 | inline |
| We could not confirm this place's location. Enter the address manually. | provider location error | lib/merchant/venue-address.ts:290 | inline |
| Enter the venue name. | validation | lib/merchant/venue-location-submission.ts:106 | inline |
| Enter a whole-number radius. | validation | lib/merchant/venue-location-submission.ts:113 | inline |
| Use at least 25 metres. | validation | lib/merchant/venue-location-submission.ts:115 | inline |
| Use 1,000 metres or fewer. | validation | lib/merchant/venue-location-submission.ts:117 | inline |
| Drop the pin on the map before saving. | validation (form) | lib/merchant/venue-location-submission.ts:121 | inline |
| We could not geocode this address. Check it and try again. | geocode error | lib/merchant/resolve-venue-address.ts:13 | inline |

---

# QR Poster components — `components/merchant/qr-poster/**`

## Poster copy resolver — `components/merchant/qr-poster/poster-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Don't leave your first stamp behind — scan now to unlock it. | progress line (1 stamp) | components/merchant/qr-poster/poster-copy.ts:71 | shared:poster-copy |
| You're already 1 stamp in — don't leave it behind. {N} more visit(s) unlock(s) your mystery reward. | progress line (interpolated) | components/merchant/qr-poster/poster-copy.ts:75 | shared:poster-copy |
| Your first stamp's on us — and it unlocks a mystery reward. | support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:80 | shared:poster-copy |
| Your first stamp's on us. The rest unlock a mystery reward. | support | components/merchant/qr-poster/poster-copy.ts:83 | shared:poster-copy |
| Everyone / wins / something. | bold headline (before/accent/after) | components/merchant/qr-poster/poster-copy.ts:118-120 | shared:poster-copy |
| We're not allowed to tell you what it is. | bold forbidden | components/merchant/qr-poster/poster-copy.ts:123 | shared:poster-copy |
| No app · 20 seconds · No spam | bold friction line | components/merchant/qr-poster/poster-copy.ts:124 | shared:poster-copy |
| Scan to claim your free stamp | bold qr caption | components/merchant/qr-poster/poster-copy.ts:125 | shared:poster-copy |
| One stamp a day · Reward revealed when unlocked | bold reassurance | components/merchant/qr-poster/poster-copy.ts:126 | shared:poster-copy |
| One visit. One / surprise / . | editorial headline (1 stamp) | components/merchant/qr-poster/poster-copy.ts:131-134 | shared:poster-copy |
| {N} visits. One / surprise / . | editorial headline (interpolated) | components/merchant/qr-poster/poster-copy.ts:137-139 | shared:poster-copy |
| Start with a free stamp — the reward stays a mystery until you unlock it. | editorial support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:143 | shared:poster-copy |
| Your first stamp is already waiting. Collect the rest to reveal what you've earned. | editorial support | components/merchant/qr-poster/poster-copy.ts:144 | shared:poster-copy |
| We can't tell you what it is. That's the point. | editorial forbidden | components/merchant/qr-poster/poster-copy.ts:145 | shared:poster-copy |
| No app download · Scan in 20 seconds | editorial friction line | components/merchant/qr-poster/poster-copy.ts:146 | shared:poster-copy |
| Scan to unlock your mystery reward | editorial qr caption | components/merchant/qr-poster/poster-copy.ts:147 | shared:poster-copy |
| Stamps count once per day · Mystery until unlock | editorial reassurance | components/merchant/qr-poster/poster-copy.ts:148 | shared:poster-copy |
| First stamp's / free / . | ticket headline | components/merchant/qr-poster/poster-copy.ts:152-154 | shared:poster-copy |
| Claim it now — your mystery reward unlocks straight after. | ticket support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:158 | shared:poster-copy |
| Claim stamp one today. The rest unlock your mystery reward. | ticket support | components/merchant/qr-poster/poster-copy.ts:159 | shared:poster-copy |
| Staff won't spoil it. We won't either. | ticket forbidden | components/merchant/qr-poster/poster-copy.ts:160 | shared:poster-copy |
| No account needed · Takes 20 seconds | ticket friction line | components/merchant/qr-poster/poster-copy.ts:161 | shared:poster-copy |
| Scan here to claim your free stamp | ticket qr caption | components/merchant/qr-poster/poster-copy.ts:162 | shared:poster-copy |
| One stamp per visit · Mystery until unlock | ticket reassurance | components/merchant/qr-poster/poster-copy.ts:163 | shared:poster-copy |

## Poster pieces — `components/merchant/qr-poster/poster-pieces.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks QR code | img alt | components/merchant/qr-poster/poster-pieces.tsx:57 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/poster-pieces.tsx:99 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/poster-pieces.tsx:131 | inline |

## Poster preview chrome — `components/merchant/qr-poster/poster-preview-chrome.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Print or save PDF | button | components/merchant/qr-poster/poster-preview-chrome.tsx:67 | inline |
| Preview matches print. Use A4 portrait at 100% scale — no fit-to-page. Safe margins are built in for framing. | guidance text | components/merchant/qr-poster/poster-preview-chrome.tsx:74-79 | inline |
| Poster templates | nav aria-label | components/merchant/qr-poster/poster-preview-chrome.tsx:105 | inline |
| Open menu | SidebarTrigger aria-label | components/merchant/qr-poster/poster-preview-chrome.tsx:182 | inline |
| Back | button | components/merchant/qr-poster/poster-preview-chrome.tsx:194 | inline |
| Print guidance | sr-only | components/merchant/qr-poster/poster-preview-chrome.tsx:220 | inline |
| Templates | side panel heading | components/merchant/qr-poster/poster-preview-chrome.tsx:263 | inline |
| Print setup | side panel heading | components/merchant/qr-poster/poster-preview-chrome.tsx:275 | inline |
| A4 portrait · 210×297 mm · print at 100% | side panel meta | components/merchant/qr-poster/poster-preview-chrome.tsx:279,302 | inline |

## North Star poster — `components/merchant/qr-poster/northstar/northstar-poster.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your first stamp's already inked — scan to claim it and unlock a mystery reward. | promise (1 stamp) | components/merchant/qr-poster/northstar/northstar-poster.tsx:60 | inline |
| You're one stamp in — {N} more visit(s) unlock(s) a mystery reward. | promise (interpolated) | components/merchant/qr-poster/northstar/northstar-poster.tsx:65 | inline |
| Everyone / wins / something. | hook headline | components/merchant/qr-poster/northstar/northstar-poster.tsx:98 | inline |
| No app · 20 seconds · No spam | ease line | components/merchant/qr-poster/northstar/northstar-poster.tsx:101 | inline |
| First stamp free | card chip | components/merchant/qr-poster/northstar/northstar-poster.tsx:105 | inline |
| Scan to claim your free stamp | caption | components/merchant/qr-poster/northstar/northstar-poster.tsx:107 | inline |
| Nabaperks QR code | img alt | components/merchant/qr-poster/northstar/northstar-poster.tsx:113 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/northstar/northstar-poster.tsx:138 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/northstar/northstar-poster.tsx:156 | inline |
| Reward revealed when unlocked | footer line | components/merchant/qr-poster/northstar/northstar-poster.tsx:158 | inline |

## Thermal poster — `components/merchant/qr-poster/thermal/thermal-poster.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loyalty receipt | meta line | components/merchant/qr-poster/thermal/thermal-poster.tsx:81 | inline |
| No cash · No app · 20 seconds | meta line | components/merchant/qr-poster/thermal/thermal-poster.tsx:85 | inline |
| Everyone / wins / something | hook | components/merchant/qr-poster/thermal/thermal-poster.tsx:88-90 | inline |
| Today's first stamp | receipt item label | components/merchant/qr-poster/thermal/thermal-poster.tsx:93 | inline |
| Free | receipt item value | components/merchant/qr-poster/thermal/thermal-poster.tsx:93 | inline |
| Mystery reward | receipt item label | components/merchant/qr-poster/thermal/thermal-poster.tsx:94 | inline |
| Locked | receipt item value | components/merchant/qr-poster/thermal/thermal-poster.tsx:94 | inline |
| Visit(s) to unlock | receipt item label (interpolated) | components/merchant/qr-poster/thermal/thermal-poster.tsx:95 | inline |
| To join | total label | components/merchant/qr-poster/thermal/thermal-poster.tsx:100 | inline |
| £0.00 | total value | components/merchant/qr-poster/thermal/thermal-poster.tsx:101 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/thermal/thermal-poster.tsx:129 | inline |
| Stamps on your card | caption | components/merchant/qr-poster/thermal/thermal-poster.tsx:138 | inline |
| Nabaperks QR code | img alt | components/merchant/qr-poster/thermal/thermal-poster.tsx:148 | inline |
| Scan to claim your free stamp | scan line | components/merchant/qr-poster/thermal/thermal-poster.tsx:153 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/thermal/thermal-poster.tsx:164 | inline |
| *** Thank you *** | thanks line | components/merchant/qr-poster/thermal/thermal-poster.tsx:166 | inline |

## A4 poster shell — `components/merchant/qr-poster/a4-poster.tsx`, `poster-variants.tsx`
_No literal copy — compose PosterCopy fields and poster pieces._

---

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Try again | ~5 (error.tsx, billing-panel, stream-error-boundary, scanner, camera-error) |
| Cancel | ~2 (loyalty-card-form) |
| Saving… / Saving... | ~6 (loyalty-card-form ×2, birthday-form, profile-form, onboarding-form, venue-location-form) |
| Back to dashboard | ~4 (reward scan page, scanner, scanner-loader) |
| Back | ~2 (poster chrome "Back"; qr poster "Back to QR") |
| Proceed to billing | ~6 (launch page, billing-panel, launch-billing-cta, qr-panel ×2, loyalty-card-form) |
| Go to card builder | ~2 (qr-panel, rewards-panel) |
| Open your Poster kit | ~2 (activity empty, customers empty) |
| Finish onboarding first | ~2 (card-panel, rewards-panel) |
| Loading… | ~1 (activity-detail-feed load-more) + Loading X aria-labels (skeletons) |
| Members (eyebrow/label) | ~6 across customers, send-reward, KPIs, stat strips |
| Reward name / Reward terms | ~4 pairs (loyalty-card-form, birthday-form, send-reward-form) |
| (required) | ~2 (onboarding-form-fields, venue-address-fields) |

## Scope notes / surprises
- **Heavy shared-copy modules within slice**: `lib/merchant/reward-presets.ts` (32 preset strings), `components/merchant/qr-poster/poster-copy.ts` (24 template strings), `lib/merchant/loyalty-card-copy.ts`, `lib/merchant/send-reward-fields.ts`, `lib/merchant/default-reward-pool.ts`, and `lib/notifications/venue-announcement-form-copy.ts` are the `shared:` sources; all resolved verbatim above. `lib/merchant/activity.ts` is the single largest inline copy resolver (~90 activity headline/summary/badge strings) — treated as `inline` since strings are hardcoded in that module.
- **Within-slice duplication (relevant to consistency audit)**:
  - "Proceed to billing to activate your venue and start accepting stamps." appears in launch/page.tsx, launch-billing-cta.tsx, qr-panel.tsx, rewards-panel.tsx.
  - "Your account is created" / "Your account is created." heading+banner repeats across launch/page.tsx, billing-panel.tsx, launch-billing-cta.tsx, rewards-panel.tsx, qr-panel.tsx.
  - "Activity will appear after members join, add stamps, redeem rewards, or download QR assets." duplicated in activity/page.tsx and dashboard-home-streams.tsx.
  - "Open your Poster kit" duplicated in activity/page.tsx and customers/page.tsx.
  - Plan receipt lines ("Free trial / 30 days", "Then / £29 a month", "Billed / Per location") appear twice within billing-panel.tsx (SetupBillingActivationCard + AccountBillingCard).
  - "Mystery Visit Card" default appears in card-panel.tsx and customer-card-preview.tsx.
  - Camera "…then try again." remediation copy repeats across 4 CAMERA_ERROR_DETAIL variants.
  - Both `formatMerchantVenueLabel` (lib/merchant/venue-label.ts) and inline `venueLabelOf`/`buildEyebrow`/`buildVenueName` (poster-preview-chrome, poster-copy, northstar, thermal) implement the same "show venue name once" logic with the `·` separator.
- **Dead/unwired component**: `components/merchant/dashboard-next-actions.tsx` (MerchantNextActions: "Do next", "…ready to redeem", "…gone quiet", "Repeat members") is exported but NOT imported by any covered route — the dashboard uses dashboard-home-streams.tsx instead. Its copy is inventoried but may be unreachable.
- **Not consumed in this slice**: `lib/merchant/staff-members.ts` holds user-facing strings ("Give the staff member a name.", "PIN must be 4 to 6 digits.") but no covered route/component imports it (staff-management UI is outside this slice — likely admin). Excluded from the tables; flagged here only.
- **Dev-only / internal copy present**: billing-panel.tsx local-dev Stripe webhook note (gated by NODE_ENV !== "production"); venue-place-autocomplete.tsx "Dev note: Google blocked this origin…" (NODE_ENV-gated); qr/image route DEV_HARNESS constants and "https://nabaperks.com/q/old-crown-girton". No lorem/TODO placeholder text found.
- **Reward name written but never shown to merchant as free text**: card/actions.ts passes `p_reward_name: "Surprise reward"` (stored RPC value), not surfaced as UI label.
- **`app/(auth)/actions.ts` uses `{digitLabel}`/`{length}`** from `merchantEmailOtpAliasDigitLabel()` — auth pages interpolate a shared OTP-length label (not a literal); recorded with the interpolation marker.
- **Auth pages import `AuthForm` / `ResetPasswordForm`** from `components/auth/*` (outside this slice) — those form field labels/buttons live there, not inventoried here.



<hr>

# ▓ SURFACE: Admin + Public Storefront

# Copy Inventory — Admin + Public Merchant Pages

_Scope: app/admin/** (root, layout, error, loading, actions, audit, billing, customers, fraud, pilot, privacy, merchants); app/merchant/[merchantSlug]/** (terms page + loading); components/admin/**. `shared:` strings resolved from lib/admin/*, components/layout/admin-shell + console-nav, lib/customer/consent._

## Admin root (overview) — `app/admin/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin console | route title | app/admin/page.tsx:34 | inline |
| Internal admin | eyebrow | app/admin/page.tsx:51 | inline |
| Admin console | heading | app/admin/page.tsx:52 | inline |
| Restricted support views and audited manual actions. | subhead | app/admin/page.tsx:53 | inline |
| Merchants | metric label | app/admin/page.tsx:58 | inline |
| Customers | metric label | app/admin/page.tsx:63 | inline |
| Billing issues | metric label | app/admin/page.tsx:68 | inline |
| Pilot funnel readback | section heading | app/admin/page.tsx:76 | inline |
| The eight-stage merchant-to-redemption journey, counted from Supabase product events. | section subhead | app/admin/page.tsx:77 | inline |
| Source: product_events | source label | app/admin/page.tsx:78 | inline |
| Recent audited actions | section heading | app/admin/page.tsx:84 | inline |
| The last six entries from the audit trail; times in UK local time. | section subhead | app/admin/page.tsx:85 | inline |
| Source: audit_logs | source label | app/admin/page.tsx:86 | inline |
| Recent audited actions | aria-label | app/admin/page.tsx:89 | inline |
| No audited actions yet | empty-state title | app/admin/page.tsx:96 | inline |
| Audited support actions will appear here as operators work. | empty-state body | app/admin/page.tsx:97 | inline |
| View audit log | button/link | app/admin/page.tsx:104 | inline |
| No merchant | fallback text (audit row) | app/admin/page.tsx:135 | inline |
| Overview | nav label | app/admin/page.tsx:116 (renders adminNavItems) | shared:console-nav |
| Pilot | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Merchants | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Customers | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Billing | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Privacy | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Fraud | nav label | app/admin/page.tsx:116 | shared:console-nav |
| Audit | nav label | app/admin/page.tsx:116 | shared:console-nav |

## Admin layout (access shell) — `app/admin/layout.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Internal admin | eyebrow | app/admin/layout.tsx:19 | inline |
| Access denied | heading | app/admin/layout.tsx:21 | inline |
| Internal admin access is required. | denial reason body | app/admin/layout.tsx:24 (access.reason) | shared:auth |
| Admin MFA verification is required. | denial reason body | app/admin/layout.tsx:24 (access.reason) | shared:auth |

## Admin shell (chrome around every /admin page) — `components/layout/admin-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks Admin | logo label | components/layout/admin-shell.tsx:42, 87 | shared:admin-shell |
| Admin navigation | nav aria-label | components/layout/admin-shell.tsx:46 | shared:admin-shell |
| Operator: {email} | footer tag | components/layout/admin-shell.tsx:58 | shared:admin-shell |
| Service-role readbacks | footer tag | components/layout/admin-shell.tsx:19 | shared:admin-shell |
| Audited support actions | footer tag | components/layout/admin-shell.tsx:20 | shared:admin-shell |
| MFA-aware access | footer tag | components/layout/admin-shell.tsx:21 | shared:admin-shell |
| AAL2 verified | footer status tag / title | components/layout/admin-shell.tsx:73, 77 | shared:admin-shell |
| Admin verified | footer status tag / title | components/layout/admin-shell.tsx:73, 77 | shared:admin-shell |
| MFA enforcement is enabled for this admin session. | banner | components/layout/admin-shell.tsx:99 | shared:admin-shell |

## Admin error boundary — `app/admin/error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| This admin view hit an error | empty-state title | app/admin/error.tsx:25 | inline |
| The view could not load safely. Retry, and if it keeps happening check the server logs. | empty-state body | app/admin/error.tsx:29-30 | inline |
| Log reference: {digest} | inline detail | app/admin/error.tsx:32 | inline |
| Retry | button | app/admin/error.tsx:39 | inline |

## Admin loading skeleton — `app/admin/loading.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading admin workspace | loading aria-label | app/admin/loading.tsx:14 | inline |

## Admin server actions (inline result/validation messages) — `app/admin/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Membership and stamp delta are required. | validation error | app/admin/actions.ts:46 | inline |
| Operator reason is required. | validation error | app/admin/actions.ts:49, 82, 118, 156, 194, 232 | inline |
| Stamp adjustment failed. Try again or review audit logs. | error toast/inline | app/admin/actions.ts:61 | inline |
| Stamps adjusted. Logged to the audit trail. | success inline | app/admin/actions.ts:67 | inline |
| Reward is required. | validation error | app/admin/actions.ts:79 | inline |
| Reward cancellation failed. Try again or review audit logs. | error inline | app/admin/actions.ts:93 | inline |
| Reward cancelled. Logged to the audit trail. | success inline | app/admin/actions.ts:99 | inline |
| Fraud flag is required. | validation error | app/admin/actions.ts:112 | inline |
| Fraud flag status is invalid. | validation error | app/admin/actions.ts:115 | inline |
| Fraud flag update failed. Try again or review audit logs. | error inline | app/admin/actions.ts:130 | inline |
| Flag marked reviewed. Logged to the audit trail. | success inline | app/admin/actions.ts:138 | inline |
| Flag dismissed. Logged to the audit trail. | success inline | app/admin/actions.ts:139 | inline |
| QR code is required. | validation error | app/admin/actions.ts:153, 191 | inline |
| QR update failed. Try again or review audit logs. | error inline | app/admin/actions.ts:168 | inline |
| QR code enabled. Logged to the audit trail. | success inline | app/admin/actions.ts:177 | inline |
| QR code disabled. Logged to the audit trail. | success inline | app/admin/actions.ts:178 | inline |
| QR regeneration failed. Try again or review audit logs. | error inline | app/admin/actions.ts:205 | inline |
| QR code regenerated. Logged to the audit trail. | success inline | app/admin/actions.ts:212 | inline |
| Customer and merchant context are required. | validation error | app/admin/actions.ts:229, 268 | inline |
| Consent opt-out failed. Try again or review audit logs. | error inline | app/admin/actions.ts:247 | inline |
| Opt-out recorded. Logged to the audit trail. | success inline | app/admin/actions.ts:253 | inline |
| Request type is required. | validation error | app/admin/actions.ts:271 | inline |
| Support channel is required. | validation error | app/admin/actions.ts:274 | inline |
| Support notes are required. | validation error | app/admin/actions.ts:277, 321 | inline |
| Data request log failed. Try again or review audit logs. | error inline | app/admin/actions.ts:291 | inline |
| Data request logged to the audit trail. | success inline | app/admin/actions.ts:297 | inline |
| Merchant context is required. | validation error | app/admin/actions.ts:315 | inline |
| Note type is required. | validation error | app/admin/actions.ts:318 | inline |
| Setup check minutes must be a number. | validation error | app/admin/actions.ts:325 | inline |
| Setup check minutes must be between 1 and 3. | validation error | app/admin/actions.ts:328 | inline |
| Pilot note log failed. Try again or review audit logs. | error inline | app/admin/actions.ts:341 | inline |
| Pilot note logged to the audit trail. | success inline | app/admin/actions.ts:347 | inline |

## Admin — Audit logs — `app/admin/audit/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Audit logs | route title | app/admin/audit/page.tsx:20 | inline |
| Internal admin | eyebrow | app/admin/audit/page.tsx:31 | inline |
| Audit logs | heading | app/admin/audit/page.tsx:31 | inline |
| Actor, action, context, timestamp, and non-sensitive metadata. Newest first, times in UK local time. | subhead | app/admin/audit/page.tsx:32 | inline |
| Source: audit_logs | source label | app/admin/audit/page.tsx:37 | inline |
| Admin audit log readback | table caption | app/admin/audit/page.tsx:41 | inline |
| No audit logs yet | empty-state title | app/admin/audit/page.tsx:49 | inline |
| Audited support and security-sensitive actions will appear here. | empty-state body | app/admin/audit/page.tsx:50 | inline |
| Actor | table header / card label | app/admin/audit/page.tsx:62, 103 | inline |
| Context | table header / card label | app/admin/audit/page.tsx:66, 108 | inline |
| No merchant | fallback text | app/admin/audit/page.tsx:69, 114 | inline |
| Target | table header / card label | app/admin/audit/page.tsx:79, 124 | inline |
| When | table header / card label | app/admin/audit/page.tsx:83, 129 | inline |
| Action | table header | app/admin/audit/page.tsx:98 | inline |

## Admin — Billing — `app/admin/billing/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account | cross-link | app/admin/billing/page.tsx:29 | inline |
| Members | cross-link | app/admin/billing/page.tsx:35 | inline |
| Admin — Billing | route title | app/admin/billing/page.tsx:41 | inline |
| Internal admin | eyebrow | app/admin/billing/page.tsx:52 | inline |
| Billing | heading | app/admin/billing/page.tsx:52 | inline |
| Stripe subscription state synced into Supabase. | subhead | app/admin/billing/page.tsx:53 | inline |
| Source: billing_customers | source label | app/admin/billing/page.tsx:58 | inline |
| Admin billing subscription readback | table caption | app/admin/billing/page.tsx:61 | inline |
| No billing records yet | empty-state title | app/admin/billing/page.tsx:71 | inline |
| Merchant | table header | app/admin/billing/page.tsx:77 | inline |
| Plan | table header / card label | app/admin/billing/page.tsx:92, 147 | inline |
| Status | table header | app/admin/billing/page.tsx:96 | inline |
| Period end | table header / card label | app/admin/billing/page.tsx:103, 149 | inline |
| Updated {date} | inline metadata | app/admin/billing/page.tsx:111 | inline |
| Stripe refs | table header | app/admin/billing/page.tsx:118 | inline |
| Subscription {ref} | inline metadata | app/admin/billing/page.tsx:122 | inline |
| Customer {ref} | inline metadata | app/admin/billing/page.tsx:124 | inline |
| Email | card label | app/admin/billing/page.tsx:141 | inline |
| Links | card label | app/admin/billing/page.tsx:144 | inline |
| Updated | card label | app/admin/billing/page.tsx:153 | inline |
| Stripe subscription | card label | app/admin/billing/page.tsx:157 | inline |
| Stripe customer | card label | app/admin/billing/page.tsx:161 | inline |
| No plan | plan fallback value | app/admin/billing/page.tsx (row.plan) | shared:billing-data |
| Active / Trial / Trialing / Past due / Incomplete / Cancelled / Suspended / No billing record | status pill labels | app/admin/billing/page.tsx:99 (statusLabel) | shared:billing-redaction |

## Admin — Customers (page) — `app/admin/customers/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Customers | route title | app/admin/customers/page.tsx:14 | inline |
| Internal admin | eyebrow | app/admin/customers/page.tsx:51 | inline |
| Customers | heading | app/admin/customers/page.tsx:51 | inline |
| Customer lookup with audited stamp and reward support actions. | subhead | app/admin/customers/page.tsx:52 | inline |

## Admin — Customers: Memberships panel — `app/admin/customers/customer-memberships-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Memberships | section heading | app/admin/customers/customer-memberships-panel.tsx:43 | inline |
| Search every membership by venue or masked-contact fragment. Masked customer contacts and merchant-scoped stamp counters from service-role support reads. | section subhead | app/admin/customers/customer-memberships-panel.tsx:44 | inline |
| Source: service-role admin readback | source label | app/admin/customers/customer-memberships-panel.tsx:46 | inline |
| Membership lookup | lookup form label/aria | app/admin/customers/customer-memberships-panel.tsx:50 | inline |
| Admin customer membership support readback | table caption | app/admin/customers/customer-memberships-panel.tsx:56 | inline |
| No matching memberships | empty-state title | app/admin/customers/customer-memberships-panel.tsx:66 | inline |
| Adjust the venue or contact search, or clear it to see the newest memberships. | empty-state body | app/admin/customers/customer-memberships-panel.tsx:67 | inline |
| No customer memberships yet | empty-state title | app/admin/customers/customer-memberships-panel.tsx:73 | inline |
| Merchant | card label | app/admin/customers/customer-memberships-panel.tsx:86 | inline |
| Stamps | card label / table header | app/admin/customers/customer-memberships-panel.tsx:90, 141 | inline |
| {n} current · {n} total | inline value | app/admin/customers/customer-memberships-panel.tsx:93-94, 143-144 | inline |
| Rewards redeemed | card label / table header | app/admin/customers/customer-memberships-panel.tsx:99, 151 | inline |
| Joined | card label / table header | app/admin/customers/customer-memberships-panel.tsx:107, 159 | inline |
| Customer | table header | app/admin/customers/customer-memberships-panel.tsx:122 | inline |
| Audited action | table header | app/admin/customers/customer-memberships-panel.tsx:172 | inline |
| Membership pages | pagination nav label | app/admin/customers/customer-memberships-panel.tsx:180 | inline |
| memberships | pagination unit | app/admin/customers/customer-memberships-panel.tsx:181 | inline |
| Membership lookup unavailable | error-state title | app/admin/customers/customer-memberships-panel.tsx:190 | inline |
| Delta | form field label | app/admin/customers/customer-memberships-panel.tsx:206 | inline |
| Positive adds stamps, negative removes them. | field helper | app/admin/customers/customer-memberships-panel.tsx:207 | inline |
| Reason | form field label | app/admin/customers/customer-memberships-panel.tsx:212 | inline |
| Adjusting… | submit pending label | app/admin/customers/customer-memberships-panel.tsx:216 | inline |
| Adjust stamps | submit button | app/admin/customers/customer-memberships-panel.tsx:218 | inline |

## Admin — Customers: Rewards panel — `app/admin/customers/customer-rewards-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Rewards | section heading | app/admin/customers/customer-rewards-panel.tsx:39 | inline |
| Assigned reward readbacks preserve customer masking and require a reason before cancellation. | section subhead | app/admin/customers/customer-rewards-panel.tsx:40 | inline |
| Source: service-role admin readback | source label | app/admin/customers/customer-rewards-panel.tsx:41 | inline |
| Admin reward support readback | table caption | app/admin/customers/customer-rewards-panel.tsx:47 | inline |
| No rewards yet | empty-state title | app/admin/customers/customer-rewards-panel.tsx:55 | inline |
| Reward | fallback value / table header | app/admin/customers/customer-rewards-panel.tsx:68, 104, 110 | inline |
| Context | card label / table header | app/admin/customers/customer-rewards-panel.tsx:72, 116 | inline |
| Merchant | fallback value | app/admin/customers/customer-rewards-panel.tsx:75, 123 | inline |
| Created | card label / table header | app/admin/customers/customer-rewards-panel.tsx:81, 135 | inline |
| No action available | inline text | app/admin/customers/customer-rewards-panel.tsx:94, 154 | inline |
| Status | table header | app/admin/customers/customer-rewards-panel.tsx:130 | inline |
| Audited action | table header | app/admin/customers/customer-rewards-panel.tsx:148 | inline |
| Reward pages | pagination nav label | app/admin/customers/customer-rewards-panel.tsx:163 | inline |
| reward events | pagination unit | app/admin/customers/customer-rewards-panel.tsx:164 | inline |
| Reward readback unavailable | error-state title | app/admin/customers/customer-rewards-panel.tsx:174 | inline |
| Reason | form field label | app/admin/customers/customer-rewards-panel.tsx:185 | inline |
| Cancelling permanently removes this unlocked reward from the member; it cannot be undone. The action is written to the audit log. | field helper | app/admin/customers/customer-rewards-panel.tsx:187 | inline |
| I understand this cancellation cannot be undone. | confirm-check label | app/admin/customers/customer-rewards-panel.tsx:191 | inline |
| Cancelling… | submit pending label | app/admin/customers/customer-rewards-panel.tsx:192 | inline |
| Cancel reward | submit button | app/admin/customers/customer-rewards-panel.tsx:194 | inline |

## Admin — Fraud (page) — `app/admin/fraud/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Fraud | route title | app/admin/fraud/page.tsx:8 | inline |
| Internal admin | eyebrow | app/admin/fraud/page.tsx:19 | inline |
| Fraud | heading | app/admin/fraud/page.tsx:19 | inline |
| Fraud flags, soft geofence anomalies, and security-related product events. | subhead | app/admin/fraud/page.tsx:20 | inline |

## Admin — Fraud: Flags panel — `app/admin/fraud/fraud-flags-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Fraud flags | section heading | app/admin/fraud/fraud-flags-panel.tsx:54 | inline |
| Security support signals with masked customer context and bucketed location evidence. | section subhead | app/admin/fraud/fraud-flags-panel.tsx:55 | inline |
| Source: service-role admin readback | source label | app/admin/fraud/fraud-flags-panel.tsx:56 | inline |
| Admin fraud flag readback | table caption | app/admin/fraud/fraud-flags-panel.tsx:59 | inline |
| No fraud flags yet | empty-state title | app/admin/fraud/fraud-flags-panel.tsx:67 | inline |
| Signal | table header | app/admin/fraud/fraud-flags-panel.tsx:74 | inline |
| Context | table header | app/admin/fraud/fraud-flags-panel.tsx:83 | inline |
| Evidence | table header / card label | app/admin/fraud/fraud-flags-panel.tsx:95, 137 | inline |
| Severity | table header | app/admin/fraud/fraud-flags-panel.tsx:99 | inline |
| Status | table header | app/admin/fraud/fraud-flags-panel.tsx:106 | inline |
| When | table header / card label | app/admin/fraud/fraud-flags-panel.tsx:111, 139 | inline |
| Review | table header | app/admin/fraud/fraud-flags-panel.tsx:120 | inline |
| Merchant | card label | app/admin/fraud/fraud-flags-panel.tsx:135 | inline |
| Customer | card label | app/admin/fraud/fraud-flags-panel.tsx:136 | inline |
| location {status} · distance {bucket} · accuracy {bucket} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:167-169 | inline |
| confidence {value} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:172 | inline |
| · cycle stamp {n} | inline evidence | app/admin/fraud/fraud-flags-panel.tsx:174 | inline |
| Mark reviewed | action button label | app/admin/fraud/fraud-flags-panel.tsx:193 | inline |
| Dismiss | action button label | app/admin/fraud/fraud-flags-panel.tsx:199 | inline |
| Review reason | form field label | app/admin/fraud/fraud-flags-panel.tsx:225 | inline |
| Dismissal reason | form field label | app/admin/fraud/fraud-flags-panel.tsx:225 | inline |
| Saving… | submit pending label | app/admin/fraud/fraud-flags-panel.tsx:230 | inline |

## Admin — Fraud: Redemption failures panel — `app/admin/fraud/redemption-failures-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Redemption failures | section heading | app/admin/fraud/redemption-failures-panel.tsx:26 | inline |
| Product-event failures retained for support analysis without exposing raw RPC payloads. | section subhead | app/admin/fraud/redemption-failures-panel.tsx:27 | inline |
| Source: product_events | source label | app/admin/fraud/redemption-failures-panel.tsx:28 | inline |
| Admin redemption failure event readback | table caption | app/admin/fraud/redemption-failures-panel.tsx:31 | inline |
| No redemption failures yet | empty-state title | app/admin/fraud/redemption-failures-panel.tsx:40 | inline |
| Event | table header | app/admin/fraud/redemption-failures-panel.tsx:45 | inline |
| Merchant | table header / card label / fallback | app/admin/fraud/redemption-failures-panel.tsx:52, 57, 80, 83 | inline |
| When | table header / card label | app/admin/fraud/redemption-failures-panel.tsx:60, 83 | inline |

## Admin — Pilot readiness — `app/admin/pilot/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Pilot readiness | route title | app/admin/pilot/page.tsx:28 | inline |
| Internal admin | eyebrow | app/admin/pilot/page.tsx:42 | inline |
| Pilot readiness | heading | app/admin/pilot/page.tsx:42 | inline |
| Launch gates, source-backed funnel metrics, and merchant pilot notes. | subhead | app/admin/pilot/page.tsx:43 | inline |
| Pilot report | section heading | app/admin/pilot/page.tsx:65 | inline |
| Event counts come from Supabase product events. Derived rates, billing state, and interview notes are labelled separately. | section subhead | app/admin/pilot/page.tsx:66 | inline |
| Source: product_events | source label | app/admin/pilot/page.tsx:70 | inline |
| Source: merchants table | source label | app/admin/pilot/page.tsx:71 | inline |
| Source: billing_customers | source label | app/admin/pilot/page.tsx:72 | inline |
| Pilot readiness source-labelled metrics | table caption | app/admin/pilot/page.tsx:77 | inline |
| No pilot metrics available yet | empty-state title | app/admin/pilot/page.tsx:85 | inline |
| Pilot metrics appear here once the report source returns data. | empty-state body | app/admin/pilot/page.tsx:86 | inline |
| Value | card label / table header | app/admin/pilot/page.tsx:94, 116 | inline |
| Pilot target | card label / table header | app/admin/pilot/page.tsx:99, 124 | inline |
| Source | card label / table header | app/admin/pilot/page.tsx:101, 130 | inline |
| Source: {source} | source label (row) | app/admin/pilot/page.tsx:102, 133 | inline |
| Metric | table header | app/admin/pilot/page.tsx:110 | inline |
| Pilot merchant notes | section heading | app/admin/pilot/page.tsx:142 | inline |
| Capture support notes, cancellation reasons, payment objections, and self-service launch checks as audited admin records. | section subhead | app/admin/pilot/page.tsx:143 | inline |
| Source: audit_logs | source label | app/admin/pilot/page.tsx:144 | inline |
| Account | card label | app/admin/pilot/page.tsx:157 | inline |
| Billing | card label | app/admin/pilot/page.tsx:161 | inline |
| no billing record | fallback value | app/admin/pilot/page.tsx:164 | inline |
| Note type | form field label | app/admin/pilot/page.tsx:183 | inline |
| Support note | select option | app/admin/pilot/page.tsx:190 | inline |
| Interview note | select option | app/admin/pilot/page.tsx:191 | inline |
| Payment objection | select option | app/admin/pilot/page.tsx:193 | inline |
| Cancellation reason | select option | app/admin/pilot/page.tsx:195 | inline |
| Self-service launch check | select option | app/admin/pilot/page.tsx:198 | inline |
| Setup check minutes | form field label | app/admin/pilot/page.tsx:204 | inline |
| Optional for self-service launch checks. | field helper | app/admin/pilot/page.tsx:205 | inline |
| 1-3 | input placeholder | app/admin/pilot/page.tsx:212 | inline |
| Notes | form field label | app/admin/pilot/page.tsx:216 | inline |
| What happened, source, and next action | textarea placeholder | app/admin/pilot/page.tsx:224 | inline |
| Saving… | submit pending label | app/admin/pilot/page.tsx:228 | inline |
| Save note | submit button | app/admin/pilot/page.tsx:232 | inline |
| No pilot merchants yet | empty-state title | app/admin/pilot/page.tsx:244 | inline |

### Pilot checklist tiles + metric rows (rendered on pilot page) — `shared:pilot-report`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pilot size | checklist tile label | lib/admin/pilot-report.ts:65 | shared:pilot-report |
| 10-20 merchants | checklist tile target | lib/admin/pilot-report.ts:66 | shared:pilot-report |
| Launch offer | checklist tile label | lib/admin/pilot-report.ts:75 | shared:pilot-report |
| 30 days free, then GBP 29/mo | checklist tile target | lib/admin/pilot-report.ts:76 | shared:pilot-report |
| Configured | checklist tile value | lib/admin/pilot-report.ts:77 | shared:pilot-report |
| Pilot window | checklist tile label | lib/admin/pilot-report.ts:80 | shared:pilot-report |
| 60-90 days | checklist tile target | lib/admin/pilot-report.ts:81 | shared:pilot-report |
| Tracked | checklist tile value | lib/admin/pilot-report.ts:82 | shared:pilot-report |
| Self-service launch proof | checklist tile label | lib/admin/pilot-report.ts:85 | shared:pilot-report |
| QR and venue checks complete | checklist tile target | lib/admin/pilot-report.ts:86 | shared:pilot-report |
| Merchant signups | metric label | lib/admin/pilot-report.ts:91 | shared:pilot-report |
| Cards created | metric label | lib/admin/pilot-report.ts:93 | shared:pilot-report |
| QR codes created | metric label | lib/admin/pilot-report.ts:99 | shared:pilot-report |
| QR scans | metric label | lib/admin/pilot-report.ts:104 | shared:pilot-report |
| Customer joins | metric label | lib/admin/pilot-report.ts:106 | shared:pilot-report |
| Scan-to-join rate | metric label | lib/admin/pilot-report.ts:112 | shared:pilot-report |
| Stamps issued | metric label | lib/admin/pilot-report.ts:117 | shared:pilot-report |
| Second-stamp customers | metric label | lib/admin/pilot-report.ts:119 | shared:pilot-report |
| First-to-second stamp rate | metric label | lib/admin/pilot-report.ts:125 | shared:pilot-report |
| Rewards unlocked | metric label | lib/admin/pilot-report.ts:131 | shared:pilot-report |
| Rewards redeemed | metric label | lib/admin/pilot-report.ts:137 | shared:pilot-report |
| Trialing subscriptions | metric label | lib/admin/pilot-report.ts:143 | shared:pilot-report |
| Paid subscriptions | metric label | lib/admin/pilot-report.ts:149 | shared:pilot-report |
| Trial-to-paid rate | metric label | lib/admin/pilot-report.ts:155 | shared:pilot-report |
| Paid launch proof merchants | metric label | lib/admin/pilot-report.ts:161 | shared:pilot-report |
| Support actions | metric label | lib/admin/pilot-report.ts:166 | shared:pilot-report |
| Cancellation notes | metric label | lib/admin/pilot-report.ts:167 | shared:pilot-report |
| 1 per pilot merchant | metric target | lib/admin/pilot-report.ts:96, 101 | shared:pilot-report |
| Readback only | metric target | lib/admin/pilot-report.ts:104, 117, 133, 147 | shared:pilot-report |
| Scan-to-join 40%+ | metric target | lib/admin/pilot-report.ts:109 | shared:pilot-report |
| 40%+ | metric target | lib/admin/pilot-report.ts:115 | shared:pilot-report |
| First-to-second 25%+ | metric target | lib/admin/pilot-report.ts:122 | shared:pilot-report |
| 25%+ | metric target | lib/admin/pilot-report.ts:128 | shared:pilot-report |
| Low dispute rate | metric target | lib/admin/pilot-report.ts:140 | shared:pilot-report |
| Trial-to-paid 40-60% | metric target | lib/admin/pilot-report.ts:152 | shared:pilot-report |
| 40-60% | metric target | lib/admin/pilot-report.ts:158 | shared:pilot-report |
| At least 1 test merchant | metric target | lib/admin/pilot-report.ts:164 | shared:pilot-report |
| <2 per merchant/month | metric target | lib/admin/pilot-report.ts:166 | shared:pilot-report |
| Reasons captured | metric target | lib/admin/pilot-report.ts:170 | shared:pilot-report |
| 10-20 | metric target | lib/admin/pilot-report.ts:91 | shared:pilot-report |

## Admin — Privacy support (page) — `app/admin/privacy/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Privacy support | route title | app/admin/privacy/page.tsx:19 | inline |
| Internal admin | eyebrow | app/admin/privacy/page.tsx:56 | inline |
| Privacy support | heading | app/admin/privacy/page.tsx:56 | inline |
| Consent readback and audited support actions for privacy, export, deletion, and opt-out requests. | subhead | app/admin/privacy/page.tsx:59 | inline |

## Admin — Privacy: Data request workflow panel — `app/admin/privacy/data-request-workflow-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Data request workflow | section heading | app/admin/privacy/data-request-workflow-panel.tsx:48 | inline |
| Verify the requester outside this console, find the relevant customer and merchant row by venue or contact fragment, log the request, then handle export, deletion, or consent follow-up manually until self-service exists. | section subhead | app/admin/privacy/data-request-workflow-panel.tsx:49 | inline |
| Source: service-role admin readback | source label | app/admin/privacy/data-request-workflow-panel.tsx:50 | inline |
| Data request subject lookup | lookup form label/aria | app/admin/privacy/data-request-workflow-panel.tsx:54 | inline |
| No matching memberships | empty-state title | app/admin/privacy/data-request-workflow-panel.tsx:75 | inline |
| Adjust the venue or contact search, or clear it to see the newest memberships. | empty-state body | app/admin/privacy/data-request-workflow-panel.tsx:76 | inline |
| No privacy support rows yet | empty-state title | app/admin/privacy/data-request-workflow-panel.tsx:82 | inline |
| No customer memberships are available for privacy support yet. | empty-state body | app/admin/privacy/data-request-workflow-panel.tsx:83 | inline |
| Privacy lookup unavailable | error-state title | app/admin/privacy/data-request-workflow-panel.tsx:88 | inline |
| Merchant | card label | app/admin/privacy/data-request-workflow-panel.tsx:107 | inline |
| References | card label | app/admin/privacy/data-request-workflow-panel.tsx:111 | inline |
| Channel | form field label | app/admin/privacy/data-request-workflow-panel.tsx:142, 172 | inline |
| Email | select option | app/admin/privacy/data-request-workflow-panel.tsx:144, 174 | inline |
| SMS | select option | app/admin/privacy/data-request-workflow-panel.tsx:145 | inline |
| WhatsApp | select option | app/admin/privacy/data-request-workflow-panel.tsx:146 | inline |
| Reason | form field label | app/admin/privacy/data-request-workflow-panel.tsx:149 | inline |
| Recording… | submit pending label | app/admin/privacy/data-request-workflow-panel.tsx:152 | inline |
| Record opt-out | submit button | app/admin/privacy/data-request-workflow-panel.tsx:152 | inline |
| Request type | form field label | app/admin/privacy/data-request-workflow-panel.tsx:163 | inline |
| Access | select option | app/admin/privacy/data-request-workflow-panel.tsx:165 | inline |
| Export | select option | app/admin/privacy/data-request-workflow-panel.tsx:166 | inline |
| Deletion | select option | app/admin/privacy/data-request-workflow-panel.tsx:167 | inline |
| Rectification | select option | app/admin/privacy/data-request-workflow-panel.tsx:168 | inline |
| Consent | select option | app/admin/privacy/data-request-workflow-panel.tsx:169 | inline |
| Phone | select option | app/admin/privacy/data-request-workflow-panel.tsx:175 | inline |
| In person | select option | app/admin/privacy/data-request-workflow-panel.tsx:176 | inline |
| Other | select option | app/admin/privacy/data-request-workflow-panel.tsx:177 | inline |
| Notes | form field label | app/admin/privacy/data-request-workflow-panel.tsx:181 | inline |
| Logging… | submit pending label | app/admin/privacy/data-request-workflow-panel.tsx:184 | inline |
| Log request | submit button | app/admin/privacy/data-request-workflow-panel.tsx:185 | inline |

## Admin — Privacy: Logged requests panel — `app/admin/privacy/logged-requests-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Logged data requests | section heading | app/admin/privacy/logged-requests-panel.tsx:35 | inline |
| Recent requests from the audit trail with their age against the {30}-day response window. Exports and erasures complete at the moment they are logged. | section subhead | app/admin/privacy/logged-requests-panel.tsx:37 | inline (interpolates DATA_REQUEST_WINDOW_DAYS) |
| Source: audit_logs | source label | app/admin/privacy/logged-requests-panel.tsx:38 | inline |
| Logged data requests | aria-label | app/admin/privacy/logged-requests-panel.tsx:42 | inline |
| No data requests logged yet | empty-state title | app/admin/privacy/logged-requests-panel.tsx:47 | inline |
| Requests logged through the workflow above will appear here with their response deadline. | empty-state body | app/admin/privacy/logged-requests-panel.tsx:48 | inline |
| Data request readback unavailable | error-state title | app/admin/privacy/logged-requests-panel.tsx:54 | inline |
| overdue | status pill | app/admin/privacy/logged-requests-panel.tsx:72 | inline |
| open | status pill | app/admin/privacy/logged-requests-panel.tsx:72 | inline |
| completed | status pill | app/admin/privacy/logged-requests-panel.tsx:75 | inline |
| · via {channel} | inline metadata | app/admin/privacy/logged-requests-panel.tsx:80 | inline |
| Export completed | feed item title | app/admin/privacy/logged-requests-panel.tsx:94 | inline |
| Erasure completed | feed item title | app/admin/privacy/logged-requests-panel.tsx:95 | inline |
| {Type} request | feed item title | app/admin/privacy/logged-requests-panel.tsx:98 | inline |
| Data request | feed item title (fallback) | app/admin/privacy/logged-requests-panel.tsx:99 | inline |
| Logged today | age line | lib/admin/data-request-status.ts:38 | shared:data-request-status |
| Logged 1 day ago | age line | lib/admin/data-request-status.ts:40 | shared:data-request-status |
| Logged {n} days ago | age line | lib/admin/data-request-status.ts:41 | shared:data-request-status |
| {logged} · {n} day(s) over the 30-day window | age line (overdue) | lib/admin/data-request-status.ts:44 | shared:data-request-status |
| {logged} · {n} day(s) left of the 30-day window | age line | lib/admin/data-request-status.ts:47-49 | shared:data-request-status |

## Admin — Privacy: Consent log panel — `app/admin/privacy/consent-log-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Consent log | section heading | app/admin/privacy/consent-log-panel.tsx:33 | inline |
| Historical opt-in and opt-out records are retained as evidence. | section subhead | app/admin/privacy/consent-log-panel.tsx:34 | inline |
| Source: consent_records | source label | app/admin/privacy/consent-log-panel.tsx:35 | inline |
| Admin consent support readback | table caption | app/admin/privacy/consent-log-panel.tsx:41 | inline |
| No consent records yet | empty-state title | app/admin/privacy/consent-log-panel.tsx:51 | inline |
| Merchant | card label / table header / fallback | app/admin/privacy/consent-log-panel.tsx:67, 99, 103 | inline |
| Channel | card label / table header | app/admin/privacy/consent-log-panel.tsx:70, 117 | inline |
| Policy | card label / table header | app/admin/privacy/consent-log-panel.tsx:71, 128 | inline |
| When | card label / table header | app/admin/privacy/consent-log-panel.tsx:73, 133 | inline |
| Source | card label / table header | app/admin/privacy/consent-log-panel.tsx:82, 121 | inline |
| Source: {source} | source label (row) | app/admin/privacy/consent-log-panel.tsx:83, 124 | inline |
| Customer | table header | app/admin/privacy/consent-log-panel.tsx:92 | inline |
| Status | table header | app/admin/privacy/consent-log-panel.tsx:107 | inline |
| Consent record pages | pagination nav label | app/admin/privacy/consent-log-panel.tsx:150 | inline |
| consent records | pagination unit | app/admin/privacy/consent-log-panel.tsx:151 | inline |
| Consent readback unavailable | error-state title | app/admin/privacy/consent-log-panel.tsx:159 | inline |

## Admin — Merchants — `app/admin/merchants/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Admin — Merchants | route title | app/admin/merchants/page.tsx:31 | inline |
| Internal admin | eyebrow | app/admin/merchants/page.tsx:66 | inline |
| Merchants | heading | app/admin/merchants/page.tsx:66 | inline |
| Merchant account, plan status, and QR support controls. | subhead | app/admin/merchants/page.tsx:67 | inline |
| Members | cross-link | app/admin/merchants/page.tsx:97 | inline |
| Billing | cross-link | app/admin/merchants/page.tsx:100 | inline |
| Privacy | cross-link | app/admin/merchants/page.tsx:106 | inline |
| QR records | cross-link | app/admin/merchants/page.tsx:111 | inline |
| Merchant accounts | section heading | app/admin/merchants/page.tsx:126 | inline |
| Service-role admin readback of account status and billing joins. | section subhead | app/admin/merchants/page.tsx:127 | inline |
| Source: service-role admin readback | source label | app/admin/merchants/page.tsx:129 | inline |
| Admin merchant account readback | table caption | app/admin/merchants/page.tsx:134 | inline |
| No merchants yet | empty-state title | app/admin/merchants/page.tsx:143 | inline |
| Merchant accounts will appear once onboarding creates records. | empty-state body | app/admin/merchants/page.tsx:144 | inline |
| Merchant | table header | app/admin/merchants/page.tsx:151 | inline |
| Email | table header / card label | app/admin/merchants/page.tsx:163, 218 | inline |
| Account | table header | app/admin/merchants/page.tsx:171 | inline |
| Billing | table header | app/admin/merchants/page.tsx:179 | inline |
| Created | table header / card label | app/admin/merchants/page.tsx:189, 223 | inline |
| Links | card label | app/admin/merchants/page.tsx:220 | inline |
| QR records | section heading | app/admin/merchants/page.tsx:244 | inline |
| Audited QR activation and regeneration controls. Reasons are required before mutation. | section subhead | app/admin/merchants/page.tsx:245 | inline |
| Source: service-role admin readback | source label | app/admin/merchants/page.tsx:246 | inline |
| No QR records yet | empty-state title | app/admin/merchants/page.tsx:256 | inline |
| active | status pill | app/admin/merchants/page.tsx:273 | inline |
| inactive | status pill | app/admin/merchants/page.tsx:273 | inline |
| Merchant | card label / fallback value | app/admin/merchants/page.tsx:278, 279 | inline |
| Created | card label | app/admin/merchants/page.tsx:281 | inline |
| Reason | form field label | app/admin/merchants/page.tsx:311, 336 | inline |
| Disabling stops scans immediately; the QR can be re-enabled later. | field helper | app/admin/merchants/page.tsx:316 | inline |
| Enabling… | submit pending label | app/admin/merchants/page.tsx:322 | inline |
| Disabling… | submit pending label | app/admin/merchants/page.tsx:322 | inline |
| Enable QR | submit button | app/admin/merchants/page.tsx:326 | inline |
| Disable QR | submit button | app/admin/merchants/page.tsx:326 | inline |
| Regenerating invalidates the QR on the current printed poster; the venue must reprint before customers can scan again. The action is written to the audit log. | field helper | app/admin/merchants/page.tsx:338 | inline |
| I understand the current printed poster QR will stop working. | confirm-check label | app/admin/merchants/page.tsx:342 | inline |
| Regenerating… | submit pending label | app/admin/merchants/page.tsx:343 | inline |
| Regenerate QR | submit button | app/admin/merchants/page.tsx:345 | inline |

## Admin components — `components/admin/action-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| {state.message} (renders action success text) | success banner | components/admin/action-form.tsx:53 | inline (message from actions.ts) |
| {state.message} (renders action error text) | error alert | components/admin/action-form.tsx:60 | inline (message from actions.ts) |

## Admin components — `components/admin/id-chip.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| copied | inline confirmation | components/admin/id-chip.tsx:59 | inline |
| Identifier copied to clipboard | sr-only live region | components/admin/id-chip.tsx:61 | inline |

## Admin components — `components/admin/lookup-controls.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Member lookup | form aria-label (default) | components/admin/lookup-controls.tsx:24 | inline |
| Venue | field label | components/admin/lookup-controls.tsx:39 | inline |
| Business name | input placeholder | components/admin/lookup-controls.tsx:44 | inline |
| Member contact | field label | components/admin/lookup-controls.tsx:48 | inline |
| Email or phone fragment | input placeholder | components/admin/lookup-controls.tsx:53 | inline |
| Search | submit button | components/admin/lookup-controls.tsx:59 | inline |
| Clear | link button | components/admin/lookup-controls.tsx:64 | inline |
| {n} {unit} | pagination summary | components/admin/lookup-controls.tsx:95-99 | inline |
| {n} {unit} · page {n} of {n} | pagination summary | components/admin/lookup-controls.tsx:108-119 | inline |
| Previous | pagination button | components/admin/lookup-controls.tsx:126, 130 | inline |
| Next | pagination button | components/admin/lookup-controls.tsx:136, 140 | inline |
| The lookup could not be loaded safely. Adjust the search or retry; other console panels stay available. | error-state default body | components/admin/lookup-controls.tsx:163-164 | inline |

## Admin components — `components/admin/record-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| _(no hardcoded user-facing copy; all labels/values passed in as props)_ | — | components/admin/record-card.tsx | — |

## Admin components — `components/admin/support.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| - | empty-value fallback (dates) | components/admin/support.tsx:161, 166 | inline |
| Customer | masked-contact fallback | components/admin/support.tsx:176 | inline |

## Public merchant storefront — Terms — `app/merchant/[merchantSlug]/terms/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue loyalty terms \| Nabaperks | route title | app/merchant/[merchantSlug]/terms/page.tsx:12 | inline |
| Venue-specific loyalty terms for Nabaperks rewards — earning rules, redemption, exclusions, and venue contact details. | route description (meta) | app/merchant/[merchantSlug]/terms/page.tsx:13-14 | inline |
| Reward terms | eyebrow | app/merchant/[merchantSlug]/terms/page.tsx:47 | inline |
| {business_name} loyalty terms | heading | app/merchant/[merchantSlug]/terms/page.tsx:49 | inline |
| These loyalty terms are shown before you join and stay available any time from your loyalty card. | subhead | app/merchant/[merchantSlug]/terms/page.tsx:52-54 | inline |
| Reward | term label | app/merchant/[merchantSlug]/terms/page.tsx:59 | inline |
| A mystery reward is assigned from the venue reward pool when the customer earns the final visit stamp. | term value | app/merchant/[merchantSlug]/terms/page.tsx:60 | inline |
| Earning rule | term label | app/merchant/[merchantSlug]/terms/page.tsx:63 | inline |
| Collect {n} visit stamps from the venue QR. One stamp may be issued per UK date. | term value | app/merchant/[merchantSlug]/terms/page.tsx:64 | inline |
| Stamps needed | term label | app/merchant/[merchantSlug]/terms/page.tsx:67 | inline |
| {n} stamps | term value | app/merchant/[merchantSlug]/terms/page.tsx:68 | inline |
| Redemption | term label | app/merchant/[merchantSlug]/terms/page.tsx:71 | inline |
| The assigned reward can be collected from the next UK business day after it is revealed. Show your reward QR at the counter and the venue team scans it to collect. | term value | app/merchant/[merchantSlug]/terms/page.tsx:72 | inline |
| Exclusions | term label | app/merchant/[merchantSlug]/terms/page.tsx:75 | inline |
| No additional exclusions configured. | term value (fallback) | app/merchant/[merchantSlug]/terms/page.tsx:77 | inline |
| Fraud and abuse | term label | app/merchant/[merchantSlug]/terms/page.tsx:81 | inline |
| The merchant may refuse, cancel, or adjust stamps and rewards where abuse, duplicate claims, QR misuse, or location anomalies are suspected. | term value | app/merchant/[merchantSlug]/terms/page.tsx:82 | inline |
| Merchant contact | term label | app/merchant/[merchantSlug]/terms/page.tsx:85 | inline |
| Ask the venue team | term value (fallback) | app/merchant/[merchantSlug]/terms/page.tsx:86 | inline |
| Close | button/link | app/merchant/[merchantSlug]/terms/page.tsx:92 | inline |
| Privacy notice | button/link | app/merchant/[merchantSlug]/terms/page.tsx:95 | inline |
| Terms unavailable | status-banner title | app/merchant/[merchantSlug]/terms/page.tsx:107 | inline |
| Ask the venue team for the current loyalty QR before joining. | status-banner body | app/merchant/[merchantSlug]/terms/page.tsx:108 | inline |

## Public merchant storefront — Terms loading — `app/merchant/[merchantSlug]/terms/loading.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading venue terms | loading aria-label | app/merchant/[merchantSlug]/terms/loading.tsx:16 | inline |

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Reason (form field label) | 6 (customers, rewards, privacy opt-out, merchants x2) |
| Notes | 2 (pilot, privacy) |
| Channel | 2 select field labels (privacy) |
| Email | 3 (billing card label + 2 privacy select options) |
| Merchant (table header / card label / fallback) | ~10 across audit, billing, customers, fraud, privacy, pilot |
| Customer (table header / fallback) | ~4 |
| Created | 3 (customers, merchants, rewards) |
| When | ~6 (audit, fraud, consent, redemption) |
| Status | 3 (billing, fraud, consent) |
| Source / Source: {x} | ~15 SourceLabel usages across all admin pages |
| Saving… (submit pending) | 3 (fraud, pilot, + fraud dismiss) |
| Previous / Next | 2 each (lookup pagination) |
| Search / Clear | 1 each (lookup controls) |
| Audited action | 2 (customers memberships + rewards table headers) |
| Internal admin (eyebrow) | 7 (every admin page + layout) |
| Close | 1 (merchant terms) |

## Scope notes / surprises
- **Storefront ↔ customer overlap (flagged per instructions):** `app/merchant/[merchantSlug]/terms/` is a public, customer-VISIBLE storefront page (rendered inside `CustomerShell`, not the merchant admin shell). Its "Terms unavailable" / "Ask the venue team for the current loyalty QR before joining." fallback reuses `StatusBanner` and the shared `UnavailableRecoveryActions` component, and it pulls merchant/card data via `getMerchantJoinContext` — the same join-flow module the customer `/m/[slug]` join page uses. The "Close" button links back to `/m/{slug}` (customer join). The terms body copy (earning rule, "A mystery reward is assigned…", redemption, fraud & abuse) is very likely duplicated/paraphrased on the customer join flow — worth cross-checking against Agent B's customer-app inventory. `reward_terms` and stamp counts here are merchant-configured DB values (not static copy).
- **`shared:` sources feeding admin pages:** admin nav labels (Overview/Pilot/Merchants/Customers/Billing/Privacy/Fraud/Audit) come from `components/layout/console-nav.ts`; the AdminShell chrome (logo "Nabaperks Admin", footer tags "Service-role readbacks"/"Audited support actions"/"MFA-aware access"/"Admin verified"/"AAL2 verified", "Operator: {email}", and the "MFA enforcement is enabled for this admin session." banner) come from `components/layout/admin-shell.tsx`. Access-denied reasons ("Internal admin access is required." / "Admin MFA verification is required.") resolve from `lib/admin/auth.ts`. Pilot checklist/metric labels+targets+values ("10-20 merchants", "30 days free, then GBP 29/mo", "Configured", "Tracked", etc.) resolve from `lib/admin/pilot-report.ts`. Billing status pill labels ("Active"/"Trial"/"Trialing"/"Past due"/"Incomplete"/"Cancelled"/"Suspended"/"No billing record") from `lib/admin/billing-redaction.ts`; "No plan" plan fallback from `lib/admin/billing-data.ts`. Logged-request age lines ("Logged today", "Logged {n} days ago", "{logged} · {n} days left of the 30-day window", overdue variant) from `lib/admin/data-request-status.ts`.
- **Within-slice duplication:** the empty-state pair "No matching memberships" + "Adjust the venue or contact search, or clear it to see the newest memberships." appears verbatim in BOTH the customers memberships panel and the privacy data-request-workflow panel. "Source: service-role admin readback" repeats across ~6 panels. Every audited-action success string shares the tail "Logged to the audit trail." and every RPC-failure string shares the tail "Try again or review audit logs." "Operator reason is required." repeats for 6 different actions. The `first()` / `maskAdminContact()` "Merchant" and "Customer" fallbacks repeat across almost every table.
- **Internal / operator-facing terminology (not customer copy):** the entire admin console is internal-only ("Internal admin", "Restricted support views and audited manual actions.", raw source-table names surfaced as visible `SourceLabel` chips like "Source: product_events", "Source: audit_logs", "Source: billing_customers", "Source: consent_records"). These are deliberately internal but ARE rendered on screen, so captured as copy.
- **No placeholder / TODO / lorem copy** found anywhere in this slice. No `app/dev/**` harness within these paths (nearest dev harness for admin lives elsewhere — none present under app/admin, app/merchant). Two input placeholders exist and are real UX copy, not lorem: "1-3" (setup minutes) and "What happened, source, and next action" (pilot notes textarea); plus lookup placeholders "Business name" and "Email or phone fragment".
- **Interpolated numerics recorded with braces** ({n}, {date}, {ref}, {email}, {source}, {channel}) where a data value is spliced into a sentence; the surrounding static words are the copy under audit.
- `components/admin/record-card.tsx` contains NO hardcoded copy — it is a pure presentational shell; all labels/titles/values arrive as props from the calling pages (already inventoried at their call sites).



<hr>

# ▓ SURFACE: Customer App (PWA + flows)

# Copy Inventory — Customer App (PWA + flows)

_Scope: app/home/**, app/card/**, app/claim/**, app/reward/**, app/scan/**, app/r/**, app/q/**, app/m/**, app/auth/confirm/**, components/customer/**, components/loyalty/**, components/pwa/**, lib/customer/experience/copy.ts (+ referenced pure copy helpers under lib/customer/**)._

Note on sourcing: `shared:copy.ts` = strings resolved from `lib/customer/experience/copy.ts`. `inline` = hardcoded in the file cited. Several other pure helper modules under `lib/customer/**` (not `copy.ts`) also emit user-facing strings; these are tagged `inline` at the helper's own file:line, and the consuming component is noted.

---

## Shared copy module — `lib/customer/experience/copy.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You scanned the venue QR | list item | lib/customer/experience/copy.ts:38 | inline |
| Save the card to your number with one text, no app | list item | lib/customer/experience/copy.ts:39 | inline |
| Accept the terms and your first stamp prints onto the card | list item | lib/customer/experience/copy.ts:40 | inline |
| How it works | label | lib/customer/experience/copy.ts:43 | inline |
| Already have a card? Use your number and we'll find it. | link/body | lib/customer/experience/copy.ts:46 | inline |
| We'll send a one-time code by text. | helper | lib/customer/experience/copy.ts:50 | inline |
| See how stamps and rewards work | link label | lib/customer/experience/copy.ts:53 | inline |
| 1 stamp unlocks a mystery reward | body (fn) | lib/customer/experience/copy.ts:59 | inline |
| {n} stamps unlock a mystery reward | body (fn) | lib/customer/experience/copy.ts:60 | inline |
| It's yours from {date}. | body (fn) | lib/customer/experience/copy.ts:70 | inline |
| It's yours from the next opening day. | body (fn) | lib/customer/experience/copy.ts:72 | inline |
| Venue QR scanned | eyebrow | lib/customer/experience/copy.ts:85 | inline |
| Keep your card on your phone | headline | lib/customer/experience/copy.ts:86 | inline |
| One text saves {merchant}'s card to your number. New here? Your first stamp lands when you accept the terms. | support line | lib/customer/experience/copy.ts:87 | inline |
| Get today's stamp | CTA label | lib/customer/experience/copy.ts:89 | inline |
| One text, no password | eyebrow | lib/customer/experience/copy.ts:94 | inline |
| Save your card to your number | headline | lib/customer/experience/copy.ts:95 | inline |
| Save {merchant}'s card to your number, {n stamps unlock a mystery reward}. | support line | lib/customer/experience/copy.ts:96 | inline |
| Check your texts | eyebrow | lib/customer/experience/copy.ts:100 | inline |
| Enter your code | headline | lib/customer/experience/copy.ts:101 | inline |
| We sent a one-time code to your phone. | support line | lib/customer/experience/copy.ts:102 | inline |
| Last step | eyebrow | lib/customer/experience/copy.ts:105 | inline |
| Collect your first stamp | headline | lib/customer/experience/copy.ts:106 | inline |
| Accept the loyalty terms and we'll print stamp one onto your card. | support line | lib/customer/experience/copy.ts:108 | inline |
| Welcome back | eyebrow | lib/customer/experience/copy.ts:113 | inline |
| You're already joined | headline | lib/customer/experience/copy.ts:114 | inline |
| {current} of {total} stamps collected. | support line | lib/customer/experience/copy.ts:115 | inline |
| Open your stamp card | CTA label | lib/customer/experience/copy.ts:117 | inline |
| Today's stamp | eyebrow | lib/customer/experience/copy.ts:124,132 | inline |
| Stamp it here | headline | lib/customer/experience/copy.ts:125 | inline |
| You're stamped for today | headline | lib/customer/experience/copy.ts:132 | inline |
| Come back tomorrow to keep building your card. | support line | lib/customer/experience/copy.ts:133 | inline |
| View card | CTA label | lib/customer/experience/copy.ts:135 | inline |
| Reward collected | eyebrow | lib/customer/experience/copy.ts:146 | inline |
| Your reward has been collected. | support line | lib/customer/experience/copy.ts:148 | inline |
| Back to card | CTA label | lib/customer/experience/copy.ts:150 | inline |
| Welcome to {merchant} | headline | lib/customer/experience/copy.ts:167 | inline |
| Reward | eyebrow | lib/customer/experience/copy.ts:182 | inline |
| {merchant} — show this at the counter. | support line | lib/customer/experience/copy.ts:186 | inline |
| Unlocked — yours from {date}. | body (fn) | lib/customer/experience/copy.ts:192 | inline |
| Unlocked — yours from the next opening day. | body (fn) | lib/customer/experience/copy.ts:194 | inline |
| Nabaperks loyalty | eyebrow | lib/customer/experience/copy.ts:201 | inline |
| Card unavailable | headline | lib/customer/experience/copy.ts:202 | inline |
| Open my cards | CTA label | lib/customer/experience/copy.ts:205 | inline |

---

## Home dashboard — `app/home/(authed)/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks | metadata.title | app/home/(authed)/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/page.tsx:27 | inline |
| Your cards | h1/title | app/home/(authed)/page.tsx:28 | inline |
| Every card you've collected. Tap one to see its stamps and rewards. | description | app/home/(authed)/page.tsx:29 | inline |

## Home activity — `app/home/(authed)/activity/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your activity · Nabaperks | metadata.title | app/home/(authed)/activity/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/activity/page.tsx:31 | inline |
| Activity | title | app/home/(authed)/activity/page.tsx:32 | inline |
| Every stamp and reward across your cards, newest first. | description | app/home/(authed)/activity/page.tsx:33 | inline |
| Nothing here yet | empty title | app/home/(authed)/activity/page.tsx:38 | inline |
| Your stamps and rewards will appear here once you start visiting venues. | empty body | app/home/(authed)/activity/page.tsx:39 | inline |

_(Row item `badgeLabel`/`title`/`description` are data-derived, not static copy.)_

## Home profile — `app/home/(authed)/profile/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your details · Nabaperks | metadata.title | app/home/(authed)/profile/page.tsx:13 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/profile/page.tsx:32 | inline |
| Your details | title | app/home/(authed)/profile/page.tsx:33 | inline |
| How venues can reach you: phone, name, and optional email. | description | app/home/(authed)/profile/page.tsx:34 | inline |
| Finish your details | banner title | app/home/(authed)/profile/page.tsx:38 | inline |
| Add your name and date of birth so rewards are ready for collection. | banner body | app/home/(authed)/profile/page.tsx:39 | inline |
| venue / venues | inline label (fn) | app/home/(authed)/profile/page.tsx:25 | inline |
| Member since {monthYear} · {venueLabel} | footer line | app/home/(authed)/profile/page.tsx:59 | inline |

## Home rewards — `app/home/(authed)/rewards/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your rewards · Nabaperks | metadata.title | app/home/(authed)/rewards/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/rewards/page.tsx:23 | inline |
| Rewards | title | app/home/(authed)/rewards/page.tsx:24 | inline |
| Rewards you've earned across every venue, ready for merchant scan, on the way, and ones you've enjoyed. | description | app/home/(authed)/rewards/page.tsx:25 | inline |
| No rewards yet | empty title | app/home/(authed)/rewards/page.tsx:30 | inline |
| Keep collecting stamps. When you complete a card, the reward lands here. | empty body | app/home/(authed)/rewards/page.tsx:31 | inline |
| Ready for scan | section eyebrow | app/home/(authed)/rewards/page.tsx:38 | inline |
| Show these now | section title | app/home/(authed)/rewards/page.tsx:38 | inline |
| Coming soon | section eyebrow | app/home/(authed)/rewards/page.tsx:48 | inline |
| Almost there | section title | app/home/(authed)/rewards/page.tsx:49 | inline |
| Unlocked, but not redeemable just yet. | section desc | app/home/(authed)/rewards/page.tsx:50 | inline |
| Ready from {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:59 | inline |
| Available from the next UK business day. | note | app/home/(authed)/rewards/page.tsx:60 | inline |
| History | section eyebrow | app/home/(authed)/rewards/page.tsx:69,88 | inline |
| Redeemed | section title | app/home/(authed)/rewards/page.tsx:69 | inline |
| Redeemed {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:76 | inline |
| Redeemed. | note | app/home/(authed)/rewards/page.tsx:77 | inline |
| Expired | section title | app/home/(authed)/rewards/page.tsx:88 | inline |
| Rewards that are no longer available to scan. | section desc | app/home/(authed)/rewards/page.tsx:90 | inline |
| Expired {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:99,101 | inline |
| Expired. | note | app/home/(authed)/rewards/page.tsx:102 | inline |

## Home error boundary — `app/home/(authed)/error.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| That didn't load | error title | app/home/(authed)/error.tsx:16 | inline |
| Something interrupted this page. Try again. Your cards and stamps are safe on the server. | error body | app/home/(authed)/error.tsx:17 | inline |

## Home login page — `app/home/login/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks · sign in | metadata.title | app/home/login/page.tsx:13 | inline |
| My Nabaperks | roundel caption | app/home/login/page.tsx:40 | inline |
| Welcome back | h1 | app/home/login/page.tsx:44 | inline |
| Sign in to see every loyalty card you've collected, track your rewards, and pick up where you left off. | body | app/home/login/page.tsx:46 | inline |
| New here? Scan a venue's QR code to collect your first stamp — your first card is created automatically. | body | app/home/login/page.tsx:55 | inline |

## Home login error — `app/home/login/error.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Sign in unavailable | error title | app/home/login/error.tsx:15 | inline |
| Signing in could not be loaded safely. Your cards and stamps are safe — try again in a moment. | error body | app/home/login/error.tsx:16 | inline |
| Scan a venue QR | secondary action label | app/home/login/error.tsx:18 | inline |

## Home actions (login OTP / sign out) — `app/home/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Too many sign-in requests. Try again later. | error (form) | app/home/actions.ts:76 | inline |
| Verification code could not be sent. Try again shortly. | error (form) | app/home/actions.ts:99 | inline |
| If that number has Nabaperks cards, enter the code we sent. Otherwise scan a venue QR to join first. | message | app/home/actions.ts:107 | inline |
| Request a new phone code. | error (contact) | app/home/actions.ts:129 | inline |
| Enter the verification code. | error (otp) | app/home/actions.ts:137 | inline |
| Too many code attempts. Request a new code shortly. | error (form) | app/home/actions.ts:150 | inline |
| That code was not accepted. | error (form) | app/home/actions.ts:162 | inline |
| No cards found for that number yet. Scan a venue QR to join first. | message | app/home/actions.ts:170 | inline |

## Home profile actions — `app/home/(authed)/profile/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We couldn't save your details. Try again. | error (form) | app/home/(authed)/profile/actions.ts:73 | inline |
| We couldn't email a code to that address. Try again. | error (email) | app/home/(authed)/profile/actions.ts:93 | inline |
| Enter the code we sent to your email to confirm it. | message | app/home/(authed)/profile/actions.ts:100 | inline |
| Your details are saved. | message | app/home/(authed)/profile/actions.ts:105 | inline |
| Enter the code from your email. | error (otp) | app/home/(authed)/profile/actions.ts:113 | inline |
| We couldn't check that code. Try again. | error (form) | app/home/(authed)/profile/actions.ts:119 | inline |
| That code didn't match. Check your email and try again. | error (otp) | app/home/(authed)/profile/actions.ts:124 | inline |
| We couldn't confirm your email. Try again. | error (form) | app/home/(authed)/profile/actions.ts:133 | inline |
| Your email is confirmed. | message | app/home/(authed)/profile/actions.ts:137 | inline |
| We couldn't update that preference. | error | app/home/(authed)/profile/actions.ts:157 | inline |
| We couldn't save that preference. Try again. | error | app/home/(authed)/profile/actions.ts:167 | inline |

---

## Card route — `app/card/[membershipId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My loyalty card | metadata.title | app/card/[membershipId]/page.tsx:11 | inline |
| Today's stamp | metadata.title | app/card/[membershipId]/stamp/page.tsx:12 | inline |
| Card unavailable | error title | app/card/[membershipId]/error.tsx:15 | inline |
| This card could not be loaded safely. Ask a team member for the current loyalty QR and try again. | error body | app/card/[membershipId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/card/[membershipId]/error.tsx:18 | inline |

## Self-stamp action — `app/card/[membershipId]/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan the venue code to add your stamp. | error | app/card/[membershipId]/actions.ts:32,37 | inline |
| _(block-reason error copy resolved via `blockReasonCopy()`)_ | error | app/card/[membershipId]/actions.ts:51,55 | inline (see block-reasons.ts) |

---

## Claim reward — `app/claim/[token]/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Claim your reward · Nabaperks | metadata.title | app/claim/[token]/page.tsx:24 | inline |
| Try again shortly | shell title | app/claim/[token]/page.tsx:56 | inline |
| Too many attempts from here. Please try again in a few minutes. | body | app/claim/[token]/page.tsx:58 | inline |
| You're unsubscribed | shell title | app/claim/[token]/page.tsx:68 | inline |
| You won't get invite emails about this reward again. | body | app/claim/[token]/page.tsx:70 | inline |
| Stop these emails? | shell title | app/claim/[token]/page.tsx:78 | inline |
| We only email once about a reward, but you can stop it here. | body | app/claim/[token]/page.tsx:80 | inline |
| Stop these emails | button | app/claim/[token]/page.tsx:85 | inline |
| This reward link isn't available | shell title | app/claim/[token]/page.tsx:100 | inline |
| It may have already been claimed or expired. If a venue told you to expect a reward, ask them to send it again. | body | app/claim/[token]/page.tsx:102 | inline |
| A local venue | fallback venue name | app/claim/[token]/page.tsx:116 | inline |
| A reward is waiting for you | shell title | app/claim/[token]/page.tsx:119 | inline |
| {venue} sent you {reward_name}. Sent to {masked_hint}. | body (composed) | app/claim/[token]/page.tsx:122-127 | inline |
| a reward | fallback reward name | app/claim/[token]/page.tsx:124 | inline |
| Sign in or join Nabaperks with the same contact and it lands in your rewards automatically. | body | app/claim/[token]/page.tsx:129 | inline |
| Sign in or join to claim | button/link | app/claim/[token]/page.tsx:133 | inline |

---

## Reward route — `app/reward/[rewardId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My reward | metadata.title | app/reward/[rewardId]/page.tsx:11 | inline |
| Reward unavailable | error title | app/reward/[rewardId]/error.tsx:15 | inline |
| This reward could not be loaded safely. Return to the customer card or ask a team member for help. | error body | app/reward/[rewardId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/reward/[rewardId]/error.tsx:18 | inline |
| Reward QR not found | HTTP 404 body (see notes) | app/reward/[rewardId]/qr.png/route.ts:23 | inline |
| Reward QR not ready | HTTP 404 body (see notes) | app/reward/[rewardId]/qr.png/route.ts:34 | inline |

## Reward profile-gate actions — `app/reward/[rewardId]/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We couldn't save your details. Try again. | error (form) | app/reward/[rewardId]/actions.ts:64 | inline |
| We couldn't email a code to that address. Try again. | error (email) | app/reward/[rewardId]/actions.ts:74 | inline |
| Enter the code from your email. | error (otp) | app/reward/[rewardId]/actions.ts:93 | inline |
| We couldn't check that code. Try again. | error (form) | app/reward/[rewardId]/actions.ts:99 | inline |
| That code didn't match. Check your email and try again. | error (otp) | app/reward/[rewardId]/actions.ts:104 | inline |
| We couldn't confirm your email. Try again. | error (form) | app/reward/[rewardId]/actions.ts:113 | inline |

---

## Scan (top-level) — `app/scan/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan venue QR | metadata.title | app/scan/page.tsx:11 | inline |
| Scanner unavailable | error title | app/scan/error.tsx:15 | inline |
| The scanner could not be opened safely. Try again, or point your phone's camera at the printed venue QR. | error body | app/scan/error.tsx:16 | inline |
| Open my cards | secondary action label | app/scan/error.tsx:18 | inline |

---

## Public QR resolve — `app/q/[qrId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | metadata.title | app/q/[qrId]/page.tsx:27 | inline |
| QR unavailable | eyebrow | app/q/[qrId]/page.tsx:99,103 | inline |
| This loyalty card is unavailable | empty title | app/q/[qrId]/page.tsx:107 | inline |
| Ask a team member for the current loyalty QR. | empty body | app/q/[qrId]/page.tsx:108 | inline |
| QR busy | eyebrow/screenLabel | app/q/[qrId]/page.tsx:120,122 | inline |
| Try again shortly | eyebrow | app/q/[qrId]/page.tsx:127 | inline |
| Too many scans just now | empty title | app/q/[qrId]/page.tsx:131 | inline |
| Wait a moment, then scan the venue QR again. Your card is safe. | empty body | app/q/[qrId]/page.tsx:132 | inline |
| Open my cards | CTA label | app/q/[qrId]/page.tsx:137 | inline |
| QR unavailable | error title | app/q/[qrId]/error.tsx:15 | inline |
| This QR could not be opened safely. Try again, or ask a team member for the current loyalty QR. | error body | app/q/[qrId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/q/[qrId]/error.tsx:18 | inline |

---

## Merchant landing — `app/m/[merchantSlug]/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Collect your stamp | metadata.title | app/m/[merchantSlug]/page.tsx:23 | inline |
| No-app loyalty | eyebrow | app/m/[merchantSlug]/page.tsx:56 | inline |
| Collect your stamp | title | app/m/[merchantSlug]/page.tsx:57 | inline |
| Save {business}'s card to your number, collect {n} stamps to unseal a mystery reward. No app, no plastic. | description | app/m/[merchantSlug]/page.tsx:58 | inline |
| Mystery reward, sealed | reward title | app/m/[merchantSlug]/page.tsx:84 | inline |
| Collect {n} stamps to unseal a surprise reward, yours from the next UK business day. | reward desc | app/m/[merchantSlug]/page.tsx:88-90 | inline |
| Join rewards | button/link | app/m/[merchantSlug]/page.tsx:97 | inline |
| View reward terms | sheet trigger | app/m/[merchantSlug]/page.tsx:108 | inline |
| This loyalty card is unavailable | banner title | app/m/[merchantSlug]/page.tsx:131 | inline |
| Ask a team member for the current loyalty QR. | banner body | app/m/[merchantSlug]/page.tsx:134 | inline |
| Venue unavailable | error title | app/m/[merchantSlug]/error.tsx:15 | inline |
| This venue page could not be loaded safely. Try again, or ask a team member for the current loyalty QR. | error body | app/m/[merchantSlug]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/m/[merchantSlug]/error.tsx:18 | inline |

## Merchant join — `app/m/[merchantSlug]/join/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Keep your card | metadata.title | app/m/[merchantSlug]/join/page.tsx:11 | inline |
| Join unavailable | error title | app/m/[merchantSlug]/join/error.tsx:15 | inline |
| This step could not be loaded safely. Your stamps are safe — try again, or ask a team member for help. | error body | app/m/[merchantSlug]/join/error.tsx:16 | inline |
| Open my cards | secondary action label | app/m/[merchantSlug]/join/error.tsx:18 | inline |

## Merchant join actions — `app/m/[merchantSlug]/join/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Too many verification requests. Try again later. | error (form) | app/m/[merchantSlug]/join/actions.ts:97 | inline |
| Verification code could not be sent. Try again shortly. | error (form) | app/m/[merchantSlug]/join/actions.ts:126 | inline |
| New code sent. It can take a moment to arrive. | message | app/m/[merchantSlug]/join/actions.ts:139 | inline |
| Request a new phone code. | error (contact) | app/m/[merchantSlug]/join/actions.ts:164 | inline |
| Enter the verification code. | error (otp) | app/m/[merchantSlug]/join/actions.ts:172 | inline |
| Too many code attempts. Request a new code shortly. | error (form) | app/m/[merchantSlug]/join/actions.ts:185 | inline |
| That code was not accepted. | error (form) | app/m/[merchantSlug]/join/actions.ts:196 | inline |
| Verify your phone before joining. | error (form) | app/m/[merchantSlug]/join/actions.ts:241 | inline |
| Accept the loyalty terms to join. | error (loyaltyTerms) | app/m/[merchantSlug]/join/actions.ts:245 | inline |
| Rewards could not be joined. Try again or ask the venue team. | error (form) | app/m/[merchantSlug]/join/actions.ts:274 | inline |

_(`app/r/[token]`, `app/q/[qrId]/loading.tsx`, `app/auth/confirm/route.ts`, `app/card/.../loading.tsx`, `app/reward/.../loading.tsx`, `app/m/.../loading.tsx` render no static screen copy — redirect/skeleton/route only.)_

---

## Component: CustomerCardExperience — `components/customer/customer-card-experience.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something's under there. | reward name (sealed) | components/customer/customer-card-experience.tsx:108 | inline |
| Your reward | reward name fallback | components/customer/customer-card-experience.tsx:109 | inline |
| Mystery reward stays sealed until the final stamp. | reward desc | components/customer/customer-card-experience.tsx:130,131 | inline |
| Give it a day to breathe. {waitingRewardTiming} | reward desc (composed) | components/customer/customer-card-experience.tsx:139 | inline (+ shared:copy.ts timing) |
| Reward ready for merchant scan. | reward desc | components/customer/customer-card-experience.tsx:147 | inline |
| Your cards | back link | components/customer/customer-card-experience.tsx:167 | inline |
| That's the full card. | celebration title | components/customer/customer-card-experience.tsx:194 | inline |
| Your reward is ready, claim it at the counter while you're here. | celebration msg | components/customer/customer-card-experience.tsx:196 | inline |
| Your reward is yours from opening time on the next UK business day. | celebration msg | components/customer/customer-card-experience.tsx:197 | inline |
| Welcome to {merchant}. | banner title | components/customer/customer-card-experience.tsx:204 | inline |
| You're in, your first stamp is on the card. | banner body | components/customer/customer-card-experience.tsx:207 | inline |
| You're in. We couldn't add your first stamp just now, so scan the venue QR to collect your first stamp. | banner body | components/customer/customer-card-experience.tsx:209 | inline |
| You're in. Scan the venue QR in store to collect your first stamp. | banner body | components/customer/customer-card-experience.tsx:210 | inline |
| Stamp added. | banner title | components/customer/customer-card-experience.tsx:217 | inline |
| That's one. Your progress is saved. | banner body | components/customer/customer-card-experience.tsx:220 | inline |
| Reward redeemed. | banner title | components/customer/customer-card-experience.tsx:228 | inline |
| New stamp cycle started. | banner body | components/customer/customer-card-experience.tsx:231 | inline |
| Open reward QR | CTA (link) | components/customer/customer-card-experience.tsx:240 | inline |
| Give it a day to breathe | status title | components/customer/customer-card-experience.tsx:244 | inline |
| Stamp secured. | banner title | components/customer/customer-card-experience.tsx:250 | inline |
| Your next scan window opens on the next UK business day. | banner body | components/customer/customer-card-experience.tsx:251 | inline |
| Scan the venue code to add your stamp. | banner title | components/customer/customer-card-experience.tsx:256 | inline |
| Use the printed QR in the venue. One stamp is available per UK business day. | banner body | components/customer/customer-card-experience.tsx:259-260 | inline |
| Scan to stamp | CTA (link) | components/customer/customer-card-experience.tsx:263 | inline |
| Card details | disclosure summary | components/customer/customer-card-experience.tsx:283 | inline |
| One stamp per UK business day | dd/footer | components/customer/customer-card-experience.tsx:293 | inline |
| Something's under there. | reward name (stamp screen) | components/customer/customer-card-experience.tsx:333 | inline |
| See your reward | CTA (link) | components/customer/customer-card-experience.tsx:339 | inline |
| Back to card | CTA (link) | components/customer/customer-card-experience.tsx:344 | inline |
| Need a hand? | action-note title | components/customer/customer-card-experience.tsx:363 | inline |
| Ask a team member for the current loyalty QR, or open your cards to find them. | action-note body | components/customer/customer-card-experience.tsx:364-365 | inline |
| Stamps unavailable | status title (default) | components/customer/customer-card-experience.tsx:391 | inline |
| CARD Nº {ID} | mono card number (fn) | components/customer/customer-card-experience.tsx:405 | inline |

## Component: CustomerErrorState — `components/customer/customer-error-state.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks | venue mark name/caption | components/customer/customer-error-state.tsx:35 | inline |
| _(retry button label via `retryButtonState()` — "Try again" / "Trying again")_ | button | components/customer/customer-error-state.tsx:50 | inline (see retry-button.ts) |

## Component: CustomerFlowShell / CustomerReceipt — `components/customer/customer-flow-system.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| nabaperks | brand wordmark | components/customer/customer-flow-system.tsx:76 | inline |
| Setup | progress label (default) | components/customer/customer-flow-system.tsx:126 | inline |
| Step {step} of {total} | progress readout | components/customer/customer-flow-system.tsx:127-128 | inline |
| ONE STAMP PER BUSINESS DAY | footer right (default) | components/customer/customer-flow-system.tsx:151 | inline |

## Component: CustomerLoginForm — `components/customer/customer-login-form.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Phone number | field label | components/customer/customer-login-form.tsx:50 | inline |
| 07400 123456 | placeholder | components/customer/customer-login-form.tsx:57 | inline |
| We'll send a one-time code by text. | helper hint | components/customer/customer-login-form.tsx:77 | shared:copy.ts (JOIN_PHONE_CODE_HINT) |
| If it does not arrive, check the number and resend the code. | helper | components/customer/customer-login-form.tsx:93 | inline |
| Sending… | button (pending) | components/customer/customer-login-form.tsx:100 | inline |
| Resend code | button | components/customer/customer-login-form.tsx:102 | inline |
| Send code | button | components/customer/customer-login-form.tsx:103 | inline |
| Phone code | field label | components/customer/customer-login-form.tsx:117 | inline |
| Checking… | button (pending) | components/customer/customer-login-form.tsx:142 | inline |
| Open my cards | button | components/customer/customer-login-form.tsx:142 | inline |

## Component: CustomerQrScannerLoader (loading fallback) — `components/customer/customer-qr-scanner-loader.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Customer scanner | eyebrow | components/customer/customer-qr-scanner-loader.tsx:27 | inline |
| Scan venue QR | h1 | components/customer/customer-qr-scanner-loader.tsx:31 | inline |
| Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic. | body | components/customer/customer-qr-scanner-loader.tsx:34-35 | inline |
| Starting camera | mono status | components/customer/customer-qr-scanner-loader.tsx:51 | inline |
| Back to start | button/link | components/customer/customer-qr-scanner-loader.tsx:59 | inline |
| Open my cards | button/link | components/customer/customer-qr-scanner-loader.tsx:62 | inline |

## Component: CustomerQrScanner — `components/customer/customer-qr-scanner.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Customer scanner | eyebrow | components/customer/customer-qr-scanner.tsx:185 | inline |
| Scan venue QR | h1 | components/customer/customer-qr-scanner.tsx:187 | inline |
| Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic. | body | components/customer/customer-qr-scanner.tsx:192-193 | inline |
| Starting camera… | live status | components/customer/customer-qr-scanner.tsx:159 | inline |
| Scanning for a Nabaperks QR… | live status | components/customer/customer-qr-scanner.tsx:161 | inline |
| QR found. Opening your venue card… | live status | components/customer/customer-qr-scanner.tsx:163 | inline |
| That is not a Nabaperks QR. Point your camera at the venue QR to collect a stamp. | live status | components/customer/customer-qr-scanner.tsx:165 | inline |
| Camera unavailable | live status | components/customer/customer-qr-scanner.tsx:166 | inline |
| Try the camera again | button | components/customer/customer-qr-scanner.tsx:229 | inline |
| Back to start | button/link | components/customer/customer-qr-scanner.tsx:235 | inline |
| Open my cards | button/link | components/customer/customer-qr-scanner.tsx:238 | inline |

## Scanner guidance (secondary detail lines) — `lib/customer/scanner-guidance.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We could not open your camera. Allow camera access, then try again. Or scan the venue QR with your phone's camera app. | detail | lib/customer/scanner-guidance.ts:23 | inline |
| Point your camera at the venue QR on the table or counter. | detail | lib/customer/scanner-guidance.ts:25 | inline |

## Component: HomeActivitySnippet — `components/customer/home-activity-snippet.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Recent activity | section eyebrow | components/customer/home-activity-snippet.tsx:28 | inline |
| Latest visits | section title | components/customer/home-activity-snippet.tsx:28 | inline |
| See all activity | link | components/customer/home-activity-snippet.tsx:54 | inline |

## Component: HomeBirthdayPrompt — `components/customer/home-birthday-prompt.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Birthday treat | tag | components/customer/home-birthday-prompt.tsx:64 | inline |
| Add your birthday for a treat on us | h2 | components/customer/home-birthday-prompt.tsx:65 | inline |
| Some venues give members a reward during their birthday month. Add yours and you won't miss it. | body | components/customer/home-birthday-prompt.tsx:68-70 | inline |
| Add your birthday | button/link | components/customer/home-birthday-prompt.tsx:74 | inline |
| Not now | button | components/customer/home-birthday-prompt.tsx:77 | inline |

## Component: HomeCardTile — `components/customer/home-card-tile.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready | tag | components/customer/home-card-tile.tsx:15 | inline |
| Reward soon | tag | components/customer/home-card-tile.tsx:16 | inline |
| Ready · {date} | reward-ready label (fn) | components/customer/home-card-tile.tsx:25 | inline |
| Back next opening day | reward-ready label | components/customer/home-card-tile.tsx:26 | inline |
| Open your {business} card | aria-label | components/customer/home-card-tile.tsx:32 | inline |
| Loyalty card | eyebrow fallback | components/customer/home-card-tile.tsx:37 | inline |
| Open reward QR | tag | components/customer/home-card-tile.tsx:47 | inline |
| Open card | tag | components/customer/home-card-tile.tsx:47 | inline |
| Your reward | reward eyebrow | components/customer/home-card-tile.tsx:74 | inline |
| Your reward | reward name fallback | components/customer/home-card-tile.tsx:78 | inline |
| _(status line via `homeCardStatusCopy()`)_ | body | components/customer/home-card-tile.tsx:85 | inline (see home-dashboard.ts) |

## home-dashboard status copy — `lib/customer/home-dashboard.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready — show QR at the counter | status | lib/customer/home-dashboard.ts:31 | inline |
| This card is unavailable right now. | status fallback | lib/customer/home-dashboard.ts:33 | inline |
| Reward almost ready — back on the next opening day | status | lib/customer/home-dashboard.ts:39 | inline |
| Stamp secured for today | status | lib/customer/home-dashboard.ts:41 | inline |
| {current} of {required} stamps — {remaining} more to unlock | status | lib/customer/home-dashboard.ts:43 | inline |
| Open this card for the latest loyalty status | status fallback | lib/customer/home-dashboard.ts:45 | inline |

## Component: HomeEmptyState — `components/customer/home-empty-state.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Find the Nabaperks QR at the counter, then scan it here | list item | components/customer/home-empty-state.tsx:15 | inline |
| Save the card to your number — one text, no app | list item | components/customer/home-empty-state.tsx:16 | inline |
| Collect a stamp on every visit | list item | components/customer/home-empty-state.tsx:17 | inline |
| How it works | label | components/customer/home-empty-state.tsx:20 | inline |
| Scan a venue QR to start a card | empty title | components/customer/home-empty-state.tsx:25 | inline |
| Cards you collect live here. You don't have any yet. | empty body | components/customer/home-empty-state.tsx:26 | inline |
| Scan venue QR | button/link | components/customer/home-empty-state.tsx:45 | inline |

## Component: HomeRedeemBanner — `components/customer/home-redeem-banner.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Open reward QR for {reward} at {business} | aria-label | components/customer/home-redeem-banner.tsx:17 | inline |
| Ready for scan | tag | components/customer/home-redeem-banner.tsx:21 | inline |
| Show this QR at the counter when you are ready. | body | components/customer/home-redeem-banner.tsx:29 | inline |
| Open reward QR | mono footer | components/customer/home-redeem-banner.tsx:33 | inline |

## Component: HomeSummaryStrip — `components/customer/home-summary-strip.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| card / cards | count label (fn) | components/customer/home-summary-strip.tsx:9 | inline |
| reward ready / rewards ready | count label | components/customer/home-summary-strip.tsx:10 | inline |
| stamp today / stamps today | count label | components/customer/home-summary-strip.tsx:11 | inline |

## Component: CustomerIdentityForm / CustomerJoinForm — `components/customer/join-forms.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Phone number | field label | components/customer/join-forms.tsx:48 | inline |
| 07400 123456 | placeholder | components/customer/join-forms.tsx:57 | inline |
| We'll send a one-time code by text. | helper hint | components/customer/join-forms.tsx:74 | shared:copy.ts (JOIN_PHONE_CODE_HINT) |
| Sending… | button (pending) | components/customer/join-forms.tsx:89 | inline |
| Text me the code | button | components/customer/join-forms.tsx:89 | inline |
| Sending your code | sr-only status | components/customer/join-forms.tsx:92 | inline |
| See how stamps and rewards work | back link | components/customer/join-forms.tsx:103 | shared:copy.ts (JOIN_PHONE_BACK_LABEL) |
| Loyalty terms | eyebrow | components/customer/join-forms.tsx:149 | inline |
| Required | tag | components/customer/join-forms.tsx:150 | inline |
| I agree to keep this loyalty card and that stamps and rewards follow the {venue}, {platform} and {privacy} terms. | consent body (composed) | components/customer/join-forms.tsx:153-163 | inline |
| Marketing updates | eyebrow | components/customer/join-forms.tsx:174 | inline |
| Send me occasional offers from this business. Optional. | consent body | components/customer/join-forms.tsx:176 | inline |
| Finish here and your first stamp lands straight away — no second scan needed. | body | components/customer/join-forms.tsx:194-195 | inline |
| Stamping… | button (pending) | components/customer/join-forms.tsx:198 | inline |
| Get my first stamp | button | components/customer/join-forms.tsx:198 | inline |

## Component: CustomerOtpForm — `components/customer/join-otp-form.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Text code | field label | components/customer/join-otp-form.tsx:64 | inline |
| Enter the verification code sent to your phone. | helper hint | components/customer/join-otp-form.tsx:90 | inline |
| Checking… | submit pending label | components/customer/join-otp-form.tsx:103 | inline |
| Save my card | submit button | components/customer/join-otp-form.tsx:104 | inline |
| Sent to | label | components/customer/join-otp-form.tsx:121 | inline |
| Sending… | submit pending label | components/customer/join-otp-form.tsx:125 | inline |
| Resend code | submit button | components/customer/join-otp-form.tsx:127 | inline |
| Use a different number | link | components/customer/join-otp-form.tsx:143 | inline |

## Component: WelcomeStep — `components/customer/join-welcome-step.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Join the card | progress label | components/customer/join-welcome-step.tsx:37 | inline |
| View full venue terms | sheet trigger | components/customer/join-welcome-step.tsx:50 | inline |
| Already have a card? Use your number and we'll find it. | link | components/customer/join-welcome-step.tsx:62 | shared:copy.ts (JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL) |
| Mystery reward, sealed | reward title | components/customer/join-welcome-step.tsx:91 | inline |
| Collect {n} stamps to unlock a surprise reward, yours from the next UK business day. | reward desc | components/customer/join-welcome-step.tsx:94-96 | inline |
| How it works | label | components/customer/join-welcome-step.tsx:106 | shared:copy.ts (JOIN_WELCOME_HOW_IT_WORKS_LABEL) |
| _(3 how-it-works steps)_ | list items | components/customer/join-welcome-step.tsx:110 | shared:copy.ts (JOIN_WELCOME_HOW_IT_WORKS) |

## Component: JoinWizard — `components/customer/join-wizard.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're unlocking | eyebrow | components/customer/join-wizard.tsx:180 | inline |
| {merchant} · {card} | compound label | components/customer/join-wizard.tsx:184,216 | inline |
| _(reward hook via `joinUnlockingRewardHook()`)_ | body | components/customer/join-wizard.tsx:187 | shared:copy.ts |
| Your first stamp | eyebrow | components/customer/join-wizard.tsx:211 | inline |
| Mystery reward, sealed | reward title | components/customer/join-wizard.tsx:229,293 | inline |
| {reward hook}, yours from the next UK business day. | reward desc (composed) | components/customer/join-wizard.tsx:232-236 | inline (+ shared:copy.ts hook) |
| You're already joined | banner title | components/customer/join-wizard.tsx:256 | inline |
| Your stamp card is ready. Continue from your current progress. | banner body | components/customer/join-wizard.tsx:257 | inline |
| Your assigned reward stays hidden until the final stamp and can be redeemed from the next UK business day. | reward desc | components/customer/join-wizard.tsx:294-298 | inline |
| Join the card | progress label | components/customer/join-wizard.tsx:349 | inline |
| This loyalty card is unavailable | banner title | components/customer/join-wizard.tsx:359 | inline |
| Ask a team member for the current loyalty QR. | banner body | components/customer/join-wizard.tsx:363 | inline |

## Component: legal sheet — `components/customer/legal-sheet.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nº {docNumber} | mono doc number | components/customer/legal-sheet.tsx:80 | inline |
| platform | default trigger label | components/customer/legal-sheet.tsx:136 | inline |
| privacy | default trigger label | components/customer/legal-sheet.tsx:157 | inline |
| venue | trigger label | components/customer/legal-sheet.tsx:183 | inline |
| , (and) | consent link connectors | components/customer/legal-sheet.tsx:185,187 | inline |

_(Sheet title/description/cardTitle and all legal section bodies resolve from `lib/legal/content.ts` — OUTSIDE this slice; see Scope notes.)_

## Component: loading-skeletons — `components/customer/loading-skeletons.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| nabaperks | brand wordmark | components/customer/loading-skeletons.tsx:67 | inline |
| Loading | aria-label (role=status) | components/customer/loading-skeletons.tsx:47 | inline |
| Loading your cards | aria-label (role=status) | components/customer/loading-skeletons.tsx:262 | inline |

## Component: CustomerProfileAboutYou — `components/customer/profile-about-you.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| About you | section eyebrow | components/customer/profile-about-you.tsx:84 | inline |
| Your contact details | section title | components/customer/profile-about-you.tsx:84 | inline |
| Phone | detail label | components/customer/profile-about-you.tsx:116 | inline |
| Not set | detail value fallback | components/customer/profile-about-you.tsx:117,120,126 | inline |
| Verified | tag | components/customer/profile-about-you.tsx:118 | inline |
| Full name | detail label | components/customer/profile-about-you.tsx:120 | inline |
| Date of birth | detail label | components/customer/profile-about-you.tsx:122 | inline |
| Verified contact details are locked for account security. | body | components/customer/profile-about-you.tsx:133 | inline |
| Edit details | button | components/customer/profile-about-you.tsx:141 | inline |
| Full name | field label | components/customer/profile-about-you.tsx:164 | inline |
| Date of birth | field label | components/customer/profile-about-you.tsx:171 | inline |
| Verified email | banner title | components/customer/profile-about-you.tsx:180 | inline |
| {email} is verified and locked for account security. | banner body | components/customer/profile-about-you.tsx:181 | inline |
| Email (optional) | field label | components/customer/profile-about-you.tsx:186 | inline |
| Add one to get reward updates. We'll send a code to confirm it. | field hint | components/customer/profile-about-you.tsx:190 | inline |
| Details not saved | banner title | components/customer/profile-about-you.tsx:197 | inline |
| Saving… | button (pending) | components/customer/profile-about-you.tsx:204 | inline |
| Save changes | button | components/customer/profile-about-you.tsx:204 | inline |
| Cancel | button | components/customer/profile-about-you.tsx:212 | inline |
| Confirm your email | banner title | components/customer/profile-about-you.tsx:228 | inline |
| Enter the code we sent to {email} to verify it. | banner body | components/customer/profile-about-you.tsx:229 | inline |
| Email code | field label | components/customer/profile-about-you.tsx:235 | inline |
| Email not confirmed | banner title | components/customer/profile-about-you.tsx:262 | inline |
| Confirming… | button (pending) | components/customer/profile-about-you.tsx:268 | inline |
| Confirm email | button | components/customer/profile-about-you.tsx:268 | inline |
| Email me a new code | button | components/customer/profile-about-you.tsx:277 | inline |
| Continue without email | button | components/customer/profile-about-you.tsx:282 | inline |

## Component: profile-form-parts — `components/customer/profile-form-parts.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | detail label | components/customer/profile-form-parts.tsx:22,29,37 | inline |
| Not added | detail value | components/customer/profile-form-parts.tsx:22 | inline |
| Verified | tag | components/customer/profile-form-parts.tsx:29 | inline |
| Awaiting | tag | components/customer/profile-form-parts.tsx:39 | inline |

## Component: CustomerProfileGateForm — `components/customer/profile-gate-forms.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A few details before this one's yours | banner title | components/customer/profile-gate-forms.tsx:53 | inline |
| Add your name and date of birth before collection — you must be 18 or over. Email is optional. | banner body | components/customer/profile-gate-forms.tsx:55-56 | inline |
| Full name | field label | components/customer/profile-gate-forms.tsx:61 | inline |
| Date of birth | field label | components/customer/profile-gate-forms.tsx:68 | inline |
| Verified email | banner title | components/customer/profile-gate-forms.tsx:76 | inline |
| {email} is verified and locked for account security. | banner body | components/customer/profile-gate-forms.tsx:77 | inline |
| Email (optional) | field label | components/customer/profile-gate-forms.tsx:82 | inline |
| We'll send a code to confirm it. | field hint | components/customer/profile-gate-forms.tsx:86 | inline |
| Details not saved | banner title | components/customer/profile-gate-forms.tsx:93 | inline |
| Saving… | button (pending) | components/customer/profile-gate-forms.tsx:99 | inline |
| Save my details | button | components/customer/profile-gate-forms.tsx:99 | inline |
| Confirm your email | banner title | components/customer/profile-gate-forms.tsx:119 | inline |
| Enter the code we sent to {email} to finish your profile. | banner body | components/customer/profile-gate-forms.tsx:120-121 | inline |
| Email code | field label | components/customer/profile-gate-forms.tsx:127 | inline |
| Email not confirmed | banner title | components/customer/profile-gate-forms.tsx:152 | inline |
| Confirming… | button (pending) | components/customer/profile-gate-forms.tsx:157 | inline |
| Confirm email | button | components/customer/profile-gate-forms.tsx:157 | inline |
| Email me a new code | button | components/customer/profile-gate-forms.tsx:169 | inline |
| Continue without email | button | components/customer/profile-gate-forms.tsx:174 | inline |

## Component: CustomerProfileMarketing — `components/customer/profile-marketing-consent.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | channel label | components/customer/profile-marketing-consent.tsx:23 | inline |
| Reward updates and offers by email. | channel helper | components/customer/profile-marketing-consent.tsx:24 | inline |
| SMS | channel label | components/customer/profile-marketing-consent.tsx:28 | inline |
| Occasional offers by text message. | channel helper | components/customer/profile-marketing-consent.tsx:29 | inline |
| WhatsApp | channel label | components/customer/profile-marketing-consent.tsx:32 | inline |
| Updates and offers on WhatsApp. | channel helper | components/customer/profile-marketing-consent.tsx:33 | inline |
| Marketing | section eyebrow | components/customer/profile-marketing-consent.tsx:65 | inline |
| Updates from your venues | section title | components/customer/profile-marketing-consent.tsx:65 | inline |
| Optional. Turning these off won't affect stamps or rewards. | body | components/customer/profile-marketing-consent.tsx:67 | inline |
| You choose this when you join a venue — change it here any time. | body | components/customer/profile-marketing-consent.tsx:88 | inline |
| Receive {label} updates | sr-only label | components/customer/profile-marketing-consent.tsx:144 | inline |

## marketing-consent row state — `lib/customer/experience/marketing-consent-row.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Couldn't save — try again | live-region msg | lib/customer/experience/marketing-consent-row.ts:62 | inline |
| Saved | live-region msg | lib/customer/experience/marketing-consent-row.ts:63 | inline |

## Component: PushNotificationSettingsDisclosure — `components/customer/push-notification-settings-disclosure.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Push | section eyebrow | components/customer/push-notification-settings-disclosure.tsx:29 | inline |
| Browser notifications | section title | components/customer/push-notification-settings-disclosure.tsx:29 | inline |

## Component: PushNotificationSettings — `components/customer/push-notification-settings.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Stamps and rewards | pref label | components/customer/push-notification-settings.tsx:44 | inline |
| Card progress, reward readiness, and collection updates. | pref helper | components/customer/push-notification-settings.tsx:45 | inline |
| Reminders | pref label | components/customer/push-notification-settings.tsx:49 | inline |
| Next stamp windows and reward expiry notices. | pref helper | components/customer/push-notification-settings.tsx:50 | inline |
| Venue offers | pref label | components/customer/push-notification-settings.tsx:54 | inline |
| Only sent when your venue consent also allows it. | pref helper | components/customer/push-notification-settings.tsx:55 | inline |
| Push is on for this browser. | message | components/customer/push-notification-settings.tsx:162 | inline |
| Push could not be enabled here. | message | components/customer/push-notification-settings.tsx:166 | inline |
| Push is off for this browser. | message | components/customer/push-notification-settings.tsx:190 | inline |
| Push could not be changed here. | message | components/customer/push-notification-settings.tsx:194 | inline |
| Preference was not saved. | message | components/customer/push-notification-settings.tsx:213 | inline |
| Push | section eyebrow | components/customer/push-notification-settings.tsx:228 | inline |
| Browser notifications | section title | components/customer/push-notification-settings.tsx:228 | inline |
| Turn off push | button | components/customer/push-notification-settings.tsx:258 | inline |
| Enable push | button | components/customer/push-notification-settings.tsx:267 | inline |
| Checking this browser | status title | components/customer/push-notification-settings.tsx:327 | inline |
| Push status will appear here. | status body | components/customer/push-notification-settings.tsx:328 | inline |
| Push is not available | status title | components/customer/push-notification-settings.tsx:333 | inline |
| This browser cannot receive Nabaperks push. | status body | components/customer/push-notification-settings.tsx:334 | inline |
| Install needed | status title | components/customer/push-notification-settings.tsx:339 | inline |
| Add Nabaperks to your home screen to enable push. | status body | components/customer/push-notification-settings.tsx:340 | inline |
| Push is blocked | status title | components/customer/push-notification-settings.tsx:345 | inline |
| Change browser permission before enabling push here. | status body | components/customer/push-notification-settings.tsx:346 | inline |
| Push is on | status title | components/customer/push-notification-settings.tsx:351 | inline |
| This browser can receive loyalty updates. | status body | components/customer/push-notification-settings.tsx:352 | inline |
| Push needs attention | status title | components/customer/push-notification-settings.tsx:357 | inline |
| Try again or use this page from another browser. | status body | components/customer/push-notification-settings.tsx:358 | inline |
| Push is ready | status title | components/customer/push-notification-settings.tsx:363 | inline |
| Enable this browser for loyalty updates. | status body | components/customer/push-notification-settings.tsx:364 | inline |

## Component: RewardCollectionLive — `components/customer/reward-collection-live.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward collected. Updating your screen. | sr-only status | components/customer/reward-collection-live.tsx:104 | inline |
| Waiting for the merchant to scan your reward QR. | sr-only status | components/customer/reward-collection-live.tsx:106 | inline |

## Component: RewardCollectionQr — `components/customer/reward-collection-qr.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We could not show your reward QR | banner title | components/customer/reward-collection-qr.tsx:60 | inline |
| Pull down to refresh, or ask a team member. | banner body | components/customer/reward-collection-qr.tsx:62 | inline |
| Still not showing? You may be signed out on this phone — sign in with your number to bring it back. | banner body (composed) | components/customer/reward-collection-qr.tsx:65-74 | inline |
| sign in with your number | link text | components/customer/reward-collection-qr.tsx:72 | inline |
| Show a fresh QR | button | components/customer/reward-collection-qr.tsx:85 | inline |
| Merchant-scan QR for {rewardName} | figure aria-label | components/customer/reward-collection-qr.tsx:89 | inline |
| QR code for collecting {rewardName} | img alt | components/customer/reward-collection-qr.tsx:100 | inline |
| Merchant scans this QR from their device | body | components/customer/reward-collection-qr.tsx:115 | inline |

## Component: reward-list-cards — `components/customer/reward-list-cards.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Ready | tag | components/customer/reward-list-cards.tsx:39 | inline |
| Open reward QR | button/link | components/customer/reward-list-cards.tsx:51 | inline |

_(`No additional exclusions configured.` at line 24 is a sentinel string used to HIDE the terms text — not rendered as copy.)_

## Component: reward-panels — `components/customer/reward-panels.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | eyebrow | components/customer/reward-panels.tsx:34,60 | inline |
| Give it a day to breathe | banner title | components/customer/reward-panels.tsx:43 | inline |
| _(waiting timing via `waitingRewardTiming()`)_ | banner body | components/customer/reward-panels.tsx:44 | shared:copy.ts |
| Return to card | button/link | components/customer/reward-panels.tsx:47 | inline |
| Ready for merchant scan. | banner title | components/customer/reward-panels.tsx:73 | inline |
| Redeemed | eyebrow | components/customer/reward-panels.tsx:104 | inline |
| Reward collected. | banner title | components/customer/reward-panels.tsx:113 | inline |
| The merchant has scanned your QR. A new stamp cycle has started. | banner body | components/customer/reward-panels.tsx:114 | inline |
| CARD Nº {ID} | mono footer (fn) | components/customer/reward-panels.tsx:158 | inline |

## Component: StampCollector — `components/customer/stamp-collector.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| That's every stamp on this card. | hint | components/customer/stamp-collector.tsx:52 | inline |
| Stamp secured. Your next scan window opens on the next UK business day. | hint | components/customer/stamp-collector.tsx:54 | inline |
| Adding your stamp, keep this screen open a moment. | hint | components/customer/stamp-collector.tsx:56 | inline |
| Press and hold the stamp, or tap it, to add today's mark. | hint | components/customer/stamp-collector.tsx:58 | inline |
| You're stamped for today. Come back tomorrow. | hint | components/customer/stamp-collector.tsx:59 | inline |
| That's the full card. | celebration title | components/customer/stamp-collector.tsx:124 | inline |
| Your mystery reward is unlocked. | celebration msg | components/customer/stamp-collector.tsx:125 | inline |
| Stamp added. | banner title | components/customer/stamp-collector.tsx:130 | inline |
| That's one. Your progress is saved. | banner body | components/customer/stamp-collector.tsx:131 | inline |
| Mystery reward stays sealed until the final stamp. | reward desc | components/customer/stamp-collector.tsx:249 | inline |
| Stamp not added | banner title | components/customer/stamp-collector.tsx:277 | inline |
| If this keeps failing, ask the venue team to check today's stamp from their console. | banner body | components/customer/stamp-collector.tsx:283-284 | inline |
| This venue may try a soft location check within {n}m. Your stamp still saves if your phone cannot share location. | body | components/customer/stamp-collector.tsx:293-295 | inline |

## stamp announcement (live region) — `lib/customer/experience/stamp-announcement.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Stamp added. That's the full card, your reward is unlocked. | live-region | lib/customer/experience/stamp-announcement.ts:31 | inline |
| Stamp added. That's {current} of {total}. | live-region | lib/customer/experience/stamp-announcement.ts:32 | inline |
| Adding your stamp. | live-region | lib/customer/experience/stamp-announcement.ts:34 | inline |

## Component: StampPressButton — `components/customer/stamp-press-button.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Add today's stamp | button aria-label (default) | components/customer/stamp-press-button.tsx:83 | inline |
| Stamp added | button aria-label (secured) | components/customer/stamp-press-button.tsx:217 | inline |
| Tap, or press and hold, to add today's stamp. | sr-only hint | components/customer/stamp-press-button.tsx:257 | inline |

## Component: UnavailableRecoveryActions — `components/customer/unavailable-recovery.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan a QR | button/link | components/customer/unavailable-recovery.tsx:19 | inline |
| Open my cards | button/link | components/customer/unavailable-recovery.tsx:22 | inline |

## block reasons (stamp/redeem error copy) — `lib/customer/experience/block-reasons.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're already stamped today. Come back tomorrow. | error | lib/customer/experience/block-reasons.ts:63 | inline |
| Your reward is ready — redeem it before collecting more stamps. | error | lib/customer/experience/block-reasons.ts:65 | inline |
| This venue isn't taking stamps yet. | error | lib/customer/experience/block-reasons.ts:67 | inline |
| You're going a little fast. Wait a few minutes, then try again. | error | lib/customer/experience/block-reasons.ts:69 | inline |
| Your reward is almost ready. The venue is still finishing its reward setup, so ask a team member. | error | lib/customer/experience/block-reasons.ts:71 | inline |
| Verify your identity from the venue QR before continuing. | error | lib/customer/experience/block-reasons.ts:73 | inline |
| Add your details before collection — a name and date of birth, plus a verified email if you add one. | error | lib/customer/experience/block-reasons.ts:75 | inline |
| This loyalty programme is unavailable right now. | error | lib/customer/experience/block-reasons.ts:77 | inline |
| That didn't go through. Try again or ask the venue team. | error | lib/customer/experience/block-reasons.ts:79 | inline |

## issued-reward display badges — `lib/customer/issued-reward-display.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Birthday treat | source badge | lib/customer/issued-reward-display.ts:41 | inline |
| Sent by {business} | source badge | lib/customer/issued-reward-display.ts:43 | inline |
| Expires {date} | expiry note | lib/customer/issued-reward-display.ts:51 | inline |

## redeemed-proof line — `lib/customer/experience/redeemed-proof.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Collected {date} · {venue} | proof line | lib/customer/experience/redeemed-proof.ts:34 | inline |

## retry-button state — `lib/customer/experience/retry-button.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Trying again | retry button (pending) | lib/customer/experience/retry-button.ts:14 | inline |
| Try again | retry button | lib/customer/experience/retry-button.ts:15 | inline |

---

## components/loyalty/** (shared loyalty primitives)

### progress-track.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward progress | label (default) | components/loyalty/progress-track.tsx:8 | inline |
| {label}: {current} of {total} | aria-label | components/loyalty/progress-track.tsx:28 | inline |

### qr-frame.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scanner-safe QR code | figure aria-label (default) | components/loyalty/qr-frame.tsx:7 | inline |

### reward-celebration.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Card complete | section aria-label | components/loyalty/reward-celebration.tsx:33 | inline |

### reward-seal.tsx (default aria-labels)
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward, sealed | aria-label (sealed) | components/loyalty/reward-seal.tsx:31 | inline |
| Reward unlocked, resting until it's ready | aria-label (waiting) | components/loyalty/reward-seal.tsx:32 | inline |
| Reward ready for merchant scan | aria-label (ready) | components/loyalty/reward-seal.tsx:33 | inline |
| Reward redeemed | aria-label (redeemed) | components/loyalty/reward-seal.tsx:34 | inline |

### reward-ticket.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | kicker (sealed) | components/loyalty/reward-ticket.tsx:13 | inline |
| Your reward | kicker (waiting) | components/loyalty/reward-ticket.tsx:14 | inline |
| Your reward · ready | kicker (ready) | components/loyalty/reward-ticket.tsx:15 | inline |
| Redeemed | kicker (redeemed) | components/loyalty/reward-ticket.tsx:16 | inline |
| Sealed | stub word | components/loyalty/reward-ticket.tsx:21 | inline |
| Unlocked | stub word | components/loyalty/reward-ticket.tsx:22 | inline |
| Ready | stub word | components/loyalty/reward-ticket.tsx:23 | inline |
| Done | stub word | components/loyalty/reward-ticket.tsx:24 | inline |
| Reward | section aria-label | components/loyalty/reward-ticket.tsx:61 | inline |
| Ready · {readyDate} | mono chip | components/loyalty/reward-ticket.tsx:97 | inline |
| Redeemed | stamp overlay | components/loyalty/reward-ticket.tsx:108 | inline |

### stamp-dot.tsx (aria-labels are data-derived: `Stamp N earned/empty`, optionally `, {date}` — composed at call sites, see stamp-grid)

### stamp-grid.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | RewardChip label (default) | components/loyalty/stamp-grid.tsx:31 | inline |
| {label}, ready for merchant scan / {label}, sealed | RewardSeal aria-label (composed) | components/loyalty/stamp-grid.tsx:67 | inline |
| Ready | chip caption | components/loyalty/stamp-grid.tsx:73 | inline |
| Reward | chip caption | components/loyalty/stamp-grid.tsx:73 | inline |
| {current} of {total} stamps earned[, mystery reward at the end] | list aria-label | components/loyalty/stamp-grid.tsx:141 | inline |
| Stamp {n} earned / Stamp {n} empty | stamp dot label | components/loyalty/stamp-grid.tsx:171 | inline |

### stamp-journey-preview.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Example loyalty journey: {n} stamps then a mystery reward | list aria-label | components/loyalty/stamp-journey-preview.tsx:41 | inline |
| Stamp {n} earned / Stamp {n} empty | stamp dot label | components/loyalty/stamp-journey-preview.tsx:73 | inline |

### reward-teaser.tsx / status-banner.tsx / index.ts / use-stamp-journey-loop.ts
_No user-facing string literals (teaser is a shim; status-banner takes copy via props; the loop/index have no copy)._

---

## components/pwa/app-pwa.tsx (PWA install prompt)

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| On iPhone, open Safari's Share menu, then choose Add to Home Screen. | iOS install desc | components/pwa/app-pwa.tsx:30 | inline |
| Install Nabaperks admin | prompt title (admin) | components/pwa/app-pwa.tsx:35 | inline |
| Open support tools from your device without finding a tab. | prompt desc (admin) | components/pwa/app-pwa.tsx:36 | inline |
| Install My Nabaperks | prompt title (customer) | components/pwa/app-pwa.tsx:39 | inline |
| Keep your loyalty cards one tap from the home screen. | prompt desc (customer) | components/pwa/app-pwa.tsx:40 | inline |
| Install Nabaperks | prompt title (marketing) | components/pwa/app-pwa.tsx:43 | inline |
| Keep Nabaperks handy on this device. | prompt desc (marketing) | components/pwa/app-pwa.tsx:44 | inline |
| Install Nabaperks merchant | prompt title (merchant) | components/pwa/app-pwa.tsx:47 | inline |
| Keep the counter console ready on this device. | prompt desc (merchant) | components/pwa/app-pwa.tsx:48 | inline |
| Install Nabaperks | aside aria-label | components/pwa/app-pwa.tsx:274 | inline |
| 1. Tap Share | step chip | components/pwa/app-pwa.tsx:302 | inline |
| 2. Add to Home Screen | step chip | components/pwa/app-pwa.tsx:304 | inline |
| Not now | button | components/pwa/app-pwa.tsx:310 | inline |
| Install | button | components/pwa/app-pwa.tsx:313 | inline |

---

## Micro-labels (generic, recurring)

| Label | ~count |
|---|---|
| Open my cards | ~13 (across error boundaries, unavailable states, scanner, login form, tab-bar reachable states) |
| Back to card / Return to card | ~4 |
| Cancel | 1 (profile edit) |
| Not now | ~2 (birthday prompt, PWA install) |
| Sending… | ~3 (login, join phone, otp resend) |
| Checking… | ~2 (login verify, otp verify) |
| Confirming… | ~2 (profile email verify — home + gate) |
| Saving… | ~2 (profile save — home + gate) |
| Save changes / Save my details / Save my card | ~3 (distinct wordings) |
| Confirm email | ~2 (home + gate) |
| Email me a new code | ~2 (home + gate) |
| Continue without email | ~2 (home + gate) |
| Resend code / Send code | ~3 |
| Loading / Loading your cards | ~2 (skeleton aria-labels) |
| Scan venue QR / Scan a QR / Scan to stamp | ~5 (distinct scan CTAs) |
| Back to start | 2 (scanner + loader) |
| Open reward QR | ~5 |

---

## Scope notes / surprises

- **Copy sourced from OUTSIDE this slice (not `copy.ts`):**
  - `lib/customer/experience/copy.ts` is the named "shared copy module," but it holds only a small slice of the journey (view-model eyebrow/headline/support/CTA + join how-it-works + waiting-timing). The **bulk of customer copy is inline** in components, and a further large set lives in **other pure helper modules** under `lib/customer/**` (`block-reasons.ts`, `home-dashboard.ts`, `scanner-guidance.ts`, `stamp-announcement.ts`, `redeemed-proof.ts`, `issued-reward-display.ts`, `marketing-consent-row.ts`, `retry-button.ts`) — all tagged `inline` above at their own file:line. A consistency audit should treat these helper modules as de-facto copy sources even though they are not `copy.ts`.
  - The legal sheets (`components/customer/legal-sheet.tsx`) render titles, descriptions, `cardTitle`, doc numbers, and all section bodies from **`lib/legal/content.ts`** (venue terms / platform terms / privacy) — that file is outside this slice's paths and was not inventoried here. Only the sheet trigger labels ("venue", "platform", "privacy", "View reward terms", "View full venue terms") and connectors are inline.

- **Within-slice duplication (candidates for the cross-surface audit):**
  - "Ask a team member for the current loyalty QR." appears verbatim in `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/page.tsx`, and `components/customer/join-wizard.tsx` (and near-variants in every error boundary).
  - "This loyalty card is unavailable" — `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/page.tsx`, `join-wizard.tsx`. Note `home-dashboard.ts` uses the slightly different "This card is unavailable right now."
  - "Mystery reward, sealed" — `app/m/[merchantSlug]/page.tsx`, `join-welcome-step.tsx`, `join-wizard.tsx` (×2). `reward-seal.tsx` default label is the near-identical "Mystery reward, sealed" and `reward-ticket.tsx` kicker is "Mystery reward".
  - "Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic." duplicated between the scanner loader fallback and the live scanner (intentional, per CUS-P2-11 comment — flagged for awareness only).
  - "Open reward QR" appears as a tag, mono footer, and button/link across home-card-tile, home-redeem-banner, reward-list-cards, and customer-card-experience.
  - "That's one. Your progress is saved." and "Stamp added." appear in both `customer-card-experience.tsx` and `stamp-collector.tsx`.
  - "Give it a day to breathe" appears in `customer-card-experience.tsx` and `reward-panels.tsx`.
  - "Continue without email" / "Email me a new code" / "Confirm your email" banners are near-identical across `profile-about-you.tsx` (home) and `profile-gate-forms.tsx` (reward redeem gate); the reward-gate variant adds "you must be 18 or over."
  - The `waitingRewardTiming()` string "It's yours from …" (copy.ts) and `waitingRewardSupportLine()`/`rewardViewModel` "Unlocked — yours from …" (copy.ts) both encode the same next-opening-day timing with different wording.
  - "CARD Nº {ID}" card-number formatter is duplicated inline in `customer-card-experience.tsx:405` and `reward-panels.tsx:158`.

- **Brand naming inconsistency:** the product reads as **"Nabaperks"** / **"My Nabaperks"** throughout customer copy. The system prompt also referenced "Stampiee" — that name does NOT appear anywhere in this customer slice.

- **Non-UI / edge strings noted, not counted as screen copy:**
  - `app/reward/[rewardId]/qr.png/route.ts` returns plain-text HTTP 404 bodies "Reward QR not found" / "Reward QR not ready". These are image-endpoint responses; the visible fallback the customer actually sees is the `RewardCollectionQr` error banner. Listed in the reward-route table for completeness but they are not rendered as UI text.
  - `app/reward/[rewardId]/status/route.ts` returns only machine JSON error codes ("unauthenticated", "not_found") — not user-facing.
  - `app/home/session/reset/route.ts`, `app/r/[token]/page.tsx`, `app/auth/confirm/route.ts` are redirect-only (no copy). Note: `auth/confirm` redirects failures to `/login?error=verification`, a merchant-side route outside this slice.

- **No TODO / placeholder / lorem copy** was found in the customer slice. Comments reference spec IDs (CUS-Pn-nn / VCU-Pn-nn) but no unfinished user-facing text.

- **Dev harness (`app/dev/**`, excluded):** `reward-list-cards.tsx`'s doc comment states its cards are shared with the `/dev` home-harness; the harness reuses the real components rather than hardcoding copy, so there is no divergent harness-only customer copy to flag.



<hr>

# ▓ SURFACE: Shared UI + System + Notifications

# Copy Inventory — Shared UI + System + Notifications

_Scope: components/{ui,forms,layout,motion,data,auth}/**; app/{offline,error.tsx,not-found.tsx,global-error.tsx,manifest.ts}; app/api/auth/hooks/{send-email,send-sms}; app/api/cron/{birthday-rewards,merchant-digest,notifications,privacy-retention}; app/api/notifications/**; lib/notifications/**_

---

## Shared UI primitives — `components/ui/**`

Most `components/ui/*` files are pure primitives/wrappers that render only `children` with no baked-in words (button, badge, card, alert, label, input, textarea, progress, separator, skeleton, table, field, empty, sonner). The only baked-in strings are accessibility labels on icon controls.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading | aria-label | components/ui/spinner.tsx:22 | inline |
| Close | sr-only btn label | components/ui/sheet.tsx:80 | inline |
| Sidebar | sr-only sheet title | components/ui/sidebar.tsx:158 | inline |
| Displays the mobile sidebar. | sr-only sheet desc | components/ui/sidebar.tsx:159 | inline |
| Toggle Sidebar | sr-only btn label | components/ui/sidebar.tsx:217 | inline |
| useSidebar must be used within a SidebarProvider. | dev error (thrown) | components/ui/sidebar.tsx:46 | inline |

_Note: sonner.tsx (Toaster) carries NO default toast text — it only themes icons; all toast copy is passed by callers on other surfaces. empty/alert/field render caller-supplied children only._

## Shared forms — `components/forms/**`

No user-visible baked-in copy. `SubmitButton` renders caller-supplied `children` / `pendingLabel`; `FormField`/`FormMessage`/`SelectField` render caller-supplied labels/errors. (Doc comment references example "Saving…" but it is not rendered.)

## Auth components — `components/auth/**`

### Sign-in / sign-up form — `components/auth/auth-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | field label | components/auth/auth-form.tsx:78 | inline |
| Password | field label | components/auth/auth-form.tsx:87 | inline |
| Forgot password? | link | components/auth/auth-form.tsx:99 | inline |
| Get a fresh code | link | components/auth/auth-form.tsx:114 | inline |
| Opening… | pending btn label | components/auth/auth-form.tsx:116 | inline |
| Log in | button | components/auth/auth-form.tsx:118 | inline |
| Your name | field label | components/auth/auth-form.tsx:163 | inline |
| Password saved. Enter your email code below. | inline notice | components/auth/auth-form.tsx:179 | inline |
| At least 8 characters, with letters and numbers. | field description | components/auth/auth-form.tsx:189 | inline |
| Confirm password | field label | components/auth/auth-form.tsx:194 | inline |
| Sending… | pending btn label | components/auth/auth-form.tsx:223 | inline |
| Resend code | button | components/auth/auth-form.tsx:227 | inline |
| Create account | button | components/auth/auth-form.tsx:227 | inline |
| Email code | field label | components/auth/auth-form.tsx:247 | inline |
| Checking… | pending btn label | components/auth/auth-form.tsx:260 | inline |
| Verify email | button | components/auth/auth-form.tsx:261 | inline |
| Nabaperks | brand mark name | components/auth/auth-form.tsx:275 | inline |
| New venue | VenueMark caption (sign-up) | components/auth/auth-form.tsx:276 | inline |
| Counter | VenueMark caption (sign-in) | components/auth/auth-form.tsx:276 | inline |
| Open the till | eyebrow (sign-up) | components/auth/auth-form.tsx:278 | inline |
| Back to the counter | eyebrow (sign-in) | components/auth/auth-form.tsx:278 | inline |
| Already piloting? | switch-prompt text (sign-up) | components/auth/auth-form.tsx:286 | inline |
| New venue? | switch-prompt text (sign-in) | components/auth/auth-form.tsx:286 | inline |
| Log in | switch-prompt link (sign-up) | components/auth/auth-form.tsx:288 | inline |
| Start free pilot | switch-prompt link (sign-in) | components/auth/auth-form.tsx:288 | inline |

### Reset-password form — `components/auth/reset-password-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | field label | components/auth/reset-password-form.tsx:49 | inline |
| Sending… | pending btn label | components/auth/reset-password-form.tsx:70 | inline |
| Resend reset code | button | components/auth/reset-password-form.tsx:74 | inline |
| Send reset code | button | components/auth/reset-password-form.tsx:74 | inline |
| Reset code | field label | components/auth/reset-password-form.tsx:88 | inline |
| New password | field label | components/auth/reset-password-form.tsx:99 | inline |
| At least 8 characters, with letters and numbers. | field description | components/auth/reset-password-form.tsx:102 | inline |
| Confirm new password | field label | components/auth/reset-password-form.tsx:107 | inline |
| Saving… | pending btn label | components/auth/reset-password-form.tsx:118 | inline |
| Set new password | button | components/auth/reset-password-form.tsx:120 | inline |
| Remembered it? | text | components/auth/reset-password-form.tsx:125 | inline |
| Back to log in | link | components/auth/reset-password-form.tsx:130 | inline |

_(auth-field.tsx renders caller-supplied label/description/error only — no baked copy.)_

## Layout — marketing chrome — `components/layout/marketing-layout.tsx` + `marketing-header-nav.tsx`

### Footer & skip link — `components/layout/marketing-layout.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pricing | default nav link | components/layout/marketing-layout.tsx:15 | inline |
| Log in | default nav link | components/layout/marketing-layout.tsx:16 | inline |
| Skip to content | skip link | components/layout/marketing-layout.tsx:42 | inline |
| © {year} · Marketing by choice | footer copyright | components/layout/marketing-layout.tsx:59 | inline |
| Loyalty for pubs | footer link | components/layout/marketing-layout.tsx:64 | inline |
| About | footer link | components/layout/marketing-layout.tsx:67 | inline |
| Pricing | footer link | components/layout/marketing-layout.tsx:70 | inline |
| Start free pilot | footer link | components/layout/marketing-layout.tsx:73 | inline |
| Terms | footer legal link | components/layout/marketing-layout.tsx:78 | inline |
| Privacy | footer legal link | components/layout/marketing-layout.tsx:81 | inline |
| Merchant links | nav aria-label | components/layout/marketing-layout.tsx:62 | inline |
| Legal links | nav aria-label | components/layout/marketing-layout.tsx:76 | inline |
| nabaperks | footer logo label | components/layout/marketing-layout.tsx:57 | inline |

### Header nav — `components/layout/marketing-header-nav.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Marketing | nav aria-label | components/layout/marketing-header-nav.tsx:33 | inline |
| Start free pilot | CTA button | components/layout/marketing-header-nav.tsx:59 | inline |
| Open menu | icon-btn aria-label | components/layout/marketing-header-nav.tsx:68 | inline |
| Menu | sheet title | components/layout/marketing-header-nav.tsx:78 | inline |

## Layout — console/app shells — `components/layout/*.tsx`

_Cross-cutting shells shared across merchant `/app` and `/admin`. Nav vocabulary sourced from `console-nav.ts`. NOTE: these overlap with the merchant-`/app` and admin agents' surfaces — flagged in Scope notes._

### Shared nav vocabulary — `components/layout/console-nav.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Dashboard | merchant nav label | components/layout/console-nav.ts:87 | inline |
| Setup | merchant nav label | components/layout/console-nav.ts:88 | inline |
| Poster | merchant nav label | components/layout/console-nav.ts:89 | inline |
| Members | merchant nav label | components/layout/console-nav.ts:91 | inline |
| Activity | merchant nav label | components/layout/console-nav.ts:99 | inline |
| Announce | merchant nav label | components/layout/console-nav.ts:102 | inline |
| Profile | merchant account label | components/layout/console-nav.ts:107 | inline |
| Billing | merchant account label | components/layout/console-nav.ts:111 | inline |
| Overview | admin nav label | components/layout/console-nav.ts:122 | inline |
| Pilot | admin nav label | components/layout/console-nav.ts:123 | inline |
| Merchants | admin nav label | components/layout/console-nav.ts:124 | inline |
| Customers | admin nav label | components/layout/console-nav.ts:125 | inline |
| Billing | admin nav label | components/layout/console-nav.ts:126 | inline |
| Privacy | admin nav label | components/layout/console-nav.ts:127 | inline |
| Fraud | admin nav label | components/layout/console-nav.ts:128 | inline |
| Audit | admin nav label | components/layout/console-nav.ts:129 | inline |

### Merchant app shell — `components/layout/merchant-app-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Dashboard | setup-header button | components/layout/merchant-app-shell.tsx:74 | inline |
| Account profile | icon-btn aria-label/title | components/layout/merchant-app-shell.tsx:81-82 | inline |
| Log out | btn aria-label/title (setup) | components/layout/merchant-app-shell.tsx:93-94 | inline |
| Log out | btn text (setup, ≥sm) | components/layout/merchant-app-shell.tsx:97 | inline |
| Toggle navigation | sidebar-trigger aria-label/title | components/layout/merchant-app-shell.tsx:129-130 | inline |
| Merchant navigation | nav aria-label | components/layout/merchant-app-shell.tsx:137 | shared:console-sidebar-nav (prop) |
| Account | secondary nav label | components/layout/merchant-app-shell.tsx:140 | inline |
| Log out | sidebar footer button | components/layout/merchant-app-shell.tsx:153 | inline |
| Open menu | mobile trigger aria-label | components/layout/merchant-app-shell.tsx:162 | inline |

### Admin shell — `components/layout/admin-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Service-role readbacks | footer status tag | components/layout/admin-shell.tsx:19 | inline |
| Audited support actions | footer status tag | components/layout/admin-shell.tsx:20 | inline |
| MFA-aware access | footer status tag | components/layout/admin-shell.tsx:21 | inline |
| Nabaperks Admin | logo label | components/layout/admin-shell.tsx:42 | inline |
| Admin navigation | nav aria-label | components/layout/admin-shell.tsx:46 | shared:console-sidebar-nav (prop) |
| Operator: {operatorEmail} | footer tag + title | components/layout/admin-shell.tsx:56-58 | inline |
| AAL2 verified | footer tag / title (mfa) | components/layout/admin-shell.tsx:73,77 | inline |
| Admin verified | footer tag / title (no-mfa) | components/layout/admin-shell.tsx:73,77 | inline |
| MFA enforcement is enabled for this admin session. | status banner | components/layout/admin-shell.tsx:99 | inline |

### Customer app shell + tab bar — `components/layout/customer-app-shell.tsx`, `customer-tab-bar.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Log out | header button | components/layout/customer-app-shell.tsx:24 | inline |
| Home | tab label | components/layout/customer-tab-bar.tsx:23 | inline |
| Rewards | tab label | components/layout/customer-tab-bar.tsx:24 | inline |
| Scan | tab label | components/layout/customer-tab-bar.tsx:25 | inline |
| Activity | tab label | components/layout/customer-tab-bar.tsx:26 | inline |
| Profile | tab label | components/layout/customer-tab-bar.tsx:27 | inline |
| Home navigation | nav aria-label | components/layout/customer-tab-bar.tsx:51 | inline |

### Console sidebar nav — `components/layout/console-sidebar-nav.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account | default secondaryLabel | components/layout/console-sidebar-nav.tsx:35 | inline (default param) |

_(section.tsx, contrast-band.tsx, customer-shell.tsx render children only — no baked copy.)_

## Motion — `components/motion/**`

No user-facing copy. All primitives (wet-ink.tsx, stamp-celebration.tsx, motion-provider.tsx) render caller-supplied `children` only; icons are `aria-hidden`.

## Data components — `components/data/**`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pilot funnel | default aria-label | components/data/funnel-chart.tsx:19 | inline (default param) |
| No data recorded yet. | sr-only chart summary | components/data/trend-chart.tsx:89 | inline |
| Latest: {summary}. | sr-only chart summary | components/data/trend-chart.tsx:89 | inline |
| Nothing to chart yet | empty-plot note | components/data/trend-chart.tsx:167 | inline |
| Trend chart: {labels} | svg aria-label (fallback) | components/data/trend-chart.tsx:103 | inline |
| Trend chart | svg aria-label (no series) | components/data/trend-chart.tsx:104 | inline |

_(activity-feed.tsx, data-table.tsx, sparkline.tsx, stat-strip.tsx render caller props/children only; date formatting is Intl, not copy.)_

---

## System page — Offline — `app/offline/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Offline | metadata title | app/offline/page.tsx:15 | inline |
| You're offline | h1 / EmptyState title | app/offline/page.tsx:26 | inline (prop to shared:EmptyState) |
| Your cards and stamps live safely with us. Reconnect and they will be right here. | EmptyState description | app/offline/page.tsx:27 | inline (prop to shared:EmptyState) |
| Try again | button | app/offline/page.tsx:36 | inline |
| Open my cards | button | app/offline/page.tsx:38 | inline |

_(auto-reload.tsx renders nothing — no copy.)_

## System page — Root error boundary — `app/error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something went wrong | CustomerErrorState title | app/error.tsx:22 | inline (prop to shared:CustomerErrorState) |
| This page hit a snag on our side. Nothing you saved has been lost. | CustomerErrorState desc | app/error.tsx:23 | inline (prop to shared:CustomerErrorState) |
| Nabaperks home | secondary action label | app/error.tsx:25 | inline (prop) |

## System page — Not found (404) — `app/not-found.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Page not found | metadata title | app/not-found.tsx:8 | inline |
| Page not found | EmptyState title / h1 | app/not-found.tsx:21 | inline (prop to shared:EmptyState) |
| That link has gone cold. Everything else is where you left it. | EmptyState description | app/not-found.tsx:22 | inline (prop to shared:EmptyState) |
| Nabaperks home | button | app/not-found.tsx:25 | inline |
| Open my cards | button | app/not-found.tsx:28 | inline |

## System page — Global error boundary — `app/global-error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something went wrong | h1 | app/global-error.tsx:22 | inline |
| Nabaperks hit a snag loading this page. Nothing you saved has been lost. | body | app/global-error.tsx:23-25 | inline |
| Try again | button | app/global-error.tsx:33 | inline |

## PWA manifest — `app/manifest.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks | app name | app/manifest.ts:9 | inline |
| Nabaperks | short_name | app/manifest.ts:10 | inline |
| No-app digital loyalty cards and merchant tools for UK pubs, cafes and takeaways. | description | app/manifest.ts:11-12 | inline |
| My Nabaperks | shortcut name | app/manifest.ts:45 | inline |
| Home | shortcut short_name | app/manifest.ts:46 | inline |
| Open saved loyalty cards and rewards. | shortcut description | app/manifest.ts:47 | inline |
| Scan venue QR | shortcut name | app/manifest.ts:53 | inline |
| Scan | shortcut short_name | app/manifest.ts:54 | inline |
| Scan a Nabaperks venue QR code. | shortcut description | app/manifest.ts:55 | inline |

---

## Server email — OTP codes — `lib/notifications/resend.ts`

Three audiences: `customer`, `merchant-verify`, `merchant-reset`. Each has eyebrow/title/intro/footer/subjectSuffix/textReason. Subject = `` `${code} ${subjectSuffix}` ``. Text body = `` `Your Nabaperks verification code is ${code}. Enter it to ${textReason}. It expires shortly. ${footer}` ``.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks | email eyebrow (customer) | lib/notifications/resend.ts:32 | inline |
| Your verification code | email title (customer) | lib/notifications/resend.ts:33 | inline |
| Enter this code to open your cards. It expires shortly. | email intro (customer) | lib/notifications/resend.ts:34 | inline |
| If you didn't request this, you can safely ignore this email. | email footer (customer) | lib/notifications/resend.ts:35 | inline |
| is your Nabaperks code | subject suffix (customer) | lib/notifications/resend.ts:36 | inline |
| open your Nabaperks cards | text reason (customer) | lib/notifications/resend.ts:37 | inline |
| Nabaperks merchant | email eyebrow (verify) | lib/notifications/resend.ts:40 | inline |
| Verify your venue email | email title (verify) | lib/notifications/resend.ts:41 | inline |
| Enter this code on Nabaperks to confirm your email and finish creating your venue account. | email intro (verify) | lib/notifications/resend.ts:42-43 | inline |
| If you did not start a Nabaperks venue signup, you can ignore this email. | email footer (verify) | lib/notifications/resend.ts:44-45 | inline |
| is your Nabaperks verification code | subject suffix (verify) | lib/notifications/resend.ts:46 | inline |
| confirm your Nabaperks venue email | text reason (verify) | lib/notifications/resend.ts:47 | inline |
| Nabaperks merchant | email eyebrow (reset) | lib/notifications/resend.ts:50 | inline |
| Reset your password | email title (reset) | lib/notifications/resend.ts:51 | inline |
| Enter this code on Nabaperks to set a new venue console password. | email intro (reset) | lib/notifications/resend.ts:52 | inline |
| If you did not ask to reset your password, you can ignore this email and your password stays the same. | email footer (reset) | lib/notifications/resend.ts:53-54 | inline |
| is your Nabaperks password reset code | subject suffix (reset) | lib/notifications/resend.ts:55 | inline |
| reset your Nabaperks password | text reason (reset) | lib/notifications/resend.ts:56 | inline |
| Your Nabaperks verification code is {code}. Enter it to {textReason}. It expires shortly. {footer} | email text body (all) | lib/notifications/resend.ts:106 | inline (composed) |

## Server SMS — OTP code — `lib/notifications/twilio.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your Nabaperks verification code is {code} | SMS body | lib/notifications/twilio.ts:36 | inline |

## Push notifications catalog — `lib/notifications/catalog.ts`

All push title/body pairs keyed by event type. `{businessName}` defaults to "Your venue", `{rewardName}` to "your reward".

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Notifications | push-title (prompt_viewed) | lib/notifications/catalog.ts:103 | inline |
| Notification preference opened. | push-body (prompt_viewed) | lib/notifications/catalog.ts:104 | inline |
| Notifications enabled | push-title (permission_granted) | lib/notifications/catalog.ts:107 | inline |
| Reward and stamp reminders can now reach this browser. | push-body (permission_granted) | lib/notifications/catalog.ts:108 | inline |
| Browser subscribed | push-title (subscription_created) | lib/notifications/catalog.ts:111 | inline |
| This browser can receive loyalty updates. | push-body (subscription_created) | lib/notifications/catalog.ts:112 | inline |
| Notifications off | push-title (subscription_disabled) | lib/notifications/catalog.ts:115 | inline |
| This browser will stop receiving loyalty updates. | push-body (subscription_disabled) | lib/notifications/catalog.ts:116 | inline |
| Notifications unavailable | push-title (subscription_failed) | lib/notifications/catalog.ts:119 | inline |
| This browser could not keep its push subscription active. | push-body (subscription_failed) | lib/notifications/catalog.ts:120 | inline |
| One stamp away | push-title (one_stamp_away) | lib/notifications/catalog.ts:123 | inline |
| {businessName} has a reward nearly ready. | push-body (one_stamp_away) | lib/notifications/catalog.ts:124 | inline |
| Next stamp available | push-title (next_stamp_available) | lib/notifications/catalog.ts:127 | inline |
| {businessName} can stamp your card again today. | push-body (next_stamp_available) | lib/notifications/catalog.ts:128 | inline |
| Reward unlocked | push-title (reward_unlocked_waiting) | lib/notifications/catalog.ts:131 | inline |
| {rewardName} is waiting for the next eligible collection day. | push-body (reward_unlocked_waiting) | lib/notifications/catalog.ts:132 | inline |
| Reward ready | push-title (reward_ready) | lib/notifications/catalog.ts:135 | inline |
| {rewardName} is ready to collect at {businessName}. | push-body (reward_ready) | lib/notifications/catalog.ts:136 | inline |
| Finish your details | push-title (profile_required_to_collect) | lib/notifications/catalog.ts:139 | inline |
| Complete your profile before collecting {rewardName}. | push-body (profile_required_to_collect) | lib/notifications/catalog.ts:140 | inline |
| Reward expiring soon | push-title (reward_expiring_soon) | lib/notifications/catalog.ts:143 | inline |
| {rewardName} is close to its expiry time. | push-body (reward_expiring_soon) | lib/notifications/catalog.ts:144 | inline |
| Reward expired | push-title (reward_expired) | lib/notifications/catalog.ts:147 | inline |
| {rewardName} can no longer be collected. | push-body (reward_expired) | lib/notifications/catalog.ts:148 | inline |
| Reward collected | push-title (reward_collected_cycle_started) | lib/notifications/catalog.ts:151 | inline |
| A new {businessName} stamp cycle has started. | push-body (reward_collected_cycle_started) | lib/notifications/catalog.ts:152 | inline |
| Stamp card waiting | push-title (dormant_progress) | lib/notifications/catalog.ts:155 | inline |
| {businessName} still has progress on your card. | push-body (dormant_progress) | lib/notifications/catalog.ts:156 | inline |
| {businessName} has an update. | push-body fallback (venue_announcement) | lib/notifications/catalog.ts:160 | inline |
| Birthday treat | push-title (birthday_reward_issued) | lib/notifications/catalog.ts:163 | inline |
| {rewardName} is waiting at {businessName}. | push-body (birthday_reward_issued) | lib/notifications/catalog.ts:164 | inline |
| A reward for you | push-title (merchant_reward_received) | lib/notifications/catalog.ts:167 | inline |
| {businessName} sent you {rewardName}. | push-body (merchant_reward_received) | lib/notifications/catalog.ts:168 | inline |
| Your venue | businessName default fallback | lib/notifications/catalog.ts:187 | inline |
| your reward | rewardName default fallback | lib/notifications/catalog.ts:188 | inline |

_(venue_announcement title defaults to announcementTitle || businessName; body to announcementBody || the fallback above — merchant supplies the announcement text at send time.)_
_"Your venue" / "your reward" fallbacks are duplicated in lib/notifications/events.ts:379,443,444 and delivery-worker.ts:897 — see Scope notes._

## Server email — Reward invite — `lib/notifications/reward-invite-email.ts`

`{business}` defaults to "A local venue", `{reward}` to "a reward".

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A local venue | business default fallback | lib/notifications/reward-invite-email.ts:38 | inline |
| a reward | reward default fallback | lib/notifications/reward-invite-email.ts:39 | inline |
| A reward is waiting for you at {business} | email subject | lib/notifications/reward-invite-email.ts:42 | inline |
| You're getting this one-off email because {business} entered your address to send you a reward. We won't email you again about it. | reason line (PECR) | lib/notifications/reward-invite-email.ts:43 | inline |
| {business} has sent you a reward: {reward}. | email text body line | lib/notifications/reward-invite-email.ts:46 | inline |
| Claim it: {claimUrl} | email text body line | lib/notifications/reward-invite-email.ts:48 | inline |
| Unsubscribe: {unsubscribeUrl} | email text body line | lib/notifications/reward-invite-email.ts:51 | inline |
| A reward is waiting for you | email h1 (html) | lib/notifications/reward-invite-email.ts:66 | inline |
| {business} has sent you {reward}. | email html body | lib/notifications/reward-invite-email.ts:67 | inline |
| Claim your reward | email html CTA button | lib/notifications/reward-invite-email.ts:69 | inline |
| Unsubscribe | email html link | lib/notifications/reward-invite-email.ts:70 | inline |

## Server email — Merchant weekly digest — `lib/notifications/merchant-digest-email.ts`

Subject = `` `Your week at ${businessName}` ``.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reply to this email if you'd rather not receive weekly summaries. | opt-out line | lib/notifications/merchant-digest-email.ts:31-32 | inline |
| Members | metric row label | lib/notifications/merchant-digest-email.ts:40 | inline |
| New members | metric row label | lib/notifications/merchant-digest-email.ts:43 | inline |
| Stamps issued | metric row label | lib/notifications/merchant-digest-email.ts:48 | inline |
| Repeat customers | metric row label | lib/notifications/merchant-digest-email.ts:51 | inline |
| Rewards redeemed | metric row label | lib/notifications/merchant-digest-email.ts:53 | inline |
| QR downloads | metric row label | lib/notifications/merchant-digest-email.ts:58 | inline |
| Your week at {businessName} | email subject / h1 | lib/notifications/merchant-digest-email.ts:63,84 | inline |
| Here is the short version from your Nabaperks dashboard. | email intro | lib/notifications/merchant-digest-email.ts:67,85 | inline |
| Nabaperks weekly digest | email eyebrow (html) | lib/notifications/merchant-digest-email.ts:83 | inline |

## Venue-announcement form errors — `lib/notifications/venue-announcement-form-copy.ts`

Merchant-facing validation/error copy for the announcement composer (title + body + tone).

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Daily limit reached | error title (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:11 | inline |
| Announcements can go out up to 2 a day. Try again tomorrow. | error body (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:12 | inline |
| Add a clearer title | error title (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:16 | inline |
| Use a title of at least 3 characters. | error body (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:17 | inline |
| Add a fuller message | error title (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:21 | inline |
| Use a message of at least 10 characters. | error body (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:22 | inline |
| Check the wording | error title (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:26 | inline |
| Keep it to a plain venue update without links, phone numbers, payment wording, or claims. | error body (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:27 | inline |
| Sign in again | error title (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:31 | inline |
| Sign in again before sending this announcement. | error body (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:32 | inline |
| Announcement not sent | default error title | lib/notifications/venue-announcement-form-copy.ts:38 | inline |
| We could not send this announcement. Try again in a moment. | default error body | lib/notifications/venue-announcement-form-copy.ts:39 | inline |

## Server API — hook & route error responses (JSON, not UI prose)

These are `{ error: {...} }` HTTP responses to server-to-server callers (Supabase auth hooks) — surfaced in logs/Supabase, not rendered as end-user UI. Listed for completeness.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email hook is not configured. | hook error msg | app/api/auth/hooks/send-email/route.ts:33 | inline |
| Invalid signature. | hook error msg | app/api/auth/hooks/send-email/route.ts:45 | inline |
| Malformed payload. | hook error msg | app/api/auth/hooks/send-email/route.ts:56,61 | inline |
| Missing recipient email or code. | hook error msg | app/api/auth/hooks/send-email/route.ts:67 | inline |
| Email could not be sent. | hook error msg | app/api/auth/hooks/send-email/route.ts:86 | inline |
| SMS hook is not configured. | hook error msg | app/api/auth/hooks/send-sms/route.ts:29 | inline |
| Invalid signature. | hook error msg | app/api/auth/hooks/send-sms/route.ts:41 | inline |
| Malformed payload. | hook error msg | app/api/auth/hooks/send-sms/route.ts:52,57 | inline |
| Missing recipient phone or code. | hook error msg | app/api/auth/hooks/send-sms/route.ts:63 | inline |
| SMS could not be sent. | hook error msg | app/api/auth/hooks/send-sms/route.ts:69 | inline |

_Cron + notification API routes (birthday-rewards, merchant-digest, notifications, privacy-retention, notifications/venue-announcements, notifications/readback, push/**) return only machine error codes ("unauthorized", "unauthenticated", "rate_limited", "purge_failed", validated.error passthrough) — no user-facing prose._

---

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Log out | 4 (customer-app-shell, merchant-app-shell ×3 incl. setup aria/text/footer) |
| Log in | 3 (auth-form switch prompt, marketing-layout default nav) |
| Start free pilot | 3 (marketing-header-nav CTA, marketing-layout footer, auth-form switch prompt) |
| Pricing | 2 (marketing-layout default nav + footer) |
| Try again | 2 (offline page, global-error) |
| Open my cards | 2 (offline page, not-found) |
| Nabaperks home | 2 (error.tsx, not-found) |
| Something went wrong | 2 (error.tsx, global-error) |
| Sending… | 2 (auth-form, reset-password-form) |
| Saving… | 1 rendered (reset-password-form) + doc-comment example in submit-button.tsx |
| At least 8 characters, with letters and numbers. | 2 (auth-form, reset-password-form) |
| Email | 3 (auth-form ×2, reset-password-form) |
| Password / New password / Confirm password / Confirm new password | 4 distinct labels across auth forms |
| Open menu | 2 (marketing-header-nav, merchant-app-shell mobile) |
| Close / Sidebar / Toggle Sidebar / Toggle navigation | sr-only control labels (ui + shells) |
| Account | 2 (console-sidebar-nav default + merchant-app-shell secondaryLabel) |
| Billing | 2 (merchant account nav + admin nav) |
| Customers | 1 (admin nav; also "Members" on merchant side) |
| Activity | 2 (merchant nav + customer tab bar) |
| Profile | 2 (merchant account nav + customer tab bar) |
| Loading | 1 (spinner aria-label) |

## Scope notes / surprises

- **Cross-surface duplication (biggest signal):** the notification fallbacks **"Your venue"** and **"your reward"** are hardcoded in THREE files — `catalog.ts:187-188` (canonical), `events.ts:379,443,444`, and `delivery-worker.ts:897`. Any consistency pass should treat catalog.ts as source of truth.
- **"At least 8 characters, with letters and numbers."** is duplicated verbatim in `auth-form.tsx:189` and `reset-password-form.tsx:102` — candidate for a shared constant.
- **"Start free pilot"** appears in 3 places (header CTA, footer link, sign-in switch prompt); **"Log out"** in 4 (across two shells). These are intentional per-surface CTAs but worth cross-checking casing.
- **Shell-ownership overlap:** `merchant-app-shell.tsx`, `admin-shell.tsx`, `customer-*-shell.tsx`, `customer-tab-bar.tsx`, and `console-nav.ts` live under `components/layout/**` (my slice = shared UI) but their nav vocabulary ("Dashboard/Setup/Poster/Members/Announce", admin "Pilot/Fraud/Audit", customer "Home/Rewards/Scan") is also the merchant-`/app` and admin agents' surface. Captured here as shared chrome; flag for de-dup with those agents' inventories.
- **Brand-component copy is inline-at-call-site:** system pages (`offline`, `error.tsx`, `not-found.tsx`) pass all their copy as props into shared `EmptyState` / `CustomerErrorState` components in `components/brand/**` (out of slice). The strings themselves are inline in the system-page files, so they are captured; the brand wrapper carries no baked default.
- **"Marketing by choice"** footer tagline (`marketing-layout.tsx:59`) reads as an intentional slogan, not placeholder.
- **No placeholder / lorem / TODO copy found** anywhere in scope. No "test"/dummy strings.
- **Internal/operator vocabulary (not customer-facing):** admin-shell footer tags — "Service-role readbacks", "Audited support actions", "MFA-aware access", "AAL2 verified", "Operator: …". These are operator-console labels.
- **Empty-state / chart copy:** `trend-chart.tsx` carries two visible empty-state phrasings — "Nothing to chart yet" (visible plot note) and "No data recorded yet." (sr-only). Slightly divergent wording for the same "no data" concept within one file.
- **API error strings vs UI copy:** the send-email/send-sms hooks return human-readable error prose ("Invalid signature.", "Malformed payload.", "Email could not be sent."), but they go to Supabase's hook caller, not a browser. Cron/push routes use terse machine codes only. Listed but categorized separately from display copy.
- **Dev harness (`app/dev/**`):** excluded per instructions; spot-checked — push API routes under `app/api/notifications/push/**` contain zero user-facing string literals (all machine codes), so no harness-vs-real-component copy divergence to flag there.
- **`lib/email/**` does not exist** — all email copy lives under `lib/notifications/` (resend.ts, reward-invite-email.ts, merchant-digest-email.ts).
