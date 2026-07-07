### Instruction: Use a Disciplined TDD Workflow to Implement Micro-Specs

Once a Micro-Spec's requirements have been turned into granular, failing tests, shift from design to implementation. Use a Test-Driven Development workflow that prioritizes correctness first, then structural refinement.

## Vocabulary and Handoff

Micro-Specs are authored per `Instructions_MircroSpecsCreation.md` (the WHAT); this workflow implements them test-first (the HOW). Keep the three terms distinct:

- A **Micro-Spec** is the source document.
- A **requirement** is one EARS line inside it.
- A **test** is a failing check derived from a requirement.

The handoff is explicit: **each in-scope EARS requirement becomes one or more failing tests before any production code is written when the required test harness exists or is restored by the active Micro-Spec.** Where a step below says "make a Micro-Spec pass," read it as "make the tests for its requirements pass."

Follow the cycle:

> Red -> Green -> Refactor

The goal is to make each Micro-Spec pass with the smallest possible implementation, then improve the design only after the behavior is protected by tests.

## Current Repo Harness Note

The current tracked CI baseline is `pnpm lint`, `pnpm typecheck`,
`pnpm governance:check`, `pnpm governance:run-gates`, `pnpm tokens:check`,
`pnpm claims:check`, `pnpm test`, `pnpm build`, Playwright browser install,
`pnpm test:e2e`, `pnpm test:a11y`, `pnpm test:visual`, conditional
`pnpm test:db`, and `pnpm jsonld:check`. `pnpm test` runs the repo's node
Micro-Spec tests.

Use database, Playwright e2e, accessibility, or visual gates when the active
Micro-Spec risk class requires them. DB-free browser harness routes can prove
UI journeys, but they must not be treated as proof of RLS, billing, webhook, or
ledger correctness. `pnpm test:db` is live database proof and requires
`SUPABASE_DB_URL`.

---

## 0. Narrow Before You Start

A Micro-Spec describes the target end state; it is not proof the work is unstarted. Before writing tests, inspect the live code and reduce the task to the in-scope requirements that are not already satisfied — do not re-implement existing behavior. (See `micro-specs/README.md`, "Working Rule".)

Before Red → Green → Refactor starts, confirm the Micro-Spec lifecycle status in
the `micro-specs/README.md` governance contract. Only `active` specs are default
implementation inputs. `draft`, `closed`, and `superseded` specs require a
refreshed active spec or an `approved_exceptions` entry before tests or
production code are written.

If an in-scope requirement is ambiguous, contradicts live code, or cannot be satisfied without editing a file outside the Micro-Spec's blast radius, adding a dependency, or making a product decision: **stop and surface the question first.** Do not invent product behavior, silently widen the blast radius, or skip the requirement under the cover of TDD. Record the assumption you would otherwise have made so a human can confirm or correct it.

---

## 1. Reach the Green State as Simply as Possible

When a Micro-Spec is failing, write only the minimum amount of production code required to make it pass.

During this phase:

- Do not optimize.
- Do not generalize early.
- Do not refactor prematurely.
- Do not add behavior that is not required by the current test.
- Do not introduce abstractions before there is evidence they are needed.

Correctness is the only goal.

When the correct implementation is not yet clear, use the **Fake It** strategy:

> Hardcode the expected value just enough to make the current test pass.

This is acceptable because the purpose of the first implementation is to satisfy the test, not to produce the final design.

Three rules protect this phase:

- **What counts as Red.** A legitimate failing test fails on its behavioral assertion: the asserted outcome is genuinely absent. It must not fail only on a compile/import error, a missing symbol you are about to create, or a tautology such as `expect(true).toBe(false)`. Observe the test fail for the right reason before you write code.
- **The test is the fixed target.** Green may change production code only. Do not edit a test's assertions, relax its expectations, mark it `.skip`/`.only`/`.todo`, or delete it to reach green. A test change is a spec change and needs the same approval as widening blast radius; if a test looks wrong, stop.
- **Choose the right test tier in Red.** Behavioral and branching logic can be proven with mocked dependencies. Invariants a mock cannot enforce, including tenant isolation/RLS, atomicity, idempotency, ledger consistency, and webhook signature handling, require a real harness. If that harness is not tracked, the active Micro-Spec must explicitly approve creating or restoring it before implementation starts.

---

## 2. Use Triangulation to Force Generalization

Do not leave hardcoded or fake implementations in place.

After using the Fake It strategy, create a second test for the same behavior using a different input, state, or edge case.

The new test should fail against the hardcoded implementation.

Then replace the fake logic with a generalized implementation that satisfies both tests.

Use triangulation when:

- The first passing solution is hardcoded.
- The real algorithm is not obvious yet.
- You want the tests to force the shape of the implementation.
- You need confidence that the behavior works for more than one case.

The implementation should only become more generic when the tests demand it.

One EARS requirement usually needs more than one test. Cover each clause and outcome it asserts — the success path, every named failure or error path, and any "ignored until…" or boundary condition — as its own test. Triangulation is not only for defeating a fake; use it to pin every branch the requirement promises.

---

## 3. Use Obvious Implementation for Trivial Specs

Do not fake or triangulate every behavior unnecessarily.

When the implementation is obvious, simple, and low-risk, write the real logic directly.

Use Obvious Implementation when:

- The solution is straightforward.
- The behavior is already well understood.
- The code required is small.
- There is little risk of over-engineering.

After writing the obvious implementation, run the Micro-Spec and confirm it passes.

---

## 4. Refactor Only After the Tests Are Green

Refactor only when the relevant Micro-Specs are passing.

Once the tests are green, use them as a safety net to improve the internal structure of the code without changing external behavior.

During refactoring:

- Improve names.
- Simplify complex logic.
- Remove unnecessary branches.
- Reduce technical debt.
- Improve readability.
- Separate responsibilities.
- Decouple modules from concrete dependencies.
- Introduce abstractions only when they clarify the design.
- Preserve all existing behavior.

The refactor phase must not add new functionality. Any new behavior requires a new failing test first. If the behavior is within the current Micro-Spec's blast radius and settled decisions, write the test and continue; if it requires touching files outside the blast radius, a new dependency, a schema change, or a product decision, stop and amend the Micro-Spec for approval before writing the test — do not widen scope under the cover of refactoring.

---

## 5. Apply the Rule of Three for Duplication

Do not remove duplication the moment it appears.

Allow minor duplication to exist temporarily so that the correct abstraction can emerge naturally.

Use the **Rule of Three**:

> Refactor duplication only after the same pattern appears three times.

This prevents premature abstraction and avoids creating generic code before the design is clear.

Duplicate code is acceptable when it helps reveal the underlying pattern. Refactor only when the repetition provides enough evidence for a stable abstraction.

---

## 6. Adjust Your Stride Based on Problem Difficulty

Control the size of each implementation step based on the complexity of the problem.

For difficult or unclear problems, use baby steps:

- Write 1 to 3 lines of production code.
- Run the Micro-Specs.
- Confirm the result.
- Continue only after feedback.

This keeps failures small and easy to diagnose.

For simple or obvious problems, use larger steps:

- Write 4 to 7 lines of production code.
- Run the Micro-Specs.
- Confirm the result.

Do not take steps so small that they slow down trivial work. Do not take steps so large that debugging becomes difficult.

---

## Required TDD Behavior

When implementing a Micro-Spec, follow this sequence:

0. Narrow first: inspect live code and select only the in-scope requirements not already satisfied.
1. Start with a failing test for one requirement, and confirm it fails for the right reason.
2. Write the smallest amount of production code needed to pass it.
3. Use Fake It when the solution is unclear.
4. Add another test to triangulate and force generalization.
5. Use Obvious Implementation when the solution is trivial.
6. Once green, refactor internal structure without changing behavior.
7. Apply the Rule of Three before extracting abstractions.
8. Adjust step size based on problem complexity.
9. Repeat until every in-scope requirement has a passing test.
10. For browser-required specs, run the focused Playwright CLI command first
    (`pnpm test:e2e -- --grep "<tag-or-title>"` or
    `pnpm test:e2e -- --project=<project>`), then the spec's declared browser,
    a11y, and visual gates exactly as written in `verification_gates` —
    active specs declare grep-scoped e2e gates, and a whole-suite browser run
    requires a dated `broad-browser-gate` approved exception.

---

## What to Avoid

Do not write production code without a failing test.

Do not reach green by weakening, skipping, or removing a test instead of writing code.

Do not generalize before tests require it.

Do not refactor while tests are red.

Do not optimize during the green phase.

Do not remove duplication too early.

Do not introduce abstractions based on speculation.

Do not add extra behavior because it “might be useful later.”

Do not make large implementation jumps when the problem is uncertain.

---

## Definition of Done

The implementation is complete when:

- Every in-scope EARS requirement maps to at least one passing test; a green suite with an uncovered in-scope requirement is not done.
- All required tests and verification gates pass.
- The spec's evidence ledger carries a covering, all-passed latest run — recorded by `pnpm governance:advance` (or `pnpm governance:run-gates --spec <id> --record`), not written by hand.
- After review evidence completes, the lifecycle continues past `implemented`: `verified` (attestations + acknowledgements), then `closed` — the body rewritten into a machine-validated rationale record per `micro-specs/README.md`, "Closed-Record Contract".
- The production code satisfies only the required behavior.
- Fake implementations have been replaced through triangulation where needed.
- Refactoring has improved structure without changing behavior.
- Duplication has been handled according to the Rule of Three.
- Only files within the Micro-Spec's declared blast radius were created or modified; any change outside it was approved first.
- No untested behavior, unnecessary abstraction, or unauthorized functionality has been introduced.
