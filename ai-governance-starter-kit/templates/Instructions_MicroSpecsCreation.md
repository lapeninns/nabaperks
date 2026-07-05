### Instruction: Create High-Fidelity Micro-Specs for AI Agents

When creating a Micro-Spec, do not write step-by-step coding instructions. Instead, act as a **curator of intent**: define the desired end state, precise boundaries, behavioral requirements, and verification criteria so an AI agent can implement the change without making unauthorized architectural or product decisions.

A Micro-Spec must be **small, focused, declarative, and executable**. It should describe **what must be true when the work is complete**, not exactly how the code must be written.

The spec owns the WHAT and the WHY. The implementation workflow (test-first when a harness exists) owns the HOW. Author every spec so that handoff is clean: an agent should be able to turn each in-scope requirement into a failing test or acceptance check before writing production code.

The governance contract in `micro-specs/README.md` is binding for metadata, source hierarchy, lifecycle status transitions, risk_class, and verification gates. A normalized Micro-Spec must carry the metadata block below in YAML frontmatter before engineering can treat it as implementation-ready:

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | closed | superseded
risk_class: docs-tooling | ui-only | data-model | auth-session | billing | webhooks | migrations | infra | security | ai-agent
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_tests:
  - <repo-local path or "not-yet-created">
verification_gates:
  - <your package manager> <governance-check script>
  - <your package manager> <test script>
required_playwright_projects: []
evidence_required:
  - <CI artifact, command output, trace, screenshot, or review evidence>
approved_exceptions: []
```

Every field above is required — the governance check rejects a spec that omits any of them, and the list fields must be non-empty. `related_docs` is optional; add it when the spec leans on a design doc or ADR.

Do not author the frontmatter by hand: scaffold with
`governance:new-spec --id MS-<area>-<slug> --risk <class> --title "<text>"`,
which pre-resolves the risk-class gate floor against the repo's real package
scripts and emits the six required section headings. Never hand-edit the
`status:` line afterwards — lifecycle moves only through
`governance:advance <spec-id> --to <status>`, which runs the declared gates
fresh and records the evidence ledger the checker enforces. The happy path
ends at `closed`: after verification, the body is rewritten from a build plan
into a rationale record the engine validates (see `micro-specs/README.md`,
"Closed-Record Contract").

For active specs, `verification_gates` must satisfy the risk-class gate matrix in `micro-specs/README.md`. Each gate is either an executable script (`<pkg> <script>`, e.g. `pnpm test`, `npm run test`, `yarn test`, `bun test`) or a manual gate written as `manual:<kebab-case>` (e.g. `manual:security-review`). Every class must declare the governance-check and test scripts; higher-risk classes add lint / typecheck / build where the repo defines them. Browser-required specs must list `required_playwright_projects` and point `related_tests` at your end-to-end suite. Data-model, auth-session, billing, webhooks, and migration specs must declare a **durable-proof** gate (an integration, contract, database, or end-to-end test script) — a browser-only or static check does not satisfy that requirement. Where the repo genuinely lacks such a gate, carry a dated `approved_exceptions` entry that explains the gap.

Each Micro-Spec must include the following elements.

---

## 1. Exact Goal and User-Visible Outcomes

Start with a clear, unambiguous statement of the intended change.

Describe the outcome from the user's perspective, not as a vague feature label.

Avoid:

> Add a report export feature.

Prefer:

> A signed-in user can schedule a report to be delivered by email at a chosen daily time. The report arrives as a CSV attachment, the schedule survives a page refresh, and the user can cancel it from the same screen.

---

## 2. Blast Radius: In Scope and Out of Scope

Explicitly define what the AI agent is allowed to modify.

Include:

- Files the agent may edit
- Directories the agent may edit
- Components, services, APIs, or schemas involved
- Files or systems that must not be changed

Clearly state what is out of scope. Do not leave scope boundaries implied. If a capability is not allowed, say so directly.

Example:

> Weekly and monthly cadences, non-email delivery channels, custom report templates, and the admin analytics dashboard are out of scope.

The `allowed_blast_radius` and `implementation_surfaces` metadata lists must agree with this prose. The blast radius is the wall the agent works inside; touching anything outside it is a governance failure.

---

## 3. Strict Constraints and Assumptions

Define all non-negotiable constraints the implementation must follow.

Include relevant constraints for:

- Libraries and frameworks
- Database schemas
- API patterns
- UI patterns
- Security requirements
- Performance expectations
- Error handling
- State management
- Testing requirements

The AI agent must not introduce new dependencies, alter architecture, change schemas, or make product decisions unless the Micro-Spec explicitly permits it. State the assumptions the change rests on (for example, "the scheduling table already exists" or "the email transport is already configured") so the agent does not silently invent them.

---

## 4. Decisions Already Made

State all decisions that have already been settled, so the agent does not re-litigate them or infer a different answer from the codebase.

Examples:

- The app already uses the existing design-system components; build the schedule form from those.
- Times are stored and compared in UTC.
- The delivery job runs on the existing scheduled-task runner; do not add a new scheduler.
- Persistence must use the existing data-access layer, not raw queries.
- The CSV serializer that already exists must be reused.

Do not assume the AI agent will infer these decisions from the codebase. If it matters and it is decided, write it down here.

---

## 5. Behavioral Requirements Using EARS Notation

Write outcome statements in **EARS** (Easy Approach to Requirements Syntax) so requirements are precise and testable. EARS has five patterns; pick the simplest one that fits each requirement.

| Pattern | Use when | Shape |
| ------- | -------- | ----- |
| Ubiquitous | An always-true invariant | THE `[system]` SHALL `[response]`. |
| State-driven | Behaviour holds only in a state | WHILE `[state]`, THE `[system]` SHALL `[response]`. |
| Event-driven | Triggered by an event | WHEN `[trigger]`, THE `[system]` SHALL `[response]`. |
| Optional | Behind an optional feature or flag | WHERE `[feature]`, THE `[system]` SHALL `[response]`. |
| Unwanted behaviour | Guarding against bad input or a failure | IF `[condition]`, THEN THE `[system]` SHALL `[response]`. |

Concrete example requirement lines:

- **Ubiquitous:** THE system SHALL store no more than one active schedule per user per report.
- **State-driven:** WHILE a delivery is in progress, THE schedule form SHALL show a disabled, in-flight state.
- **Event-driven:** WHEN the user submits a valid schedule, THE system SHALL persist it and confirm the next delivery time.
- **Optional:** WHERE the CSV-compression flag is enabled, THE system SHALL attach a gzipped file instead of a plain CSV.
- **Unwanted behaviour:** IF the chosen time is not a valid 24-hour time, THEN THE system SHALL reject the submission and leave any existing schedule unchanged.

Express invariants (uniqueness, tenant isolation, "at most one per period", monetary conservation) as **ubiquitous** statements, and rejection rules as **IF…THEN**. These are exactly the cases a durable integration or database test protects, and they are easy to lose if you force them into a `WHEN` event.

Use EARS statements for user interactions, state transitions, error cases, permission rules, validation rules, API responses, and edge cases. Each behavioral requirement should be specific enough to map directly to a single test or acceptance criterion.

---

## 6. Verification Criteria and Task Breakdown

Define how completion will be verified.

Include:

- Acceptance criteria
- Required tests and the edge cases they cover
- Manual QA checks
- Required Playwright projects and CLI commands when browser evidence is needed
- The durable-proof command and setup when integration, database, webhook, billing, or migration evidence is needed
- Expected success states and expected failure states

Express required tests as **observable behaviors to verify** (for example, "a second active schedule for the same report is rejected"), not as test file names or function signatures — the implementation workflow chooses the test form.

Break the work into small, discrete tasks the agent can complete iteratively: implement, verify, adjust, repeat. Do not ask the agent to implement a large feature in one pass; a Micro-Spec should target a single feature, workflow, or state machine that fits in roughly one to three days.

---

## Avoid These Pitfalls

- **Do not over-specify implementation details.** A Micro-Spec should not read like pseudo-code. Define the **what** and **why**; leave the **how** to the agent unless a technical decision is already settled.
- **Do not create massive design documents.** One coherent change per spec. If it sprawls, split it.
- **Do not rely on implied context.** If something matters, state it explicitly.
- **Do not let the prose and the metadata disagree.** Scope, surfaces, tests, and gates in the frontmatter must match what the body says.
- **Do not under-gate a high-risk change.** If the class is data-model, auth-session, billing, webhooks, or migrations, it needs a durable-proof gate or a dated exception.

---

## Use Global Context for Repeated Rules

Do not repeat broad engineering rules in every Micro-Spec. Move reusable, project-wide rules into the Global Context file. In this kit that is `micro-specs/GLOBAL_CONTEXT.md`, alongside the repo entrypoint (commonly `AGENTS.md`).

Global Context is also where the repo's concrete commands live — the actual package manager, the real script names behind the governance check, lint, typecheck, test, and build. Read it before authoring, and reference those commands rather than re-deriving them in each spec.

Use Global Context for rules such as:

- The styling and component conventions the repo standardizes on.
- Type-safety rules (for example, no untyped escapes).
- The architectural pattern all data access must follow.
- Reuse of existing shared components and utilities.
- No new dependencies without approval.
- Existing naming conventions.

An individual Micro-Spec should focus on the specific business logic and behavior for the current change; Global Context enforces the broader engineering culture.

---

## A Complete Example

The following is a full, minimal Micro-Spec. Save specs under `micro-specs/<area>/<short-slug>.md`. Because this example touches durable state (a new schedules table and its read/write paths), its `risk_class` is `data-model`, which requires a durable-proof gate — here an integration test script.

```markdown
---
spec_id: MS-reports-scheduled-export
status: active
risk_class: data-model
owner: jane-doe
last_reviewed: 2025-01-15
allowed_blast_radius:
  - src/features/reports/scheduling/**
  - src/data/schedules/**
  - migrations/**
implementation_surfaces:
  - src/features/reports/scheduling/schedule-form.tsx
  - src/features/reports/scheduling/schedule-service.ts
  - src/data/schedules/schedules-repository.ts
related_docs:
  - docs/adr/0007-scheduled-jobs.md
related_tests:
  - tests/integration/reports/scheduled-export.test.ts
verification_gates:
  - pnpm governance:check
  - pnpm lint
  - pnpm typecheck
  - pnpm test
  - pnpm test:integration
required_playwright_projects: []
evidence_required:
  - Integration test output showing a duplicate active schedule is rejected
  - Migration up/down run log
approved_exceptions: []
---

## 1. Exact Goal and User-Visible Outcomes

A signed-in user can schedule one report for daily email delivery at a chosen
24-hour time. Submitting the form confirms the next delivery time, the schedule
survives a page refresh, and the user can cancel it from the same screen. At the
scheduled time the existing job runner emails the report as a CSV attachment.

## 2. Blast Radius

In scope: the scheduling form and service under `src/features/reports/scheduling/`,
the schedules repository under `src/data/schedules/`, and one additive migration
that creates the `report_schedules` table.

Out of scope: weekly/monthly cadences, delivery channels other than email, custom
report templates, the report-generation logic itself, and the admin dashboard.
Do not modify the job-runner infrastructure.

## 3. Strict Constraints and Assumptions

- Reuse the existing CSV serializer and email transport; do not add libraries.
- Store and compare times in UTC.
- All persistence goes through the schedules repository (the data-access layer),
  never raw queries.
- The migration must be additive and reversible (both up and down).
- Assumption: the scheduled-task runner already exists and can invoke a handler.

## 4. Decisions Already Made

- The schedule form is built from the existing design-system components.
- One report has at most one active schedule per user.
- Cancellation is a soft state change (mark inactive), not a hard delete.

## 5. Behavioral Requirements (EARS)

- THE system SHALL allow at most one active schedule per user per report.
- WHEN a user submits a valid schedule, THE system SHALL persist it and display
  the next delivery time in UTC.
- WHILE a schedule is active, THE schedule screen SHALL show its next delivery
  time and a Cancel control.
- WHEN the runner fires at the scheduled time, THE system SHALL email the report
  as a CSV attachment to the schedule owner.
- IF the submitted time is not a valid 24-hour time, THEN THE system SHALL reject
  the submission and leave any existing schedule unchanged.
- IF a user submits a second schedule for a report that already has an active
  one, THEN THE system SHALL reject it with a clear message.

## 6. Verification Criteria and Task Breakdown

Acceptance criteria — verify these observable behaviors:

- A valid submission creates exactly one active schedule and returns the correct
  next-delivery time.
- A second active-schedule attempt for the same report is rejected.
- An invalid time is rejected and does not mutate existing state.
- Cancelling marks the schedule inactive; the runner then skips it.
- The migration applies and rolls back cleanly.

Tasks (implement and verify one at a time):

1. Add the additive `report_schedules` migration (up and down).
2. Implement the schedules repository with a uniqueness guard.
3. Implement the schedule service (validate time, create, cancel).
4. Wire the form to create and cancel, showing next delivery time.
5. Add the delivery handler that emails the CSV from the runner.

Durable proof: the integration suite must exercise the uniqueness invariant and
the reject-invalid-time rule against a real database, not a browser or a mock.
```

---

Use the six numbered headings above plus the metadata block for every new Micro-Spec, and keep the frontmatter honest with the body. When in doubt, prefer a smaller spec with sharper EARS requirements over a broad one with vague outcomes.
