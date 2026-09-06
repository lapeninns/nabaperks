import assert from "node:assert/strict"
import {
  mkdtempSync,
  rmSync,
  readFileSync,
  writeFileSync,
  statSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import { createAttemptJournal } from "../../ops/local-ci/core/attempts.mjs"
import { createLoop } from "../../ops/local-ci/agent/loop.mjs"
import { loadContract } from "../../ops/local-ci/core/contract.mjs"

const job = { profile: "main", ref: "refs/heads/main", sha: "a".repeat(40) }
const contract = loadContract((path) => readFileSync(path, "utf8"))
function fixture(t) {
  const directory = mkdtempSync(join(tmpdir(), "local-ci-attempts-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, "attempts.json")
  const open = (options = {}) =>
    createAttemptJournal({ path, retryDelayMs: 0, ...options })
  return { path, open }
}
function harness(attempts, runProfile) {
  const published = []
  const loop = createLoop({
    contract,
    attempts,
    github: {
      getRef: async () => ({ ref: job.ref, sha: job.sha }),
      listOpenPullRequests: async () => [],
      createCheckRun: async (payload) => {
        published.push(payload)
        return { id: 123 }
      },
      updateCheckRun: async (id, payload) => {
        published.push(payload)
        return { id }
      },
    },
    runner: { runProfile },
    loadProfile: async () => ({ profile: "main" }),
  })
  return { loop, published }
}
const result = (conclusion = "success") => ({
  record: {
    headSha: job.sha,
    profile: "main",
    conclusion,
    durationSeconds: 1,
    logDigest: "a".repeat(64),
    lanes: [],
  },
})

test("restart recovers interrupted work and bounds retries without fabricating success", (t) => {
  const { open, path } = fixture(t)
  const first = open()
  first.begin(job)
  assert.equal(first.eligible(job), false)
  const recovered = open()
  assert.equal(recovered.entries[0].status, "interrupted")
  assert.equal(
    recovered.eligible(job),
    false,
    "recovery publication must precede retry"
  )
  recovered.published(recovered.entries[0].id)
  const second = recovered.begin(job)
  recovered.finish(second, "incomplete")
  recovered.published(second)
  assert.equal(open().eligible(job), false)
  assert.equal(statSync(path).mode & 0o777, 0o600)
})

test("success, test failure and supersession are never automatically retried", (t) => {
  for (const status of ["success", "failure", "superseded"]) {
    const { open } = fixture(t)
    const journal = open()
    const id = journal.begin(job)
    journal.finish(id, status, status === "success" ? result().record : null)
    journal.published(id)
    assert.equal(open().eligible(job), false)
    assert.equal(open().eligible({ ...job, sha: "b".repeat(40) }), true)
  }
})

test("timeout and cancellation retry only after publication and backoff", (t) => {
  const { open } = fixture(t)
  let now = 100_000
  const journal = open({ now: () => now, retryDelayMs: 60_000 })
  const id = journal.begin(job)
  journal.finish(id, "timed_out")
  journal.published(id)
  assert.equal(journal.eligible(job), false)
  now += 60_000
  const retry = journal.begin(job)
  journal.finish(retry, "cancelled")
  journal.published(retry)
  now += 60_000
  assert.equal(journal.eligible(job), false)
})

test("malformed journal and failed atomic persistence fail closed", (t) => {
  const { open, path } = fixture(t)
  writeFileSync(path, '{"schema":')
  assert.throws(() => open())
  rmSync(path)
  const journal = open({
    write: () => {
      throw new Error("disk full")
    },
  })
  assert.throws(() => journal.begin(job), /disk full/)
  assert.throws(() => journal.eligible(job), /restart required/)
})

test("loop retries infrastructure failures once and suppresses duplicate work across restart", async (t) => {
  const { open } = fixture(t)
  let runs = 0
  const { loop } = harness(open(), async () => {
    runs += 1
    if (runs === 1) throw new Error("VM startup failed")
    return result()
  })
  await loop.tick()
  await assert.rejects(loop.settle(), /VM startup failed/)
  await loop.tick()
  await loop.settle()
  assert.equal(runs, 2)
  const restarted = harness(open(), async () => {
    runs += 1
    return result()
  })
  await restarted.loop.tick()
  assert.equal(runs, 2)
})

test("loop publishes crash recovery failure before starting a fresh attempt", async (t) => {
  const { open } = fixture(t)
  const journal = open()
  journal.attachCheck(journal.begin(job), 456)
  const { loop, published } = harness(open(), async () => result())
  await loop.tick()
  await loop.settle()
  assert.equal(published[0].conclusion, "failure")
  assert.equal(open().entries[0].status, "interrupted")
  assert.equal(open().entries[1].status, "success")
})

test("failed journal admission never dispatches candidate code", async (t) => {
  const { open } = fixture(t)
  let runs = 0
  const { loop } = harness(
    open({
      write: () => {
        throw new Error("disk full")
      },
    }),
    async () => {
      runs += 1
      return result()
    }
  )
  await assert.rejects(loop.tick(), /disk full/)
  assert.equal(runs, 0)
})

test("publication outage replays durable result after restart without rerunning tests", async (t) => {
  const { open } = fixture(t)
  let runs = 0
  // The injectable publisher models an outage after successful execution.
  const github = {
    getRef: async () => ({ ref: job.ref, sha: job.sha }),
    listOpenPullRequests: async () => [],
    createCheckRun: async () => ({ id: 123 }),
    updateCheckRun: async () => {
      throw new Error("GitHub offline")
    },
  }
  const first = createLoop({
    contract,
    attempts: open(),
    github,
    loadProfile: async () => ({ profile: "main" }),
    runner: {
      runProfile: async () => {
        runs += 1
        return result()
      },
    },
  })
  await first.tick()
  await first.settle()
  assert.equal(open().entries[0].published, false)
  const restarted = harness(open(), async () => {
    runs += 1
    return result()
  })
  await restarted.loop.tick()
  assert.equal(runs, 1)
  assert.equal(restarted.published[0].conclusion, "success")
  assert.equal(open().entries[0].published, true)
})

test("a runner ignoring cancellation cannot publish successful proof", async (t) => {
  const { open } = fixture(t)
  let enter
  const entered = new Promise((resolve) => {
    enter = resolve
  })
  let finish
  const pending = new Promise((resolve) => {
    finish = resolve
  })
  const { loop, published } = harness(open(), async () => {
    enter()
    await pending
    return result()
  })
  await loop.tick()
  await entered
  loop.stop()
  finish()
  await loop.settle()
  assert.equal(published.at(-1).conclusion, "cancelled")
  assert.equal(open().entries[0].status, "cancelled")
})

test("one-shot and nightly dispatch share durable semantics, and local-only proof stays unpublished", async (t) => {
  const { executeDurableRun } =
    await import("../../ops/local-ci/agent/main.mjs")
  const { open } = fixture(t)
  const journal = open()
  let runs = 0
  const publications = []
  const args = {
    journal,
    profile: { profile: "main" },
    ref: job.ref,
    headSha: job.sha,
    dispatch: async () => {
      runs += 1
      return result()
    },
  }
  await executeDurableRun(args)
  assert.equal(journal.entries[0].publish, false)
  assert.equal(journal.entries[0].published, true)
  await executeDurableRun(args)
  assert.equal(runs, 1)
  const nightly = {
    ...args,
    profile: { profile: "nightly" },
    publish: async (entry) => {
      publications.push(entry)
    },
    dispatch: async () => {
      runs += 1
      return { record: { ...result().record, profile: "nightly" } }
    },
  }
  await executeDurableRun({ ...nightly, now: () => Date.parse("2026-09-07") })
  await executeDurableRun({ ...nightly, now: () => Date.parse("2026-09-07") })
  await executeDurableRun({ ...nightly, now: () => Date.parse("2026-09-08") })
  assert.equal(runs, 3)
  assert.equal(publications.length, 2)
})

test("one-shot publisher retry uses prior durable outcome without rerunning candidate", async (t) => {
  const { executeDurableRun } =
    await import("../../ops/local-ci/agent/main.mjs")
  const { open } = fixture(t)
  let runs = 0
  const args = {
    profile: { profile: "main" },
    ref: job.ref,
    headSha: job.sha,
    dispatch: async () => {
      runs += 1
      return result()
    },
  }
  await assert.rejects(
    executeDurableRun({
      ...args,
      journal: open(),
      publish: async () => {
        throw new Error("offline")
      },
    }),
    /offline/
  )
  const published = []
  await executeDurableRun({
    ...args,
    journal: open(),
    publish: async (entry) => {
      published.push(entry)
    },
  })
  assert.equal(runs, 1)
  assert.equal(published.length, 1)
  assert.equal(published[0].status, "success")
})

test("nightly crash recovery publishes failure and retries despite an already-created evidence directory", async (t) => {
  const { executeDurableRun, nightlyTick } =
    await import("../../ops/local-ci/agent/main.mjs")
  const { open } = fixture(t)
  const now = Date.now()
  const previous = open({ now: () => now })
  previous.begin({
    ...job,
    profile: "nightly",
    scope: `commit:${new Date(now).toISOString().slice(0, 10)}`,
  })
  const journal = open({ now: () => now })
  const published = []
  const publish = async (entry) => {
    published.push(entry.status)
  }
  const outcome = await nightlyTick({
    contract,
    attempts: journal,
    publishPending: publish,
    now: () => now,
    logger: { info() {}, error() {} },
    evidence: { lastRunAt: () => now },
    github: { getRef: async () => ({ sha: job.sha, ref: job.ref }) },
    loadProfileFor: () => ({ profile: "nightly" }),
    dispatch: (args) =>
      executeDurableRun({
        journal,
        ...args,
        now: () => now,
        publish,
        dispatch: async () => ({
          record: { ...result().record, profile: "nightly" },
        }),
      }),
  })
  assert.equal(outcome.ran, true)
  assert.deepEqual(published, ["interrupted", "success"])
  assert.equal(journal.entries.length, 2)
})

test("watcher and nightly publication contenders cannot publish the same attempt concurrently", async (t) => {
  const { publishAttempt } =
    await import("../../ops/local-ci/core/attempts.mjs")
  const { open } = fixture(t)
  const journal = open()
  const id = journal.begin(job)
  journal.finish(id, "success", result().record)
  let resolve
  const pending = new Promise((done) => {
    resolve = done
  })
  let calls = 0
  const publish = async () => {
    calls += 1
    await pending
  }
  const first = publishAttempt(journal, id, publish)
  assert.equal(await publishAttempt(journal, id, publish), false)
  resolve()
  await first
  assert.equal(calls, 1)
  assert.equal(journal.entries[0].published, true)
})

test("shutdown during outbox publication cannot admit a run or persist after ownership ends", async (t) => {
  const { open, path } = fixture(t)
  const journal = open()
  const id = journal.begin(job)
  journal.finish(id, "incomplete")
  let entered
  const enteredPublication = new Promise((resolve) => {
    entered = resolve
  })
  let resume
  const publication = new Promise((resolve) => {
    resume = resolve
  })
  let runs = 0
  const loop = createLoop({
    contract,
    attempts: journal,
    github: {
      getRef: async () => ({ sha: job.sha, ref: job.ref }),
      listOpenPullRequests: async () => [],
      createCheckRun: async () => {
        entered()
        await publication
        return { id: 77 }
      },
      updateCheckRun: async () => {
        throw new Error("unexpected")
      },
    },
    loadProfile: async () => ({ profile: "main" }),
    runner: {
      runProfile: async () => {
        runs += 1
        return result()
      },
    },
  })
  const started = loop.start()
  await enteredPublication
  loop.stop()
  await started
  const stoppedJournal = readFileSync(path, "utf8")
  resume()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(runs, 0)
  assert.equal(loop.state.jobs.length, 0)
  assert.equal(readFileSync(path, "utf8"), stoppedJournal)
  assert.equal(journal.entries[0].published, false)
})
