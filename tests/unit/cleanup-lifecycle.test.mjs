import assert from "node:assert/strict"
import { test } from "node:test"

import { runCleanupSteps } from "../e2e/helpers/cleanup-lifecycle.ts"

test("Given a middle cleanup failure When cleanup continues Then the first error is preserved and later resources are removed", async () => {
  // Given
  const resources = new Set(["first", "middle", "last"])
  const firstFailure = new Error("injected middle cleanup failure")

  // When
  const failure = await runCleanupSteps(
    [
      {
        label: "first cleanup",
        run: async () => {
          resources.delete("first")
        },
      },
      {
        label: "middle cleanup",
        run: async () => {
          resources.delete("middle")
          throw firstFailure
        },
      },
      {
        label: "last cleanup",
        run: async () => {
          resources.delete("last")
        },
      },
    ],
    "fixture cleanup failed"
  ).then(
    () => undefined,
    (error) => error
  )

  // Then
  assert.deepEqual([...resources], [])
  assert.ok(failure instanceof AggregateError)
  assert.equal(failure.errors.length, 1)
  assert.equal(failure.errors[0].cause, firstFailure)
})

test("Given an earlier cleanup failure When residue readback runs Then residue is still observed", async () => {
  // Given
  let readbackRan = false

  // When
  await assert.rejects(
    runCleanupSteps(
      [
        {
          label: "injected cleanup",
          run: async () => {
            throw new Error("injected failure")
          },
        },
        {
          label: "zero-residue readback",
          run: async () => {
            readbackRan = true
          },
        },
      ],
      "fixture cleanup failed"
    ),
    AggregateError
  )

  // Then
  assert.equal(readbackRan, true)
})
