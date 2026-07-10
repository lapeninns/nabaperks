import assert from "node:assert/strict"
import { test } from "node:test"

import { scheduleAfterResponseAnalytics } from "@/lib/analytics/after-response"

test("auth analytics registers an injected hanging task without waiting", async () => {
  const neverSettles = new Promise(() => {})
  let registeredTask
  let registeredPromise
  let taskStarted = false

  const result = scheduleAfterResponseAnalytics(
    (task) => {
      registeredTask = task
      registeredPromise = task()
    },
    async () => {
      taskStarted = true
      await neverSettles
    }
  )

  assert.equal(result, undefined)
  assert.equal(typeof registeredTask, "function")
  assert.equal(taskStarted, true)
  assert.equal(
    await Promise.race([
      registeredPromise.then(() => "settled"),
      Promise.resolve("still-registered"),
    ]),
    "still-registered",
    "the after task can remain pending without entering the auth action's return path"
  )
})

test("auth analytics fails open when registration or deferred work fails", async () => {
  assert.doesNotThrow(() =>
    scheduleAfterResponseAnalytics(
      () => {
        throw new Error("request lifecycle unavailable")
      },
      async () => {}
    )
  )

  let registeredTask
  scheduleAfterResponseAnalytics(
    (task) => {
      registeredTask = task
    },
    async () => {
      throw new Error("analytics unavailable")
    }
  )

  await assert.doesNotReject(registeredTask())
})
