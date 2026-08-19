# Remaining successor certification checklist

The following 36 top-level checks remain. None is a passing result until its
acceptance criteria, manual QA, adversarial verification and cleanup receipt
are complete.

## Exact-SHA prerequisite

- [ ] Task 20A: replay and independently certify Tasks 17–20 at the selected
  successor SHA using the fail-closed controller.

## Local QA

- [ ] Task 21: DB-free and local authenticated browser matrices.
- [ ] Task 22: accessibility, visual, responsive, PWA, permission and offline QA.
- [ ] Task 23: local security, mutation, ZAP and provider-failure QA.
- [ ] Task 24: local performance, load, race and observational profiling.

## Hosted and provider work

- [ ] Task 25: hosted CI and security evidence readback.
- [ ] Task 26: separately authorised hosted workflow dispatch.
- [ ] Task 27: authenticated provider and governance readbacks.
- [ ] Task 28: hosted staging deployment and exact-revision proof.
- [ ] Task 29: hosted merchant/customer loyalty journey.
- [ ] Task 30: Stripe live/test acceptance.
- [ ] Task 31: one Twilio OTP send.
- [ ] Task 32: one Resend email.
- [ ] Task 33: one Web Push send.
- [ ] Task 34: one cron invocation.
- [ ] Task 35: one hosted auth-hook invocation.
- [ ] Task 36: one PostHog capture.
- [ ] Task 37: exact-window SLO readback.
- [ ] Task 38: paging and incident-state changes.
- [ ] Task 39: physical-backup metadata readback.
- [ ] Task 40: isolated physical-backup restore.
- [ ] Task 41: restored-target deletion.

Tasks 25–41 require the relevant credentials and any separate authority named
by the original plan. Do not infer approval for provider writes, paid sends,
paging, restores or deletion from this branch.

## Evidence and lifecycle closure

- [ ] Task 42: Task-26/Task-39 lifecycle preservation and owned-resource cleanup.
- [ ] Task 43: original Task 1–40 coverage reconciliation at the successor SHA.
- [ ] Task 44: evidence integrity, typed provenance and redacted PII disposition.

## Reviews and final verdict

- [ ] Task 45: goal and constraint review.
- [ ] Task 46: hands-on QA review.
- [ ] Task 47: code-quality review.
- [ ] Task 48: security review.
- [ ] Task 49: context and provenance review.
- [ ] Task 50: hypothesis-driven Node and Next.js runtime debugging audit.
- [ ] Task 51: successor certification verdict and handoff.
- [ ] F1: plan compliance audit.
- [ ] F2: code quality review.
- [ ] F3: real manual QA.
- [ ] F4: scope fidelity.

Recommended order: Task 20A, Tasks 21–24, authorised Tasks 25–41, Tasks 42–44,
Tasks 45–50, then Task 51 and F1–F4.
