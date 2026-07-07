---
spec_id: MS-prefill-admin-note
status: active
risk_class: ui-only
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - app/admin/pilot/page.tsx
  - components/admin/pilot-note-fields.tsx
  - app/dev/app-harness/pilot-note/page.tsx
  - lib/admin/pilot-note-templates.ts
  - tests/unit/pilot-note-templates.test.mjs
  - tests/e2e/admin-pilot-note.spec.ts
implementation_surfaces:
  - app/admin/pilot/page.tsx
  - components/admin/pilot-note-fields.tsx
  - app/dev/app-harness/pilot-note/page.tsx
  - lib/admin/pilot-note-templates.ts
  - tests/unit/pilot-note-templates.test.mjs
  - tests/e2e/admin-pilot-note.spec.ts
related_tests:
  - tests/unit/pilot-note-templates.test.mjs
  - tests/e2e/admin-pilot-note.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@admin-pilot-note"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Node unit test output proving each note type has a distinct placeholder, the cancellation guidance, and the unknown-type fallback.
  - Playwright @admin-pilot-note output proving the notes placeholder follows the note type and the notes field stays empty.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-admin-note — Note-type scaffold for pilot notes

## 1. Exact Goal and User-Visible Outcomes

On the internal admin Pilot readiness page, the "Notes" field of a pilot merchant
note shows a note-type-specific scaffold as its placeholder: choosing
"Cancellation reason" prompts for why they cancelled, any save attempt, and the
outcome; "Self-service launch check" prompts for what was checked, the minutes,
and pass/fail. The scaffold is guidance only — the notes field stays empty and the
operator still types the note, so no audit justification is ever prefilled.

## 2. Blast Radius

In scope:

- `lib/admin/pilot-note-templates.ts` — the note types and per-type placeholder
  copy.
- `components/admin/pilot-note-fields.tsx` — a client component that tracks the
  selected note type and drives the notes placeholder.
- `app/admin/pilot/page.tsx` — render the extracted fields component.
- `app/dev/app-harness/pilot-note/page.tsx` — DB-free harness for the e2e.
- Unit + e2e coverage.

Out of scope: the `logPilotNoteAction` server action and its persistence, the
audit-log record, the pilot report and metrics, and every other admin form.

## 3. Strict Constraints and Assumptions

- The scaffold is a PLACEHOLDER, never a value. The notes field must start empty
  and must never submit scaffold text the operator did not type — this is the
  audit-integrity rule for admin reason/notes fields.
- No change to the submitted field names (`noteType`, `setupMinutes`, `notes`) or
  the save action; the extraction is behaviour-preserving apart from the reactive
  placeholder.
- en-GB copy; no emoji or exclamation marks.
- Placeholder copy lives in `lib/**` (unit-testable); no new dependencies.

## 4. Decisions Already Made

- The five existing note types are unchanged; only the notes placeholder becomes
  note-type-aware.
- The scaffold is delivered as a placeholder, not a prefilled value (audit
  integrity).
- The fields are extracted into a client component so the placeholder can react to
  the note-type select without changing the server page's action wiring.

## 5. Behavioral Requirements (EARS)

- THE pilot note form SHALL offer the five note types: support, interview, payment
  objection, cancellation reason, and self-service launch check.
- WHEN the operator selects a note type, THE notes field SHALL show that type's
  structured placeholder.
- THE notes field SHALL start empty; the scaffold SHALL be a placeholder only and
  SHALL NOT prefill a submittable value.
- IF an unknown note type is encountered, THEN THE notes field SHALL fall back to
  the support placeholder.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- Each note type maps to a distinct, non-empty placeholder, and an unknown type
  falls back to the support placeholder (unit).
- In the DB-free harness, the notes placeholder starts on the support guidance and
  changes to the cancellation guidance when the note type changes, while the notes
  value stays empty (e2e).

Tasks:

1. Add the note-type + placeholder lib + unit tests.
2. Extract the pilot note fields into a client component with a reactive
   placeholder; render it from the pilot page.
3. Add the DB-free harness and the e2e.
4. Run the declared gates, record evidence, and advance.
