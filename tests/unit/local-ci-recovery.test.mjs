import assert from "node:assert/strict"
import { test } from "node:test"
import {
  recoveryPlan,
  reconcileAgentResources,
} from "../../ops/local-ci/agent/recovery.mjs"

const sha = "a".repeat(40)
const profiles = { pr: ["quality"] }
const resource = (kind, id) => ({
  id: id.repeat(64),
  name: `nabaperks-ci-${kind}-${sha.slice(0, 12)}-quality-1`,
  labels: {
    "com.nabaperks.local-ci.head-sha": sha,
    "com.nabaperks.local-ci.lane": "quality",
    "com.nabaperks.local-ci.profile": "pr",
  },
})
const job = resource("job", "1"),
  daemon = resource("dind", "2"),
  network = resource("net", "3")

test("recovery validates the complete inventory and orders immutable IDs", () => {
  assert.deepEqual(
    recoveryPlan({
      containers: [daemon, job],
      networks: [{ ...network, containers: { [job.id]: {} } }],
      profiles,
    }).map((x) => x.id),
    [job.id, daemon.id, network.id]
  )
  for (const broken of [
    { ...job, labels: {} },
    { ...job, id: "bad" },
    { ...job, name: job.name.replace("quality", "foreign") },
  ])
    assert.throws(
      () => recoveryPlan({ containers: [broken], networks: [], profiles }),
      /Unverifiable/
    )
  assert.throws(
    () =>
      recoveryPlan({
        containers: [job],
        networks: [{ ...network, containers: { ["f".repeat(64)]: {} } }],
        profiles,
      }),
    /unrelated endpoint/
  )
})

function runtime({
  invalid = false,
  leftovers = false,
  leaseFailure = false,
} = {}) {
  let removed = false,
    leases = 0
  const calls = []
  const options = {
    vm: "test",
    stateRoot: "/unused",
    profiles,
    assertLease() {
      leases++
      if (leaseFailure) throw Error("lease denied")
    },
    exec: async (argv) => {
      const args = argv.slice(5)
      calls.push(args)
      if (args[0] === "ps")
        return !removed || leftovers
          ? `${job.name}\nunrelated-development`
          : "unrelated-development"
      if (args[0] === "network" && args[1] === "ls") return "unrelated-network"
      if (args[0] === "inspect")
        return JSON.stringify(invalid ? { ...job, labels: {} } : job)
      if (args[0] === "rm") {
        assert.deepEqual(args, ["rm", "--force", job.id])
        removed = true
        return ""
      }
      throw Error(`Unexpected ${args}`)
    },
  }
  return {
    options,
    calls,
    get leases() {
      return leases
    },
  }
}

test("recovery owns the lease, preserves unrelated resources and rechecks absence", async () => {
  const mock = runtime()
  assert.deepEqual(await reconcileAgentResources(mock.options), {
    recovered: [job.name],
  })
  assert.equal(mock.leases, 2)
  for (const flags of [{ invalid: true }, { leaseFailure: true }]) {
    const denied = runtime(flags)
    await assert.rejects(reconcileAgentResources(denied.options))
    assert.equal(
      denied.calls.some((args) => args[0] === "rm"),
      false
    )
  }
  await assert.rejects(
    reconcileAgentResources(runtime({ leftovers: true }).options),
    /absence/
  )
})

test("recovery fails closed on unreadable inventory and total deadline", async () => {
  await assert.rejects(
    reconcileAgentResources({
      ...runtime().options,
      exec: async () => {
        throw Error("read unavailable")
      },
    }),
    /read unavailable/
  )
  let time = 0
  await assert.rejects(
    reconcileAgentResources({
      ...runtime().options,
      now: () => {
        time += 120001
        return time
      },
    }),
    /deadline/
  )
})
