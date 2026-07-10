### Instruction: Use a Disciplined TDD Workflow to Implement Micro-Specs

Once a Micro-Spec's requirements have been turned into granular, failing tests, shift from design to implementation. Use a Test-Driven Development workflow that prioritizes correctness first, then structural refinement.

This file is a portable template the governance kit installs into any repository. It is intentionally stack-agnostic: it names commands generically ("your test command", "the governance gate runner", "your package manager"). The concrete commands for this repository live in `micro-specs/GLOBAL_CONTEXT.md` and `AGENTS.md`; consult those for exact invocations.

## Vocabulary and Handoff

Micro-Specs are authored per your spec-authoring instructions (the WHAT); this workflow implements them test-first (the HOW). Keep the three terms distinct:

- A **Micro-Spec** is the source document.
- A **requirement** is one EARS line inside it.
- A **test** is a failing check derived from a requirement.

The handoff is explicit: **each in-scope EARS requirement becomes one or more failing tests before any production code is written, provided the required test harness exists or is restored by the active Micro-Spec.** Where a step below says "make a Micro-Spec pass," read it as "make the tests for its requirements pass."

Follow the cycle:

> Red -> Green -> Refactor

The goal is to make each Micro-Spec pass with the smallest possible implementation, then improve the design only after the behavior is protected by tests.

## Harness and Gate Note

The active Micro-Spec's `verification_gates` list the checks that must pass for this work, and its `evidence_required` lists what you must produce to prove them. The spec's `risk_class` sets the gate floor: every class must at minimum run the governance check and your test command, and higher-risk classes add more — typecheck and build where the repo defines them, and for anything touching a data model, auth/session, billing, webhooks, or migrations, at least one durable-proof gate. Read the exact gate set from the active spec and from the governance index (`micro-specs/README.md`); do not assume a fixed list.

Choose the proof tier that matches the risk. A browser-driven or DB-free UI harness can prove a user journey, but it must never be treated as proof of tenant isolation, access control, billing, webhook, or persistence correctness. Those guarantees require durable, non-browser-only proof — a database, integration, or contract test. When such a gate is required and the harness is not yet tracked, the active Micro-Spec must explicitly approve creating or restoring it before implementation starts.

---

## 0. Narrow Before You Start

A Micro-Spec describes the target end state; it is not proof the work is unstarted. Before writing tests, inspect the live code and reduce the task to the in-scope requirements that are not already satisfied — do not re-implement existing behavior. (See the governance index's working rule.)

Before Red → Green → Refactor starts, confirm the Micro-Spec's lifecycle status in the governance index. Only `active` specs are default implementation inputs. `draft`, `implemented`, `verified`, `closed`, and `superseded` specs require a refreshed active spec or an `approved_exceptions` entry before tests or production code are written.

If an in-scope requirement is ambiguous, contradicts live code, or cannot be satisfied without editing a file outside the Micro-Spec's declared blast radius, adding a dependency, or making a product decision: **stop and surface the question first.** Do not invent product behavior, silently widen the blast radius, or skip the requirement under the cover of TDD. Record the assumption you would otherwise have made so a human can confirm or correct it.

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

- **What counts as Red.** A legitimate failing test fails on its behavioral assertion: the asserted outcome is genuinely absent. It must not fail only on a compile/import error, a missing symbol you are about to create, or a tautology such as asserting a constant is false. Observe the test fail for the right reason before you write code.
- **The test is the fixed target.** Green may change production code only. Do not edit a test's assertions, relax its expectations, mark it skipped/focused/pending, or delete it to reach green. A test change is a spec change and needs the same approval as widening blast radius; if a test looks wrong, stop.
- **Choose the right test tier in Red.** Behavioral and branching logic can be proven with mocked dependencies. Invariants a mock cannot enforce — tenant isolation and access control, atomicity, idempotency, ledger or balance consistency, and webhook signature handling — require a real harness. If that harness is not tracked, the active Micro-Spec must explicitly approve creating or restoring it before implementation starts.

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

After writing the obvious implementation, run the Micro-Spec's tests and confirm they pass.

---

## 4. Refactor Only After the Tests Are Green

Refactor only when the relevant Micro-Spec's tests are passing.

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
- Run the Micro-Spec's tests.
- Confirm the result.
- Continue only after feedback.

This keeps failures small and easy to diagnose.

For simple or obvious problems, use larger steps:

- Write 4 to 7 lines of production code.
- Run the Micro-Spec's tests.
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
10. For any gate beyond the base test command — durable-proof, end-to-end, accessibility, or visual — run the narrowest focused invocation first for a fast signal (scope it to the tag, title, or suite you changed), then run the full gate the active Micro-Spec declares.
11. Treat focused tests as the per-change feedback loop. Do not run every full gate or record a new evidence entry merely because a Git commit was created. At a coherent proof boundary, `governance:run-gates --spec <spec-id> --record` writes the spec's ledger (red runs included — honest history). If one change affects several specs, repeat `--spec <id>` in that single command so identical gates execute once and evidence remains per-spec. When every requirement is covered, move the lifecycle with `governance:advance <spec-id> --to implemented`, which re-runs the gates fresh and records the transition; do not edit the `status:` line by hand.

---

## What to Avoid

Do not write production code without a failing test.

Do not reach green by weakening, skipping, or removing a test instead of writing code.

Do not generalize before tests require it.

Do not refactor while tests are red.

Do not optimize during the green phase.

Do not remove duplication too early.

Do not introduce abstractions based on speculation.

Do not add extra behavior because it "might be useful later."

Do not make large implementation jumps when the problem is uncertain.

Four safety rules hold in every repository the kit installs into:

- **Never use browser-only proof for a data, auth/session, billing, webhook, or migration guarantee.** Those require durable, non-browser-only proof: a database, integration, or contract test.
- **Never silently broaden blast radius.** If you need to touch a file, dependency, schema, or product decision outside the active Micro-Spec, update that spec (and get it re-approved) before you make the change.
- **Never add fake, no-op, or always-passing validation scripts to make governance pass.** A gate that does not actually verify what it claims is worse than no gate. If the repo genuinely lacks a required gate, record the gap in the spec's `approved_exceptions`, don't fake it.
- **Never commit secrets, logs, local environment files, or generated build artifacts** unless the active Micro-Spec explicitly requires it and a reviewer has approved.

---

## Definition of Done

The implementation is complete when:

- Every in-scope EARS requirement maps to at least one passing test; a green suite with an uncovered in-scope requirement is not done.
- All of the active Micro-Spec's `verification_gates` pass, and every item in its `evidence_required` has been produced.
- The spec's evidence ledger carries a covering, all-passed latest run — recorded by `governance:advance` (or `run-gates --spec <id> --record`), not written by hand.
- After review evidence completes, the lifecycle continues past `implemented`: `verified` (attestations + acknowledgements), then `closed` — the body rewritten into a machine-validated rationale record per `micro-specs/README.md`, "Closed-Record Contract".
- The production code satisfies only the required behavior.
- Fake implementations have been replaced through triangulation where needed.
- Refactoring has improved structure without changing behavior.
- Duplication has been handled according to the Rule of Three.
- Only files within the Micro-Spec's declared blast radius were created or modified; any change outside it was approved first.
- No untested behavior, unnecessary abstraction, or unauthorized functionality has been introduced.
