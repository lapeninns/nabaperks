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
