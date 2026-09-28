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

/* ----------------------------------------------- the shared Docker Desktop daemon */

const DOCKER = ["/usr/local/bin/docker", "--context", "desktop-linux"]
const short = sha.slice(0, 12)
const infra = (role, name, id, withSha = true) => ({
  id: id.repeat(64),
  name,
  labels: {
    "com.nabaperks.local-ci.role": role,
    ...(withSha ? { "com.nabaperks.local-ci.head-sha": sha } : {}),
  },
})

test("a shared-daemon plan validates every agent role and never plans the state volume", () => {
  const proxy = infra("proxy", `nabaperks-ci-proxy-${short}`, "4")
  const helper = infra("helper", "nabaperks-ci-helper-0123456789ab", "5")
  const canary = infra("canary", "nabaperks-ci-canary-0123456789ab", "6", false)
  const prep = {
    ...infra("prep", `nabaperks-ci-prep-${short}`, "7"),
    containers: { [proxy.id]: {} },
  }
  const plan = recoveryPlan({
    containers: [
      proxy,
      helper,
      canary,
      {
        ...job,
        labels: { ...job.labels, "com.nabaperks.local-ci.role": "job" },
      },
    ],
    networks: [prep],
    volumes: [
      {
        name: "nabaperks-ci-vol-leftover",
        labels: { "com.nabaperks.local-ci.role": "lane" },
      },
      {
        name: "nabaperks-ci-state",
        labels: { "com.nabaperks.local-ci.role": "state" },
      },
    ],
    protectedVolumes: ["nabaperks-ci-state"],
    profiles,
  })
  assert.deepEqual(
    plan.map((entry) => [entry.kind, entry.name]),
    [
      ["container", proxy.name],
      ["container", helper.name],
      ["container", canary.name],
      ["container", job.name],
      ["network", prep.name],
      ["volume", "nabaperks-ci-vol-leftover"],
    ]
  )
  for (const broken of [
    infra("proxy", `nabaperks-ci-proxy-${"f".repeat(12)}`, "4"),
    infra("proxy", "nabaperks-ci-helper-0123456789ab", "4"),
    infra("netguard", "nabaperks-ci-netguard", "4"),
    infra("egress", `nabaperks-ci-egress-${short}`, "4"),
    { ...infra("proxy", `nabaperks-ci-proxy-${short}`, "4"), id: "short" },
  ])
    assert.throws(
      () => recoveryPlan({ containers: [broken], networks: [], profiles }),
      /Unverifiable/,
      broken.name
    )
  assert.throws(
    () =>
      recoveryPlan({
        containers: [],
        networks: [],
        volumes: [
          {
            name: "nabaperks-ci-state",
            labels: { "com.nabaperks.local-ci.role": "state" },
          },
        ],
        profiles,
      }),
    /Unverifiable/
  )
})

test("the shared-daemon sweep lists only the agent's labels and prefix and removes by ID, volumes last", async () => {
  const proxy = infra("proxy", `nabaperks-ci-proxy-${short}`, "4")
  const calls = []
  let removed = false
  const result = await reconcileAgentResources({
    docker: DOCKER,
    stateRoot: "/unused",
    profiles,
    labelFilters: ["nabaperks-ci-dev=1"],
    protectedVolumes: ["nabaperks-ci-state"],
    assertLease() {},
    exec: async (argv) => {
      assert.deepEqual(argv.slice(0, 3), DOCKER)
      const args = argv.slice(3)
      calls.push(args)
      if (
        ["ps", "network", "volume"].includes(args[0]) &&
        args.includes("--filter")
      ) {
        assert.ok(args.includes("label=com.nabaperks.local-ci.role"))
        assert.ok(args.includes("label=nabaperks-ci-dev=1"))
      }
      if (args[0] === "ps")
        // A foreign name that somehow carries the label is still ignored.
        return removed ? "" : `${proxy.name}\nsupabase_db_other_stack`
      if (args[0] === "network" && args[1] === "ls") return ""
      if (args[0] === "volume" && args[1] === "ls")
        return removed
          ? "nabaperks-ci-state"
          : "nabaperks-ci-state\nnabaperks-ci-vol-leftover\nnabaperks-local-ci-pnpm-store"
      if (args[0] === "inspect") return JSON.stringify(proxy)
      if (args[0] === "volume" && args[1] === "inspect")
        return JSON.stringify({
          name: "nabaperks-ci-vol-leftover",
          labels: { "com.nabaperks.local-ci.role": "lane" },
        })
      if (args[0] === "rm") {
        assert.deepEqual(args, ["rm", "--force", proxy.id])
        return ""
      }
      if (args[0] === "volume" && args[1] === "rm") {
        assert.deepEqual(args, ["volume", "rm", "nabaperks-ci-vol-leftover"])
        removed = true
        return ""
      }
      throw Error(`Unexpected ${args}`)
    },
  })
  assert.deepEqual(result.recovered, [proxy.name, "nabaperks-ci-vol-leftover"])
  assert.equal(
    calls.some((args) => args.join(" ").includes("prune")),
    false
  )
  assert.equal(
    calls.some((args) => args.includes("supabase_db_other_stack")),
    false
  )
  assert.equal(
    calls.some((args) => args.includes("nabaperks-local-ci-pnpm-store")),
    false
  )
})
