import assert from "node:assert/strict"
import { test } from "node:test"

import {
  resolveDrainOptions,
  shouldContinueDraining,
  shouldProcessNextEvent,
} from "@/lib/notifications/drain-plan"

/**
 * notifications drain throughput — pure drain-decision tier.
 *
 * resolveDrainOptions clamps the run budget to the claim RPC's 1..500
 * window; shouldContinueDraining decides whether the worker claims another
 * batch (queue drained / max-events budget / soft time budget).
 */

test("resolveDrainOptions defaults preserve single-batch behavior", () => {
  const options = resolveDrainOptions({})
  assert.equal(options.batchSize, 50)
  assert.equal(options.maxEvents, 50)
  assert.equal(options.timeBudgetMs, null)
})

test("resolveDrainOptions clamps batchSize to the RPC's 1..500 window", () => {
  assert.equal(resolveDrainOptions({ batchSize: 0 }).batchSize, 1)
  assert.equal(resolveDrainOptions({ batchSize: -5 }).batchSize, 1)
  assert.equal(resolveDrainOptions({ batchSize: 501 }).batchSize, 500)
  assert.equal(resolveDrainOptions({ batchSize: 99.9 }).batchSize, 99)
  assert.equal(resolveDrainOptions({ batchSize: Number.NaN }).batchSize, 50)
  assert.equal(resolveDrainOptions({ batchSize: undefined }).batchSize, 50)
})

test("resolveDrainOptions keeps maxEvents at least one batch and caps it", () => {
  assert.equal(
    resolveDrainOptions({ batchSize: 100, maxEvents: 10 }).maxEvents,
    100,
    "maxEvents below one batch rounds up to the batch size"
  )
  assert.equal(
    resolveDrainOptions({ batchSize: 50, maxEvents: 400 }).maxEvents,
    400
  )
  assert.equal(
    resolveDrainOptions({ batchSize: 50, maxEvents: 1_000_000 }).maxEvents,
    5000,
    "maxEvents caps at 5,000 per invocation"
  )
  assert.equal(
    resolveDrainOptions({ batchSize: 100 }).maxEvents,
    100,
    "maxEvents defaults to one batch"
  )
})

test("resolveDrainOptions normalizes the time budget", () => {
  assert.equal(
    resolveDrainOptions({ timeBudgetMs: 240_000 }).timeBudgetMs,
    240_000
  )
  assert.equal(resolveDrainOptions({ timeBudgetMs: 0 }).timeBudgetMs, null)
  assert.equal(resolveDrainOptions({ timeBudgetMs: -1 }).timeBudgetMs, null)
  assert.equal(
    resolveDrainOptions({ timeBudgetMs: Number.NaN }).timeBudgetMs,
    null
  )
})

test("a short batch stops the drain (queue is empty)", () => {
  const options = resolveDrainOptions({ batchSize: 100, maxEvents: 500 })
  assert.equal(
    shouldContinueDraining({ processed: 40, lastBatchSize: 40 }, options, 1000),
    false
  )
  assert.equal(
    shouldContinueDraining({ processed: 0, lastBatchSize: 0 }, options, 0),
    false,
    "an empty batch always exits"
  )
})

test("a full batch continues until the maxEvents budget is spent", () => {
  const options = resolveDrainOptions({ batchSize: 100, maxEvents: 500 })
  assert.equal(
    shouldContinueDraining(
      { processed: 100, lastBatchSize: 100 },
      options,
      1000
    ),
    true
  )
  assert.equal(
    shouldContinueDraining(
      { processed: 500, lastBatchSize: 100 },
      options,
      1000
    ),
    false,
    "reaching maxEvents stops the loop"
  )
  assert.equal(
    shouldContinueDraining(
      { processed: 620, lastBatchSize: 220 },
      options,
      1000
    ),
    false,
    "an oversized batch still counts fully against the budget"
  )
})

test("the soft time budget stops the drain when set", () => {
  const options = resolveDrainOptions({
    batchSize: 100,
    maxEvents: 5000,
    timeBudgetMs: 240_000,
  })
  assert.equal(
    shouldContinueDraining(
      { processed: 100, lastBatchSize: 100 },
      options,
      239_999
    ),
    true
  )
  assert.equal(
    shouldContinueDraining(
      { processed: 100, lastBatchSize: 100 },
      options,
      240_000
    ),
    false
  )
  const unbudgeted = resolveDrainOptions({ batchSize: 100, maxEvents: 5000 })
  assert.equal(
    shouldContinueDraining(
      { processed: 100, lastBatchSize: 100 },
      unbudgeted,
      86_400_000
    ),
    true,
    "no time budget means elapsed time never stops the loop"
  )
})

test("per-event processing checks the max event and time budgets", () => {
  const options = resolveDrainOptions({
    batchSize: 100,
    maxEvents: 250,
    timeBudgetMs: 10_000,
  })

  assert.equal(shouldProcessNextEvent(249, options, 9_999), true)
  assert.equal(
    shouldProcessNextEvent(250, options, 9_999),
    false,
    "maxEvents stops before the next event starts"
  )
  assert.equal(
    shouldProcessNextEvent(249, options, 10_000),
    false,
    "timeBudgetMs stops before the next event starts"
  )
})
