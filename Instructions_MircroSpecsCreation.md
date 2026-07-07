### Instruction: Create High-Fidelity Micro-Specs for AI Agents

When creating a Micro-Spec, do not write step-by-step coding instructions. Instead, act as a **curator of intent**: define the desired end state, precise boundaries, behavioral requirements, and verification criteria so an AI agent can implement the change without making unauthorized architectural or product decisions.

A Micro-Spec must be **small, focused, declarative, and executable**. It should describe **what must be true when the work is complete**, not exactly how the code must be written.

Implementation of a Micro-Spec is governed by `Instructions_tdd.md` (binding, Red -> Green -> Refactor): each in-scope EARS requirement becomes a failing test before any production code when a test harness exists or is explicitly restored by the spec. Author the spec so that handoff is clean: this document owns the WHAT, that one owns the HOW.

The AI governance contract in `micro-specs/README.md` is binding for metadata,
source hierarchy, lifecycle status transitions, risk_class, and verification
gates. A normalized Micro-Spec must include this Micro-Spec Metadata Schema
before Engineering can treat it as implementation-ready:

```yaml
spec_id: MS-<area>-<slug>
status: draft | active | implemented | verified | closed | superseded
risk_class: docs-tooling | ui-only | product-analytics | customer-pii | auth-session | billing | webhooks | rls-rpc-ledger | migrations
owner: <person-or-agent>
last_reviewed: YYYY-MM-DD
allowed_blast_radius:
  - <repo-local path or glob>
implementation_surfaces:
  - <repo-local path or glob>
related_docs:
  - <repo-local path>
related_tests:
  - <repo-local path or "not-yet-created">
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
required_playwright_projects: []
evidence_required:
  - <CI artifact, command output, trace, screenshot, or review evidence>
approved_exceptions: []
```

For active specs, `verification_gates` must satisfy the risk-class gate matrix in
`micro-specs/README.md`. Browser-required specs must include
`required_playwright_projects` and related tests under `tests/e2e/`,
`tests/a11y/`, or `tests/visual/`. DB, webhook, RLS, ledger, billing, and
migration specs must declare `pnpm test:db` where the matrix requires live DB
behavioral proof. Browser-only or static SQL checks do not satisfy those DB
proof requirements.

Gates default to the spec's blast radius, not the whole app. Playwright gates
must be scoped with a spec-owned grep tag, for example:
`pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@merchant-launch-save-flow"`
(multiple `--project` flags are supported). Reserve broad browser gates — bare
`pnpm test:e2e`, all-project visual sweeps — for specs that intentionally
change global or browser-wide behavior, and record why as a dated
`approved_exceptions` entry, `broad-browser-gate: <why> (expires: YYYY-MM-DD)`;
the checker rejects a grep-less `test:e2e` gate on an active spec otherwise.
(`pnpm test:a11y` / `pnpm test:visual` are already tag-scoped wrappers and
remain valid as declared.) The node tiers (`pnpm test`, `pnpm test:db`) run
the whole hermetic suite by construction, so declare the file-level focus in
`related_tests`: name the spec's specific `tests/micro-specs/*.test.mjs`
files, its unit test files, and — whenever the spec touches DB/RLS/RPC
behavior — the specific `tests/db/**` files that prove it. See "Scoped
Browser Gates" in `micro-specs/README.md`.

The checker cross-checks these declarations on active specs: implementation
surfaces matching a high-risk path (Supabase migrations, the Stripe webhook
route) force the matching risk class; a blast radius claiming more than one
broad root (`app/**`, `lib/**`, `scripts/**`, …) needs a dated
`broad-blast-radius: <why> (expires: YYYY-MM-DD)` exception; and the e2e
`--grep` tag must actually appear in one of the spec's related browser test
files.

Do not author the frontmatter by hand: scaffold with
`pnpm governance:new-spec --id MS-<area>-<slug> --risk <class> --title "<text>"`,
which pre-resolves the risk-class gate floor against the repo's real package
scripts and emits the six required section headings. Never hand-edit the
`status:` line afterwards — lifecycle moves only through
`pnpm governance:advance <spec-id> --to <status>`, which runs the declared
gates fresh and records the evidence ledger the checker enforces. The happy
path ends at `closed`: after verification, the body is rewritten from a build
plan into a rationale record the engine validates (see
`micro-specs/README.md`, "Closed-Record Contract").

Each Micro-Spec must include the following elements:

---

## 1. Exact Goal and User-Visible Outcomes

Start with a clear, unambiguous statement of the intended change.

Describe the outcome from the user’s perspective, not as a vague feature label.

Avoid:

> Add a login feature.

Prefer:

> A user can sign up with an email and password, receive a verification email, and log in without error. The session persists across page refreshes.

---

## 2. Blast Radius: In Scope and Out of Scope

Explicitly define what the AI agent is allowed to modify.

Include:

- Files the agent may edit
- Directories the agent may edit
- Components, services, APIs, or schemas involved
- Files or systems that must not be changed

Clearly state what is out of scope.

Example:

> OAuth, social login, password reset, and admin authentication are out of scope.

Do not leave scope boundaries implied. If a capability is not allowed, say so directly.

---

## 3. Strict Constraints and Assumptions

Define all non-negotiable constraints the implementation must follow.

Include relevant constraints for:

- Libraries
- Frameworks
- Database schemas
- API patterns
- UI patterns
- Security requirements
- Performance expectations
- Error handling
- State management
- Testing requirements

The AI agent must not introduce new dependencies, alter architecture, change schemas, or make product decisions unless the Micro-Spec explicitly permits it.

---

## 4. Decisions Already Made

State all decisions that have already been settled.

Examples:

- The app already uses Tailwind CSS.
- Authentication must use Supabase Auth.
- Password hashing must use bcrypt.
- The database schema is already defined.
- The UI must use the existing Button component.
- The implementation must follow the existing Repository Pattern.

Do not assume the AI agent will infer these decisions from the codebase.

---

## 5. Behavioral Requirements Using EARS Notation

Write outcome statements using **EARS notation** so requirements are precise and testable.

Use the format:

> WHEN `[trigger]`, THE `[system]` SHALL `[response]`.

Example:

> WHEN the user clicks SUBMIT, THE system SHALL transition to the LOADING state and the SUBMIT event SHALL be ignored until the request completes.

`WHEN/SHALL` is only one of EARS' five forms. Pick the simplest form that fits the requirement:

| Use when                                     | Pattern                                                   |
| -------------------------------------------- | --------------------------------------------------------- |
| Always-true invariant                        | THE `[system]` SHALL `[response]`.                        |
| Active only in a state                       | WHILE `[state]`, THE `[system]` SHALL `[response]`.       |
| Triggered by an event                        | WHEN `[trigger]`, THE `[system]` SHALL `[response]`.      |
| Behind an optional feature or flag           | WHERE `[feature]`, THE `[system]` SHALL `[response]`.     |
| Guarding against unwanted input or condition | IF `[condition]`, THEN THE `[system]` SHALL `[response]`. |

Express invariants (e.g. ledger or tenant constraints such as "one stamp per UK business day") as ubiquitous statements, and rejection rules as `IF…THEN`. These are exactly the cases your real-database tests cover, and they are easy to lose if forced into a `WHEN` event.

Use EARS statements for:

- User interactions
- State transitions
- Error cases
- Permission rules
- Validation rules
- API responses
- Edge cases

Each behavioral requirement should be specific enough to map directly to a test or acceptance criterion.

---

## 6. Verification Criteria and Task Breakdown

Define how completion will be verified.

Include:

- Acceptance criteria
- Required tests
- Edge cases
- Manual QA checks
- Required Playwright projects and CLI commands when browser evidence is needed
- Required live DB command and setup when RLS, webhook, billing, ledger, or
  migration evidence is needed
- Expected success states
- Expected failure states

Express required tests as observable behaviors to verify (e.g. "a second stamp on the same UK business day is rejected"), not as test file names or function signatures — the TDD workflow chooses the test form.

Break the work into small, discrete tasks that the AI agent can complete iteratively.

Avoid asking the AI to implement a large feature in one pass. The task breakdown should allow the agent to implement, verify, and adjust one piece at a time.

---

## Avoid These Pitfalls

Do not over-specify implementation details.

A Micro-Spec should not read like pseudo-code. Define the **what** and **why**, while leaving the implementation **how** to the AI agent unless a technical decision is already settled.

Do not create massive design documents.

A Micro-Spec should target a single feature, workflow, or state machine that can reasonably be completed within 1 to 3 days.

Do not rely on implied context.

If something matters, state it explicitly.

---

## Use Global Context for Repeated Rules

Do not repeat broad engineering rules in every Micro-Spec.

Move reusable project-wide rules into a Global Context file. In this repo, Global Context lives in:

- `AGENTS.md` — stack and governance index
- `micro-specs/GLOBAL_CONTEXT.md` — product, stack, security, and verification baselines

Read those before authoring, and never restate their stack, security, or verification rules in an individual spec.

Use Global Context for rules such as:

- Always use Tailwind CSS.
- Never use `any` types.
- Follow the Repository Pattern.
- Use existing shared components.
- Do not introduce new dependencies without approval.
- Follow existing naming conventions.

The Micro-Spec should focus on the specific business logic and behavior for the current change, while Global Context should enforce the broader engineering culture.

---

## A Complete Example

There is no active example corpus checked in right now. For a new Micro-Spec,
use the six headings in this document, add the metadata block from
`micro-specs/README.md`, and create it under `micro-specs/<area>/<short-slug>.md`.
Use only current checked-in governance files as examples unless the user
explicitly asks for additional reference material.
