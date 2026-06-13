# Micro-Spec: Pilot Readiness and Validation

## Exact Goal and User-Visible Outcomes

Nabaperks is ready to run a 60-90 day pilot with 10-20 UK local businesses and measure whether merchants launch, customers scan, staff use the flow, rewards redeem, and merchants are willing to pay GBP 29/month after the trial.

## Blast Radius

In scope:

- Pilot readiness checklist.
- Pilot reporting dashboard or admin report.
- Merchant setup/training materials surfaced in product where needed.
- Event and metric readback for pilot targets.
- Support workflow for pilot merchants.

Out of scope:

- Broad public launch.
- Complex sales CRM.
- Multi-region expansion plan.
- Discount ladders beyond the approved pilot offer.

## Strict Constraints and Assumptions

- Pilot size is 10-20 businesses.
- Recommended mix: 6-8 cafes, 3-5 dessert/bubble tea shops, 2-4 barbers/salons, 1-3 takeaways or quick-service food businesses.
- Pilot duration is 60-90 days.
- Pilot offer is first 30 days free, then GBP 29/month, no long-term contract.
- Product-market fit signal is merchants continuing after novelty period and agreeing to pay without heavy discounting.

## Decisions Already Made

Pilot success targets:

- Merchant setup time under 5 minutes.
- Staff training time under 3 minutes.
- QR scan to customer join conversion 40%+.
- First stamp to second stamp conversion 25%+.
- Active merchants after 30 days 70%+.
- Pilot merchants willing to pay 50%+.
- Trial-to-paid conversion 40-60%.
- Support tickets under 2 per merchant/month.
- Reward redemption disputes low.

## Behavioral Requirements

- WHEN a merchant starts pilot onboarding, THE system SHALL support setup completion in under 5 minutes.
- WHEN staff are trained, THE instructions SHALL be short enough to complete in under 3 minutes.
- WHEN staff training is timed for pilot readiness, THE admin report SHALL store the proof as a structured audited note with a 1-3 minute duration.
- WHEN pilot metrics are reviewed, THE report SHALL show launch, scan, join, repeat, redemption, support, and paid-conversion metrics.
- WHEN paid pilot proof is reviewed, THE report SHALL count only active-billing merchants that also have source-of-truth launch, join, stamp, and redemption events.
- WHEN a merchant cancels or declines payment, THE team SHALL be able to record cancellation reason or interview notes.
- WHEN reward disputes occur, THE admin console SHALL expose reward, stamp, and audit history needed for support.
- WHEN pilot results are exported or summarized, THE report SHALL distinguish source-of-truth event counts from estimates and interview notes.

## Verification Criteria

Acceptance criteria:

- End-to-end pilot path works for at least one test merchant from signup to paid billing.
- Timed staff-training proof is audited and appears in the pilot readiness checklist.
- Paid pilot proof is backed by active billing state plus product-event evidence, not a manual claim.
- Pilot metrics are backed by Supabase product events.
- Merchant-facing setup and staff instruction surfaces exist.
- Admin/support has enough readback for disputes, QR issues, consent questions, and billing state.

Manual QA:

- Time a clean merchant setup from signup to QR download.
- Time a staff training walkthrough.
- Run full customer loop: scan, join, first stamp, second stamp, reward unlock, redemption.
- Generate or view pilot metrics for the test merchant.
- Record a support scenario and verify audit/event evidence.

Task breakdown:

- Define pilot checklist.
- Add pilot reporting metrics.
- Verify full merchant/customer/staff/admin/billing loop.
- Prepare interview, timed training, payment-objection, and cancellation-reason capture.
