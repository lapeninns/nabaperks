### Instruction: Use a Disciplined TDD Workflow to Implement Micro-Specs

Once Micro-Specs have been defined as granular, failing tests, shift from design to implementation. Use a Test-Driven Development workflow that prioritizes correctness first, then structural refinement.

Follow the cycle:

> Red → Green → Refactor

The goal is to make each Micro-Spec pass with the smallest possible implementation, then improve the design only after the behavior is protected by tests.

---

## 1. Reach the Green State as Simply as Possible

When a Micro-Spec is failing, write only the minimum amount of production code required to make it pass.

During this phase:

* Do not optimize.
* Do not generalize early.
* Do not refactor prematurely.
* Do not add behavior that is not required by the current test.
* Do not introduce abstractions before there is evidence they are needed.

Correctness is the only goal.

When the correct implementation is not yet clear, use the **Fake It** strategy:

> Hardcode the expected value just enough to make the current test pass.

This is acceptable because the purpose of the first implementation is to satisfy the test, not to produce the final design.

---

## 2. Use Triangulation to Force Generalization

Do not leave hardcoded or fake implementations in place.

After using the Fake It strategy, create a second Micro-Spec for the same behavior using a different input, state, or edge case.

The new test should fail against the hardcoded implementation.

Then replace the fake logic with a generalized implementation that satisfies both tests.

Use triangulation when:

* The first passing solution is hardcoded.
* The real algorithm is not obvious yet.
* You want the tests to force the shape of the implementation.
* You need confidence that the behavior works for more than one case.

The implementation should only become more generic when the tests demand it.

---

## 3. Use Obvious Implementation for Trivial Specs

Do not fake or triangulate every behavior unnecessarily.

When the implementation is obvious, simple, and low-risk, write the real logic directly.

Use Obvious Implementation when:

* The solution is straightforward.
* The behavior is already well understood.
* The code required is small.
* There is little risk of over-engineering.

After writing the obvious implementation, run the Micro-Spec and confirm it passes.

---

## 4. Refactor Only After the Tests Are Green

Refactor only when the relevant Micro-Specs are passing.

Once the tests are green, use them as a safety net to improve the internal structure of the code without changing external behavior.

During refactoring:

* Improve names.
* Simplify complex logic.
* Remove unnecessary branches.
* Reduce technical debt.
* Improve readability.
* Separate responsibilities.
* Decouple modules from concrete dependencies.
* Introduce abstractions only when they clarify the design.
* Preserve all existing behavior.

The refactor phase must not add new functionality. Any new behavior requires a new failing Micro-Spec first.

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

* Write 1 to 3 lines of production code.
* Run the Micro-Specs.
* Confirm the result.
* Continue only after feedback.

This keeps failures small and easy to diagnose.

For simple or obvious problems, use larger steps:

* Write 4 to 7 lines of production code.
* Run the Micro-Specs.
* Confirm the result.

Do not take steps so small that they slow down trivial work. Do not take steps so large that debugging becomes difficult.

---

## Required TDD Behavior

When implementing a Micro-Spec, follow this sequence:

1. Start with a failing Micro-Spec.
2. Write the smallest amount of production code needed to pass it.
3. Use Fake It when the solution is unclear.
4. Add another Micro-Spec to triangulate and force generalization.
5. Use Obvious Implementation when the solution is trivial.
6. Once green, refactor internal structure without changing behavior.
7. Apply the Rule of Three before extracting abstractions.
8. Adjust step size based on problem complexity.
9. Repeat until all Micro-Specs pass.

---

## What to Avoid

Do not write production code without a failing Micro-Spec.

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

* All Micro-Specs pass.
* The production code satisfies only the required behavior.
* Fake implementations have been replaced through triangulation where needed.
* Refactoring has improved structure without changing behavior.
* Duplication has been handled according to the Rule of Three.
* No untested behavior, unnecessary abstraction, or unauthorized functionality has been introduced.
