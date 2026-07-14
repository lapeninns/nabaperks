# Pilot Support Pack

Sprint: Sharpen for UK Pubs

Status: operator-support draft. This pack does not publish a case study, send
outreach, or create public claims. It gives the operator the exact assets and
approvals needed before any public case-study page or sales outreach can use the
material.

## Purpose

Support a 2-3 pub pilot readout for Lapen Inns while keeping proof honest:

- Use programme-level Nabaperks proof until venue-level figures are pulled and
  approved.
- Do not invent testimonials, named staff quotes, before/after figures, or
  venue-specific claims.
- Keep Old Crown as the first named candidate, with other venues held as
  operator-approved backups.
- Treat photography, quote approval, outreach, and scheduling as operator-owned.

## Candidate Shortlist

| Priority | Venue | Why this venue | Use now | Needs operator approval |
| --- | --- | --- | --- | --- |
| 1 | Old Crown, CB3 0QD | Best named case-study candidate from prior proof planning. Good fit for regulars, food and drink visits, and Cambridge-local story. | Candidate name only. Use programme-level stats, not venue-specific performance. | Public quote, photos, exact operating context, any venue-specific metrics. |
| 2 | The Queen Elizabeth, PE30 4EL | Food-led pub angle. Useful for roast, lunch, dinner, and family reward examples. | Backup candidate for food-led pub framing. | Quote, food photos, approval to describe the pub as food-led in Nabaperks materials. |
| 3 | White Horse, CB25 9HP | Community-local trust angle. Useful for no-app, low-friction regulars story. | Backup candidate for village/local pub framing. | Quote, bar/till photos, approval to use local-regulars language. |

Do not present these as published case studies until each venue confirms the
quote, photography, and numbers.

## Metrics To Pull

Pull metrics for each candidate over a fixed, stated window. Recommended first
window: last 90 complete days, plus all-time context where useful.

| Metric | Why it matters | Public use rule |
| --- | --- | --- |
| Loyalty members | Shows adoption. | Use per venue only after operator approval. |
| Members with 2+ visits | Shows repeat behaviour. | Prefer percentage plus raw count when approved. |
| Stamps issued | Shows counter usage. | Good internal proof; public only if context is clear. |
| Rewards earned | Shows card completion. | Pair with redeemed count to avoid inflated promise. |
| Rewards redeemed | Shows real counter collection. | Strong public proof when approved. |
| Average stamps per active member | Shows depth of usage. | Internal sales enablement unless easy to explain. |
| QR scans to joined members | Shows funnel quality. | Use carefully; QR scans can include tests and repeat scans. |
| Weekly digest receipt and send id | Proves WS-2 when live. | Do not use until real digest delivery is received. |
| Announcement push receipt | Proves WS-4 when live. | Use only after consented device proof. |

Programme-level fallback proof remains the approved June 2026 snapshot:

- 1,842 loyalty members
- 812 members visited in the last 3 months
- 1,180 rewards redeemed from 2,934 earned
- 46.8% members returned

Use the label `Nabaperks Counter-Loyalty Index, June 2026` for that fallback
proof. Do not imply the figures belong to a single venue.

## Photo Checklist

Capture real usage, not stock-style atmosphere.

| Shot | Required | Notes |
| --- | --- | --- |
| Bar or till with Nabaperks QR visible | Yes | QR must be live or a safe staging/test poster. No customer PII. |
| Staff scanning or pointing to QR | Yes | Hands/device are enough; avoid identifiable guests without release. |
| Printed poster in place | Yes | Include enough surroundings to show it works at the counter. |
| Food-led context | For Queen Elizabeth | Plate, table, or specials board without implying a specific reward unless true. |
| Regulars/local context | For Old Crown or White Horse | Keep people anonymous unless releases exist. |
| Merchant dashboard screenshot | Optional | Blur/mask PII. Use only after operator approval. |
| Digest email screenshot | WS-2 proof | Capture inbox receipt, subject, timestamp, and Resend id if available. |
| Announcement push screenshot | WS-4 proof | Capture device notification and matching server/send proof. |

Reject dark, cropped, or purely atmospheric shots. The material should prove the
product working in a pub setting.

## Testimonial Request

Use this as a no-send draft until the operator authorizes outreach.

```text
Subject: Quick Nabaperks pilot quote for [venue]

Hi [name],

Could you send us 2-3 plain lines on how Nabaperks has worked at [venue]?

Useful angles:
- whether customers understood the QR card quickly
- whether staff found stamping or reward collection easy
- whether it helped regulars come back or claim rewards
- anything that felt better than paper loyalty cards

Please avoid exact numbers unless you are happy for us to check and approve them
with the Lapen Inns team first.

If you are happy for us to use your quote, reply with:

"Approved for Nabaperks marketing: [your quote]"

We can keep the credit as "From the [venue] team" unless you want a named credit.
```

## Outreach Shortlist Criteria

Use these filters before sending any pilot outreach or case-study request:

- Venue has a real QR/poster in use, not just a seeded or demo setup.
- Venue has at least one complete reward cycle: joins, stamps, earned rewards,
  and redeemed rewards.
- Staff can describe the workflow in plain pub language.
- Operator can approve photo use and quote attribution.
- No venue-specific metric is used without a matching data pull and approval.
- Food-led examples are separated from wet-led/local-regular examples.
- The story does not depend on a feature that is not production-proven yet,
  especially weekly digest email or announcement push.

## Draft Case-Study Shape

Use this structure after the operator approves one venue.

1. Venue context: one paragraph on the pub type and trade pattern.
2. Problem: paper cards, lost stamps, counter speed, or regulars visibility.
3. Setup: QR poster, browser card, counter-verified stamp flow.
4. Proof: approved venue metrics, or programme-level proof if venue metrics are
   not approved.
5. Quote: approved venue quote only.
6. Photos: QR in place, staff workflow, and pub context.
7. Boundaries: no POS integration required, no app download, server-side
   loyalty state, provider proof status if mentioned.

## Operator-Owned Actions

These are not code tasks:

- Pick the first public candidate: recommended first pick is Old Crown.
- Approve whether Queen Elizabeth and White Horse can be backup case-study
  candidates.
- Approve who can be contacted for quotes.
- Confirm whether quotes should be anonymous venue-team credits or named staff
  credits.
- Provide or approve photos.
- Approve any venue-specific numbers before publication.
- Confirm whether outreach is internal-only, public marketing, or sales
  collateral.
- Schedule the first live digest and announcement proof collection after WS-0
  production cron/env work is complete.

## Repo Work Only If Requested

If a public case-study page is requested later, create an implementation issue
before making the change. Suggested checks include:

- `pnpm typecheck`
- `pnpm build`
- `pnpm claims:check`
- `pnpm jsonld:check`
- targeted Playwright screenshot/a11y proof for the new public route

Until then, this pack is the sprint WS-7 support deliverable and should not be
treated as a published marketing claim.
