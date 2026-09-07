import assert from "node:assert/strict"
import { generateKeyPairSync } from "node:crypto"
import { test } from "node:test"
import { mkdtempSync, openSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import {
  runTrustedSupervisor,
  supervisorCommandDigest,
  readProtectedFile,
  readSigningPipe,
} from "../../ops/local-ci/host/trusted-supervisor.mjs"
import { verifyProofPolicy } from "../../ops/local-ci/core/proof-policy.mjs"
import { FULL_HOSTED_ROOTS } from "../../ops/local-ci/core/routing.mjs"

function fixture() {
  const keys = generateKeyPairSync("ed25519")
  const config = {
    version: 1,
    repository: "lapeninns/nabaperks",
    appId: 123,
    sha: "a".repeat(40),
    profile: "main",
    runtimeSha: "b".repeat(40),
    imageDigest: `sha256:${"c".repeat(64)}`,
    attemptId: "fixture-1",
    challenge: "d".repeat(64),
    requestedAt: 1000,
    maxAgeMs: 1000,
    maxDurationMs: 10000,
    commands: FULL_HOSTED_ROOTS.map((lane) => ({
      lane,
      argv: ["node", "fixture.mjs", lane],
      timeoutMs: 1000,
    })),
    resources: {
      kind: "disposable-vm",
      cpus: 2,
      memoryMiB: 4096,
      diskMiB: 8192,
      networkPolicy: "fixture-only",
    },
    adapterPath: "/opt/fixture/adapter.mjs",
    adapterDigest: "e".repeat(64),
    publicKey: keys.publicKey
      .export({ format: "pem", type: "spki" })
      .toString(),
  }
  const events = []
  let number = 0
  let reserved = false
  const adapter = {
    reserveAttempt: async () => {
      if (reserved) return false
      reserved = true
      return true
    },
    allocate: async (request) => {
      events.push(["allocate", request])
      return {
        id: `vm-${number++}`,
        kind: "disposable-vm",
        imageDigest: config.imageDigest,
        runtimeSha: config.runtimeSha,
        sha: config.sha,
        resources: structuredClone(config.resources),
        fresh: true,
        hostMounts: false,
        credentialsForwarded: false,
      }
    },
    execute: async (request) => {
      events.push(["execute", request])
      return { exitCode: 0, signal: null, stdout: "fixture output", stderr: "" }
    },
    destroy: async (request) => {
      events.push(["destroy", request])
    },
    inspectAbsent: async () => true,
  }
  let clock = 1100
  return {
    config,
    privateKey: keys.privateKey.export({ format: "pem", type: "pkcs8" }),
    adapter,
    now: () => clock++,
    events,
  }
}

test("supervisor executes exact protected commands and signs post-destruction resource/log evidence", async () => {
  const input = fixture()
  const result = await runTrustedSupervisor(input)
  assert.equal(result.authorityEligible, false)
  assert.equal(result.route, "hosted")
  assert.deepEqual(result.requiredRoots, FULL_HOSTED_ROOTS)
  assert.equal(result.manifests.length, 9)
  assert.deepEqual(
    input.events.map(([kind]) => kind),
    FULL_HOSTED_ROOTS.flatMap(() => ["allocate", "execute", "destroy"])
  )
  assert.equal(
    verifyProofPolicy({
      envelope: result.envelope,
      policy: {
        ...input.config,
        lanes: FULL_HOSTED_ROOTS,
        commandDigest: supervisorCommandDigest(
          input.config.commands,
          input.config.resources
        ),
      },
      now: result.envelope.payload.completedAt,
      observedLogDigests: result.observedLogDigests,
      publisherAppId: input.config.appId,
    }).valid,
    true
  )
  const sentToAdapter = JSON.stringify(input.events)
  assert.equal(sentToAdapter.includes("PRIVATE KEY"), false)
  assert.equal(sentToAdapter.includes(input.config.publicKey), false)
  assert.equal(JSON.stringify(result).includes("fixture output"), false)
  await assert.rejects(runTrustedSupervisor(input), /replayed or superseded/)
})
for (const [label, mutate] of Object.entries({
  sharedVm: (f) => {
    f.config.resources.kind = "shared-vm"
  },
  incompleteCoverage: (f) => {
    f.config.commands.pop()
  },
  duplicateCoverage: (f) => {
    f.config.commands[1] = f.config.commands[0]
  },
  mismatchedKey: (f) => {
    f.config.publicKey = "another key"
  },
  requestFuture: (f) => {
    f.config.requestedAt = 2000
  },
  candidateAuthorityField: (f) => {
    f.config.authorityEnabled = true
  },
})) {
  test(`rejects ${label} before resource execution`, async () => {
    const input = fixture()
    mutate(input)
    await assert.rejects(runTrustedSupervisor(input))
    assert.equal(input.events.length, 0)
  })
}
for (const [label, override] of Object.entries({
  failingLane: {
    execute: async () => ({
      exitCode: 1,
      signal: null,
      stdout: "",
      stderr: "",
    }),
  },
  cancelledLane: {
    execute: async () => ({
      exitCode: 0,
      signal: "SIGTERM",
      stdout: "",
      stderr: "",
    }),
  },
  forgedResult: {
    execute: async () => ({
      exitCode: 0,
      signal: null,
      stdout: "",
      stderr: "",
      success: true,
    }),
  },
  thrownExecution: {
    execute: async () => {
      throw Error("fixture crash")
    },
  },
  missingCleanup: { inspectAbsent: async () => false },
})) {
  test(`${label} destroys resource and emits no envelope`, async () => {
    const input = fixture()
    Object.assign(input.adapter, override)
    await assert.rejects(runTrustedSupervisor(input))
    assert.equal(input.events.at(-1)[0], "destroy")
  })
}
test("refuses reused resource identity and destroys it", async () => {
  const input = fixture()
  const allocate = input.adapter.allocate
  input.adapter.allocate = async (request) => ({
    ...(await allocate(request)),
    id: "reused",
  })
  await assert.rejects(runTrustedSupervisor(input), /reused/)
  assert.equal(input.events.filter(([kind]) => kind === "execute").length, 1)
  assert.equal(input.events.filter(([kind]) => kind === "destroy").length, 2)
})
test("resource policy and commands alter signed command digest", () => {
  const input = fixture()
  const digest = supervisorCommandDigest(
    input.config.commands,
    input.config.resources
  )
  input.config.resources.cpus += 1
  assert.notEqual(
    supervisorCommandDigest(input.config.commands, input.config.resources),
    digest
  )
})
test("protected file loader rejects candidate-owned worktree path", async () => {
  await assert.rejects(
    readProtectedFile(new URL(import.meta.url).pathname),
    /root-owned|symlinks/
  )
})

test("runtime revision is independently bound before execution and retained in signed resource evidence", async () => {
  const input = fixture()
  const result = await runTrustedSupervisor(input)
  for (const [, request] of input.events.filter(
    ([kind]) => kind === "allocate"
  )) {
    assert.equal(request.runtimeSha, input.config.runtimeSha)
  }
  assert.equal(
    result.manifests.every(
      (manifest) => manifest.resource.runtimeSha === input.config.runtimeSha
    ),
    true
  )
  const mismatched = fixture()
  const allocate = mismatched.adapter.allocate
  mismatched.adapter.allocate = async (request) => ({
    ...(await allocate(request)),
    runtimeSha: "f".repeat(40),
  })
  await assert.rejects(
    runTrustedSupervisor(mismatched),
    /Unqualified resource allocation/
  )
  assert.equal(
    mismatched.events.some(([kind]) => kind === "execute"),
    false
  )
  assert.equal(mismatched.events.at(-1)[0], "destroy")
})

test("signing pipe reads bounded bytes and refuses regular files or oversized streams", () => {
  const root = mkdtempSync(join(tmpdir(), "supervisor-pipe-"))
  try {
    const ordinary = join(root, "ordinary")
    writeFileSync(ordinary, "fixture")
    assert.throws(
      () => readSigningPipe(openSync(ordinary, "r")),
      /must be a pipe/
    )
    const producer = join(root, "producer.mjs")
    const consumer = join(root, "consumer.mjs")
    const moduleUrl = new URL(
      "../../ops/local-ci/host/trusted-supervisor.mjs",
      import.meta.url
    ).href
    writeFileSync(
      consumer,
      `import {readSigningPipe} from ${JSON.stringify(moduleUrl)}; try {const bytes=readSigningPipe(0); console.log(bytes.length); bytes.fill(0)} catch {process.exitCode=7}`
    )
    for (const [length, status] of [
      [16, 0],
      [16385, 7],
    ]) {
      writeFileSync(
        producer,
        `process.stdout.write(Buffer.alloc(${length}, 120))`
      )
      const result = spawnSync(
        "sh",
        [
          "-c",
          '\"$1\" \"$2\" | \"$1\" \"$3\"',
          "fixture",
          process.execPath,
          producer,
          consumer,
        ],
        { encoding: "utf8" }
      )
      assert.equal(result.status, status, result.stderr)
      if (status === 0) assert.equal(result.stdout.trim(), String(length))
    }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
