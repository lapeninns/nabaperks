import assert from "node:assert/strict"
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  openSync,
  closeSync,
  fstatSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"
import {
  createLimaDisposableAdapter,
  disposableTemplate,
  runBounded,
} from "../../ops/local-ci/host/lima-disposable-adapter.mjs"
const expected = {
  repository: "lapeninns/nabaperks",
  sha: "a".repeat(40),
  runtimeSha: "b".repeat(40),
  profile: "pr",
  attemptId: "attempt-1",
  challenge: "c".repeat(64),
}
const resources = {
  kind: "disposable-vm",
  cpus: 2,
  memoryMiB: 2048,
  diskMiB: 8192,
  networkPolicy: "fixture-only",
}
function fixture(t, hooks = {}) {
  const dir = mkdtempSync(join(tmpdir(), "disposable-fixture-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const config = {
    version: 1,
    expected,
    serviceUid: 700,
    stateRoot: join(dir, "state"),
    inputRoot: join(dir, "inputs"),
    limaHome: join(dir, "lima"),
    serviceHome: join(dir, "home"),
    limactl: "/protected/bin/limactl",
    limactlDigest: `sha256:${"f".repeat(64)}`,
    imagePath: "/protected/image.qcow2",
    imageDigest: `sha256:${"d".repeat(64)}`,
    bundlePath: "/protected/source.bundle",
    bundleDigest: `sha256:${"e".repeat(64)}`,
    maxResources: resources,
    arch: "aarch64",
    vmType: "qemu",
  }
  const calls = [],
    machines = new Map()
  const firewall = JSON.stringify({
    nftables: [
      { chain: { name: "input", policy: "drop" } },
      { chain: { name: "output", policy: "drop" } },
    ],
  })
  const run = async (executable, allArgs, options) => {
    const args = allArgs.slice(allArgs.indexOf("--tty=false") + 1)
    calls.push({ executable, allArgs, args, options })
    if (hooks.run) {
      const override = await hooks.run(args, machines)
      if (override) return override
    }
    let stdout = ""
    if (args[0] === "list")
      stdout = [...machines.values()]
        .map((entry) => JSON.stringify(entry))
        .join("\n")
    if (args[0] === "create") {
      const template = JSON.parse(readFileSync(args[3], "utf8"))
      machines.set(args[2], {
        name: args[2],
        config: template,
        status: "Stopped",
        arch: config.arch,
        vmType: config.vmType,
        cpus: resources.cpus,
        memory: resources.memoryMiB * 1024 * 1024,
        disk: resources.diskMiB * 1024 * 1024,
      })
      if (hooks.create) await hooks.create(args, machines)
    }
    if (args[0] === "start") machines.get(args[2]).status = "Running"
    if (args[0] === "delete") {
      if (!hooks.retainDeleted) machines.delete(args[2])
    }
    if (args[0] === "shell" && options.input?.includes("nft -f"))
      stdout = hooks.runtimeSha ?? expected.runtimeSha
    if (args.includes("nft") && args.includes("list")) stdout = firewall
    if (args.includes("/usr/bin/timeout")) stdout = "fixture test output"
    return { exitCode: 0, signal: null, stdout, stderr: "" }
  }
  const make = (overrides = {}) =>
    createLimaDisposableAdapter({
      config: { ...config, ...overrides },
      run,
      uid: () => 0,
      verifyPath: () => {},
      digest: async (path) =>
        path === config.limactl
          ? config.limactlDigest
          : path === config.imagePath
            ? config.imageDigest
            : config.bundleDigest,
    })
  return {
    config,
    make,
    calls,
    machines,
    request: {
      ...expected,
      lane: "fast",
      imageDigest: config.imageDigest,
      resources,
    },
  }
}
test("fresh VM lifecycle binds image/runtime, isolates host secrets and proves deletion", async (t) => {
  const f = fixture(t),
    adapter = f.make()
  assert.equal(await adapter.reserveAttempt(expected), true)
  const allocation = await adapter.allocate(f.request)
  assert.equal(allocation.fresh, true)
  assert.equal(allocation.runtimeSha, expected.runtimeSha)
  assert.equal(allocation.hostMounts, false)
  const result = await adapter.execute({
    resourceId: allocation.id,
    argv: ["pnpm", "test:unit"],
    timeoutMs: 5000,
  })
  assert.equal(result.exitCode, 0)
  await adapter.destroy({ resourceId: allocation.id })
  assert.equal(await adapter.inspectAbsent({ resourceId: allocation.id }), true)
  assert.equal(f.calls.filter((entry) => entry.args[0] === "create").length, 1)
  assert.ok(
    f.calls.every(
      (entry) =>
        !entry.args.includes("clone") && !entry.args.includes("--preserve-env")
    )
  )
  assert.ok(
    f.calls.every(
      (entry) =>
        Object.keys(entry.options.env).sort().join() === "HOME,LANG,PATH"
    )
  )
  assert.ok(f.calls.some((entry) => entry.allArgs.includes("#700")))
  assert.ok(
    f.calls.some(
      (entry) =>
        entry.args.includes("#2000") && entry.args.includes("/usr/bin/timeout")
    )
  )
  assert.equal(await adapter.reserveAttempt(expected), false)
})
test("allocation error before ID return destroys its journalled resource", async (t) => {
  const f = fixture(t, { runtimeSha: "f".repeat(40) }),
    adapter = f.make()
  await adapter.reserveAttempt(expected)
  await assert.rejects(adapter.allocate(f.request), /runtime revision/)
  assert.equal(f.machines.size, 0)
  const state = JSON.parse(
    readFileSync(join(f.config.stateRoot, "resources.json"), "utf8")
  )
  assert.equal(state.resources[0].status, "destroyed")
})
test("crash after create reconciles owned intent before refusing attempt replay", async (t) => {
  let failCleanup = true
  const f = fixture(t, {
    create: async () => {
      throw new Error("lost create response")
    },
    run: async (args) => {
      if (args[0] === "delete" && failCleanup)
        throw new Error("provider offline")
    },
  })
  const first = f.make()
  await first.reserveAttempt(expected)
  await assert.rejects(first.allocate(f.request), /provider offline/)
  assert.equal(f.machines.size, 1)
  failCleanup = false
  assert.equal(await f.make().reserveAttempt(expected), false)
  assert.equal(f.machines.size, 0)
})
test("wrong admission, excessive resources and foreign cleanup never create/delete a VM", async (t) => {
  const f = fixture(t),
    adapter = f.make()
  await assert.rejects(
    adapter.reserveAttempt({ ...expected, sha: "f".repeat(40) }),
    /independently admitted/
  )
  await adapter.reserveAttempt(expected)
  await assert.rejects(
    adapter.allocate({ ...f.request, resources: { ...resources, cpus: 999 } }),
    /resource policy/
  )
  await assert.rejects(
    adapter.destroy({ resourceId: "nabaperks-ci" }),
    /foreign/
  )
  assert.equal(
    f.calls.filter((entry) => ["create", "delete"].includes(entry.args[0]))
      .length,
    0
  )
})
test("failed absent readback leaves resource pending and refuses success", async (t) => {
  const f = fixture(t, { retainDeleted: true }),
    adapter = f.make()
  await adapter.reserveAttempt(expected)
  const resource = await adapter.allocate(f.request)
  await assert.rejects(
    adapter.destroy({ resourceId: resource.id }),
    /deletion unverified/
  )
  assert.equal(await adapter.inspectAbsent({ resourceId: resource.id }), false)
})
test("template disables mounts, proxy/agent forwarding and automatic services", () => {
  const template = disposableTemplate(
    { imagePath: "/image", arch: "aarch64", vmType: "qemu" },
    { imageDigest: `sha256:${"a".repeat(64)}`, resources }
  )
  assert.deepEqual(template.mounts, [])
  assert.deepEqual(template.networks, [])
  assert.equal(template.ssh.forwardAgent, false)
  assert.equal(template.propagateProxyEnv, false)
  assert.ok(template.portForwards.every((entry) => entry.ignore))
})
test("process helper enforces deadline and closes inherited descriptors", async (t) => {
  await assert.rejects(
    runBounded(process.execPath, ["-e", "setInterval(() => {}, 1000)"], {
      env: { PATH: "/usr/bin:/bin" },
      timeoutMs: 50,
    }),
    /timed out/
  )
  const directory = mkdtempSync(join(tmpdir(), "descriptor-fixture-"))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const path = join(directory, "dummy-key-pipe-contents")
  writeFileSync(path, "non-secret fixture")
  const fd = openSync(path, "r")
  try {
    const inode = fstatSync(fd).ino
    const script = `const fs=require('fs');let inherited=false;try{inherited=fs.fstatSync(${fd}).ino===${inode}}catch{}process.stdout.write(inherited?'inherited':'closed')`
    const result = await runBounded(process.execPath, ["-e", script], {
      env: {},
      timeoutMs: 2000,
    })
    assert.equal(result.stdout.toString("utf8"), "closed")
  } finally {
    closeSync(fd)
  }
})

test("a pre-existing colliding VM name is never deleted as an owned allocation", async (t) => {
  const f = fixture(t)
  let collision
  const adapter = f.make()
  await adapter.reserveAttempt(expected)
  const { createHash } = await import("node:crypto")
  collision = `np-proof-${createHash("sha256").update(`${expected.attemptId}:fast`).digest("hex").slice(0, 24)}`
  f.machines.set(collision, { name: collision, status: "Stopped" })
  await assert.rejects(adapter.allocate(f.request), /Existing VM/)
  assert.equal(f.machines.has(collision), true)
  assert.equal(f.calls.filter((entry) => entry.args[0] === "delete").length, 0)
  assert.equal(await f.make().reserveAttempt(expected), false)
  assert.equal(f.machines.has(collision), true)
})

test("changed runtime policy is refused before a VM is created", async (t) => {
  const f = fixture(t),
    adapter = f.make()
  await adapter.reserveAttempt(expected)
  await assert.rejects(
    adapter.allocate({ ...f.request, runtimeSha: "f".repeat(40) }),
    /resource policy/
  )
  assert.equal(
    f.calls.some((entry) => entry.args[0] === "create"),
    false
  )
})

test("raw process streams preserve split UTF-8 and arbitrary invalid bytes", async () => {
  const result = await runBounded(
    process.execPath,
    [
      "-e",
      "process.stdout.write(Buffer.from([0xe2]));setTimeout(()=>{process.stdout.write(Buffer.from([0x82,0xac,0xff,0x00]));process.stderr.write(Buffer.from([0xfe,0x00]))},25)",
    ],
    { env: {}, timeoutMs: 2000 }
  )
  assert.deepEqual(result.stdout, Buffer.from([0xe2, 0x82, 0xac, 0xff, 0x00]))
  assert.deepEqual(result.stderr, Buffer.from([0xfe, 0x00]))
})

test("timeout and output-limit errors retain bounded partial raw evidence", async () => {
  await assert.rejects(
    runBounded(
      process.execPath,
      [
        "-e",
        "process.stdout.write(Buffer.from([0xff,0x00]));setInterval(()=>{},1000)",
      ],
      { env: {}, timeoutMs: 500 }
    ),
    (error) => {
      assert.deepEqual(error.stdout, Buffer.from([0xff, 0x00]))
      assert.equal(error.incomplete, true)
      assert.equal(error.truncated, false)
      return true
    }
  )
  await assert.rejects(
    runBounded(
      process.execPath,
      ["-e", "process.stdout.write('abcdef');setInterval(()=>{},1000)"],
      { env: {}, timeoutMs: 2000, maxBytes: 4 }
    ),
    (error) => {
      assert.deepEqual(error.stdout, Buffer.from("abcd"))
      assert.equal(error.incomplete, true)
      assert.equal(error.truncated, true)
      return true
    }
  )
})

test("execute returns raw bytes and retains audit channels using explicit lossless base64", async (t) => {
  const raw = Buffer.from([0xff, 0x00, 0xe2, 0x82, 0xac])
  const f = fixture(t, {
    run: async (args) =>
      args.includes("/usr/bin/timeout")
        ? {
            exitCode: 0,
            signal: null,
            stdout: raw,
            stderr: Buffer.from([0xfe]),
          }
        : null,
  })
  const adapter = f.make()
  await adapter.reserveAttempt(expected)
  const allocation = await adapter.allocate(f.request)
  const result = await adapter.execute({
    resourceId: allocation.id,
    argv: ["fixture"],
    timeoutMs: 1000,
  })
  assert.deepEqual(result.stdout, raw)
  const audit = JSON.parse(
    readFileSync(
      join(f.config.stateRoot, `${allocation.id}.result.json`),
      "utf8"
    )
  )
  assert.equal(audit.stdout.encoding, "base64")
  assert.deepEqual(Buffer.from(audit.stdout.data, "base64"), raw)
  assert.equal(audit.incomplete, false)
  await adapter.destroy({ resourceId: allocation.id })
})

test("VM created by another actor between absence readback and create remains untouched", async (t) => {
  let foreignName
  const f = fixture(t, {
    run: async (args, machines) => {
      if (args[0] === "create") {
        foreignName = args[2]
        machines.set(foreignName, {
          name: foreignName,
          config: { param: { npOwnerNonce: "foreign-owner" } },
          status: "Stopped",
        })
        return {
          exitCode: 1,
          signal: null,
          stdout: "",
          stderr: "instance exists",
        }
      }
    },
  })
  const adapter = f.make()
  await adapter.reserveAttempt(expected)
  await assert.rejects(adapter.allocate(f.request), /ownership is ambiguous/)
  assert.equal(f.machines.has(foreignName), true)
  assert.equal(f.calls.filter((entry) => entry.args[0] === "delete").length, 0)
  await assert.rejects(
    f.make().reserveAttempt(expected),
    /ownership is ambiguous/
  )
  assert.equal(f.machines.has(foreignName), true)
  const journal = JSON.parse(
    readFileSync(join(f.config.stateRoot, "resources.json"), "utf8")
  )
  assert.equal(journal.resources[0].status, "intent")
})
