import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import {
  chmodSync,
  closeSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { after, before, test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { partitionLogs } from "../../ops/local-ci/core/retention.mjs"
import { createLoop } from "../../ops/local-ci/agent/loop.mjs"
import {
  DEFAULT_MAIN_REF,
  NIGHTLY_CADENCE_HOURS,
  PERMITTED_HOST_EXECUTABLES,
  VM_PROBE_MARKER,
  VM_PROBE_SCRIPT,
  assertVmIsolation,
  createNightlyScheduler,
  createRunEvidenceStore,
  createSerialGate,
  execHost,
  dispatchRun,
  jobImageFilePath,
  nightlyCadence,
  nightlyRunIsDue,
  nightlyTick,
  parseArgs,
  parseLimaInstances,
  parseRunDirectoryName,
  parseVmProbe,
  permittedExecutable,
  readCredentialFile,
  readStateFile,
  requireJobImage,
  resolveHostConfig,
  runDirectoryName,
} from "../../ops/local-ci/agent/main.mjs"

/**
 * local CI — the host-facing edges of the CLI entry point.
 *
 * `main.mjs` is the only file in the package that opens a credential, spawns a
 * process, resolves the host's configuration or decides that a commit may be
 * dispatched into the VM. These are the assertions that cannot be made
 * anywhere else:
 *
 *   - a credential file is checked and read through **one** descriptor, and a
 *     mode readable beyond the owner is a refusal rather than a warning;
 *   - `argv[0]` is confined to the two executables this plane documents, so an
 *     argv assembled from command-line data cannot choose the binary that runs
 *     on the Mac holding the GitHub App private key;
 *   - the pinned job image, the launchd plist and the installer name one path,
 *     so the supported installation starts a poller instead of a crash loop;
 *   - the VM's isolation is re-derived from the live instance before every
 *     dispatch, not trusted from the day it was installed;
 *   - one run's evidence is never overwritten by another run of the same
 *     commit, and evidence that has aged out is actually deleted.
 *
 * Everything below runs offline against a real temp directory; nothing here
 * spawns a process that outlives the test, and nothing needs the VM - which is
 * the point, because the VM does not exist yet.
 */

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, "..", "..")
const AGENT_SOURCE = join(REPO_ROOT, "ops/local-ci/agent/main.mjs")
const INSTALLER = join(REPO_ROOT, "ops/local-ci/host/install.sh")
const HOST_PLIST = join(
  REPO_ROOT,
  "ops/local-ci/host/com.nabaperks.local-ci.plist"
)
const HOST_README = join(REPO_ROOT, "ops/local-ci/host/README.md")
const RUNBOOK = join(REPO_ROOT, "docs/operations/local-ci.md")

/** One clean guest report, as the probe script actually prints it. */
const VM_PROBE_SCRIPT_SAMPLE = [
  "ssh_auth_sock=[]",
  "findmnt=present",
  "host_mounts_status=ok",
  "host_mounts=",
  "host_home=absent",
  "rosetta=absent",
  "probe=ok",
  "",
].join("\n")

let root

before(() => {
  root = mkdtempSync(join(tmpdir(), "nabaperks-local-ci-cli-"))
})

after(() => {
  rmSync(root, { recursive: true, force: true })
})

const describe = (value) =>
  typeof value === "object" && value !== null ? "an object" : String(value)

const writeCredential = (name, mode, body = "PEM\n") => {
  const path = join(root, name)
  writeFileSync(path, body)
  chmodSync(path, mode)
  return path
}

/* ------------------------------------------------------ readCredentialFile */

test("readCredentialFile returns null when the file is absent", () => {
  assert.equal(
    readCredentialFile(join(root, "not-installed.pem"), "the key"),
    null
  )
})

test("readCredentialFile reads an owner-only file", () => {
  const path = writeCredential("owner-only.pem", 0o600, "-----BEGIN-----\n")
  assert.equal(
    readCredentialFile(path, "the GitHub App private key"),
    "-----BEGIN-----\n"
  )
})

test("readCredentialFile accepts a stricter mode than 0600", () => {
  const path = writeCredential("locked.pem", 0o400, "strict\n")
  assert.equal(readCredentialFile(path, "the key"), "strict\n")
})

test("readCredentialFile refuses a group- or world-readable file", () => {
  for (const [name, mode, octal] of [
    ["group-readable.pem", 0o640, "0640"],
    ["world-readable.pem", 0o644, "0644"],
    ["world-writable.pem", 0o666, "0666"],
  ]) {
    const path = writeCredential(name, mode)
    assert.throws(
      () => readCredentialFile(path, "the GitHub App private key"),
      (error) => {
        assert.equal(error.code, "CREDENTIAL_PERMISSIONS")
        assert.match(error.message, /the GitHub App private key/)
        assert.match(error.message, new RegExp(`is mode ${octal}`))
        assert.match(error.message, /chmod 600/)
        return true
      },
      `mode ${octal} must be refused`
    )
  }
})

test("readCredentialFile checks and reads the same descriptor", () => {
  // The mode that is approved must be the mode of the bytes returned. Reading
  // through one descriptor is what makes that true; a stat-then-open pair lets
  // the name be repointed between the two syscalls.
  const target = writeCredential("swap-target.pem", 0o600, "the real key\n")
  const link = join(root, "swap-link.pem")
  symlinkSync(target, link)
  assert.equal(readCredentialFile(link, "the key"), "the real key\n")

  // A symlink is followed, but it is the *target's* mode that decides, so a
  // world-readable target is refused through the link exactly as it is direct.
  chmodSync(target, 0o644)
  assert.throws(() => readCredentialFile(link, "the key"), {
    code: "CREDENTIAL_PERMISSIONS",
  })
  chmodSync(target, 0o600)
})

test("readCredentialFile leaks no descriptor on the refusal path", () => {
  // Descriptors are handed out lowest-free-first, so a fresh open lands on the
  // same number every time only while nothing before it leaked. Without the
  // `finally`, 200 refusals move this by 200.
  const path = writeCredential("leaky.pem", 0o644)
  const probe = () => {
    const fd = openSync(path, "r")
    closeSync(fd)
    return fd
  }
  const baseline = probe()
  for (let attempt = 0; attempt < 200; attempt += 1) {
    assert.throws(() => readCredentialFile(path, "the key"), {
      code: "CREDENTIAL_PERMISSIONS",
    })
  }
  assert.equal(probe(), baseline)
})

/* ------------------------------------------------------------- the argv gate */

test("the host executable allowlist is exactly the two documented tools", () => {
  assert.deepEqual(PERMITTED_HOST_EXECUTABLES, ["/bin/sh", "limactl"])
  assert.ok(Object.isFrozen(PERMITTED_HOST_EXECUTABLES))
})

test("permittedExecutable returns the allowlist's own string", () => {
  const supplied = ["/bin/sh", "-c", "true"]
  const executable = permittedExecutable(supplied)
  assert.equal(executable, "/bin/sh")
  // Identity, not equality: what reaches `spawn` is the constant, never the
  // caller's word, so no tainted string can be the thing that gets executed.
  assert.equal(executable, PERMITTED_HOST_EXECUTABLES[0])
  assert.equal(permittedExecutable(["limactl", "shell", "vm"]), "limactl")
})

test("permittedExecutable refuses an executable outside the allowlist", () => {
  for (const executable of [
    "/usr/bin/curl",
    "curl",
    "git",
    "docker",
    "/tmp/evil/limactl",
    "./limactl",
    "limactl\n",
    "",
  ]) {
    assert.throws(
      () => permittedExecutable([executable, "--version"]),
      (error) => {
        assert.equal(error.code, "EXECUTABLE_NOT_PERMITTED")
        assert.match(error.message, /permitted executables are/)
        return true
      },
      `${JSON.stringify(executable)} must be refused`
    )
  }
})

test("permittedExecutable refuses an argv that is not a non-empty string list", () => {
  for (const argv of [undefined, null, [], "/bin/sh", { 0: "/bin/sh" }]) {
    assert.throws(() => permittedExecutable(argv), {
      code: "INVALID_COMMAND",
    })
  }
  for (const word of [null, undefined, 7, ["-c"], { toString: () => "-c" }]) {
    assert.throws(
      () => permittedExecutable(["/bin/sh", "-c", word]),
      (error) => {
        assert.equal(error.code, "INVALID_COMMAND")
        assert.match(error.message, /word 2 must be a string/)
        return true
      },
      `${describe(word)} must not reach spawn`
    )
  }
})

/* --------------------------------------------------------------- execHost */

test("execHost rejects rather than throwing when the argv is refused", async () => {
  // `releaseWorkspace` swallows this call with `.catch()` inside a `finally`;
  // a synchronous throw would escape that and mask the run's real outcome.
  const promise = execHost(["/usr/bin/env", "true"])
  assert.ok(promise instanceof Promise)
  await assert.rejects(promise, { code: "EXECUTABLE_NOT_PERMITTED" })
  await assert.rejects(execHost([]), { code: "INVALID_COMMAND" })
})

test("execHost runs a permitted executable and returns its stdout", async () => {
  assert.equal(await execHost(["/bin/sh", "-c", "printf ok"]), "ok")
})

test("execHost feeds stdin to a permitted executable", async () => {
  assert.equal(
    await execHost(["/bin/sh", "-c", "cat"], { input: "fed\n" }),
    "fed\n"
  )
})

test("execHost reports a non-zero exit as COMMAND_FAILED", async () => {
  await assert.rejects(
    execHost(["/bin/sh", "-c", "echo boom >&2; exit 3"]),
    (error) => {
      assert.equal(error.code, "COMMAND_FAILED")
      assert.match(error.message, /exited 3: boom/)
      return true
    }
  )
})

/* ------------------------------------------------------------- the modes */

test("parseArgs understands the three dispatch modes", () => {
  assert.equal(parseArgs(["--watch"]).watch, true)

  const nightly = parseArgs(["--nightly"])
  assert.equal(nightly.nightly, true)
  assert.equal(nightly.profile, "nightly")
  assert.equal(nightly.ref, DEFAULT_MAIN_REF)
  assert.equal(nightly.sha, null)

  const oneShot = parseArgs(["--profile", "pr", "--sha", "a".repeat(40)])
  assert.equal(oneShot.profile, "pr")
  assert.equal(oneShot.sha, "a".repeat(40))
})

test("parseArgs refuses two modes at once", () => {
  for (const argv of [
    ["--watch", "--nightly"],
    ["--nightly", "--profile", "pr"],
    ["--watch", "--profile", "main"],
  ]) {
    assert.throws(
      () => parseArgs(argv),
      (error) => {
        assert.equal(error.code, "INVALID_ARGUMENTS")
        assert.match(error.message, /different modes/)
        return true
      },
      `${argv.join(" ")} must be refused`
    )
  }
})

test("parseArgs refuses --nightly with a pinned SHA", () => {
  // A schedule has no operator to name a commit, and a SHA baked into one
  // would keep proving a commit the branch has long since moved off.
  assert.throws(() => parseArgs(["--nightly", "--sha", "b".repeat(40)]), {
    code: "INVALID_ARGUMENTS",
  })
})

/* ------------------------------------------------------- the pinned image */

test("requireJobImage accepts a pinned reference and refuses the rest", () => {
  assert.equal(
    requireJobImage("  nabaperks-ci-job:abc123  ", "the tag"),
    "nabaperks-ci-job:abc123"
  )
  assert.equal(
    requireJobImage("nabaperks-ci-job@sha256:" + "f".repeat(64), "the tag"),
    "nabaperks-ci-job@sha256:" + "f".repeat(64)
  )

  for (const [value, code] of [
    ["", "MISSING_JOB_IMAGE"],
    ["   \n", "MISSING_JOB_IMAGE"],
    [null, "MISSING_JOB_IMAGE"],
    // Unpinned: "latest" is whatever the registry says today.
    ["nabaperks-ci-job", "INVALID_JOB_IMAGE"],
    // An argv word, not an image: this is what the pattern exists to stop.
    ["--privileged", "INVALID_JOB_IMAGE"],
    ["nabaperks-ci-job:abc; rm -rf /", "INVALID_JOB_IMAGE"],
    ["nabaperks-ci-job:abc def", "INVALID_JOB_IMAGE"],
    ["$(id):1", "INVALID_JOB_IMAGE"],
  ]) {
    assert.throws(
      () => requireJobImage(value, "the tag"),
      (error) => {
        assert.equal(error.code, code, `${JSON.stringify(value)}`)
        return true
      },
      `${JSON.stringify(value)} must be refused`
    )
  }
})

test("jobImageFilePath is derived from the contract's install root", () => {
  assert.equal(
    jobImageFilePath(
      {},
      { agent: { installRoot: "/opt/nabaperks-local-ci/current" } }
    ),
    "/opt/nabaperks-local-ci/job-image"
  )
  assert.equal(
    jobImageFilePath(
      { LOCAL_CI_JOB_IMAGE_FILE: "/elsewhere/tag" },
      { agent: { installRoot: "/opt/nabaperks-local-ci/current" } }
    ),
    "/elsewhere/tag"
  )
  assert.equal(jobImageFilePath({}, {}), null)
})

test("readStateFile distinguishes absent from unreadable", () => {
  assert.equal(readStateFile(join(root, "no-such-state"), "the tag"), null)
  const path = join(root, "state-file")
  writeFileSync(path, "nabaperks-ci-job:abc\n")
  assert.equal(readStateFile(path, "the tag"), "nabaperks-ci-job:abc\n")
  assert.throws(() => readStateFile(root, "the tag"), {
    code: "STATE_FILE_UNREADABLE",
  })
})

const hostContract = Object.freeze({
  agent: {
    stateRoot: "~/.nabaperks-local-ci",
    installRoot: "/opt/nabaperks-local-ci/current",
  },
  githubApp: { appId: 11, installationId: 22 },
  vm: { name: "nabaperks-ci" },
})

test("resolveHostConfig reads the job image install.sh pinned", () => {
  // The regression this pins: the launchd plist carries no LOCAL_CI_JOB_IMAGE,
  // so a config that only ever looked at the environment turned the supported
  // installation into a MISSING_JOB_IMAGE crash loop under KeepAlive.
  const stateRoot = mkdtempSync(join(tmpdir(), "nabaperks-state-"))
  const pinPath = join(stateRoot, "job-image")
  const env = {
    NABAPERKS_LOCAL_CI_HOME: stateRoot,
    LOCAL_CI_GITHUB_APP_PRIVATE_KEY: "PEM",
    LOCAL_CI_JOB_IMAGE_FILE: pinPath,
  }
  try {
    assert.throws(
      () => resolveHostConfig({ env, contract: hostContract, home: root }),
      (error) => {
        assert.equal(error.code, "MISSING_JOB_IMAGE")
        assert.match(
          error.message,
          new RegExp(pinPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
        )
        return true
      }
    )

    writeFileSync(pinPath, "nabaperks-ci-job:abc123\n")
    const fromFile = resolveHostConfig({
      env,
      contract: hostContract,
      home: root,
    })
    assert.equal(fromFile.jobImage, "nabaperks-ci-job:abc123")
    assert.equal(fromFile.jobImageSource, pinPath)

    // The environment still wins, so a hand-run one-shot needs no file.
    const fromEnv = resolveHostConfig({
      env: { ...env, LOCAL_CI_JOB_IMAGE: "nabaperks-ci-job:def456" },
      contract: hostContract,
      home: root,
    })
    assert.equal(fromEnv.jobImage, "nabaperks-ci-job:def456")
    assert.equal(fromEnv.jobImageSource, "LOCAL_CI_JOB_IMAGE")

    writeFileSync(pinPath, "nabaperks-ci-job\n")
    assert.throws(
      () => resolveHostConfig({ env, contract: hostContract, home: root }),
      { code: "INVALID_JOB_IMAGE" }
    )
  } finally {
    rmSync(stateRoot, { recursive: true, force: true })
  }
})

test("the plist, install.sh and the agent name one job-image path", () => {
  // Three files describing one interface. A rename on any side would leave the
  // installed service with no pinned image and nothing pointing that out until
  // launchd had restarted it a few hundred times.
  const plist = readFileSync(HOST_PLIST, "utf8")
  const installer = readFileSync(INSTALLER, "utf8")

  const installRoot = /^INSTALL_ROOT="([^"]+)"$/m.exec(installer)
  assert.ok(installRoot, "install.sh must declare INSTALL_ROOT")
  const declared = /^JOB_IMAGE_FILE="([^"]+)"$/m.exec(installer)
  assert.ok(declared, "install.sh must declare JOB_IMAGE_FILE")
  const jobImageFile = declared[1].replace("${INSTALL_ROOT}", installRoot[1])

  assert.equal(
    jobImageFile,
    jobImageFilePath(
      {},
      { agent: { installRoot: `${installRoot[1]}/current` } }
    )
  )
  assert.match(plist, /<key>LOCAL_CI_JOB_IMAGE_FILE<\/key>/)
  assert.ok(
    plist.includes(`<string>${jobImageFile}</string>`),
    `the plist must point LOCAL_CI_JOB_IMAGE_FILE at ${jobImageFile}`
  )
  // And the installer must refuse to register a plist that does not.
  assert.match(installer, /grep -q "LOCAL_CI_JOB_IMAGE_FILE"/)
})

/* --------------------------------------------------- every documented flag */

/** Every `--flag` the docs pass to install.sh, continuation lines included. */
function documentedInstallerFlags(text) {
  const found = new Set()
  const lines = text.split("\n")
  for (let index = 0; index < lines.length; index += 1) {
    // `(?<![\w-])` so `uninstall.sh --purge` is not read as an install flag.
    if (!/(?<![\w-])install\.sh\b/.test(lines[index])) continue
    let cursor = index
    let block = lines[cursor]
    while (/\\\s*$/.test(lines[cursor]) && cursor + 1 < lines.length) {
      cursor += 1
      block += `\n${lines[cursor]}`
    }
    for (const match of block.matchAll(/(?:^|\s)(--[a-z][a-z-]*)/g)) {
      found.add(match[1])
    }
  }
  return found
}

test("every install.sh flag the runbooks use exists in install.sh", () => {
  // The runbook used to be the only supported procedure and to invoke a flag
  // the script had never had, so following it exactly failed with "unknown
  // argument" at the first command.
  const installer = readFileSync(INSTALLER, "utf8")
  for (const doc of [RUNBOOK, HOST_README]) {
    for (const flag of documentedInstallerFlags(readFileSync(doc, "utf8"))) {
      assert.ok(
        installer.includes(`\n    ${flag})`) ||
          installer.includes(`${flag} | `) ||
          installer.includes(` | ${flag})`),
        `${doc} passes ${flag} to install.sh, which has no such argument`
      )
    }
  }
})

/* --------------------------------------------------- the VM re-assertion */

const runningInstance = (overrides = {}) => ({
  name: "nabaperks-ci",
  status: "Running",
  ...overrides,
})

const cleanProbe = (overrides = {}) => ({
  ssh_auth_sock: "[]",
  findmnt: "present",
  host_mounts_status: "ok",
  host_mounts: "",
  host_home: "absent",
  rosetta: "absent",
  probe: "ok",
  ...overrides,
})

const vmContract = Object.freeze({
  vm: { name: "nabaperks-ci", definition: "ops/local-ci/host/lima.yaml" },
})

const assertVm = (instances, probe) =>
  assertVmIsolation({
    vm: "nabaperks-ci",
    instances,
    probe,
    contract: vmContract,
  })

test("parseLimaInstances accepts both shapes limactl has emitted", () => {
  assert.deepEqual(parseLimaInstances(""), [])
  assert.deepEqual(parseLimaInstances('{"name":"a"}'), [{ name: "a" }])
  assert.deepEqual(parseLimaInstances('[{"name":"a"},{"name":"b"}]'), [
    { name: "a" },
    { name: "b" },
  ])
  assert.deepEqual(parseLimaInstances('{"name":"a"}\n{"name":"b"}\n'), [
    { name: "a" },
    { name: "b" },
  ])
  // Unparseable is a refusal, never an empty list: "I could not read the
  // answer" must not resolve to "there is nothing to worry about".
  assert.throws(() => parseLimaInstances("limactl: command not found"), {
    code: "VM_UNVERIFIABLE",
  })
})

test("parseVmProbe reads the guest report back", () => {
  assert.deepEqual(
    { ...parseVmProbe(VM_PROBE_SCRIPT_SAMPLE) },
    {
      ssh_auth_sock: "[]",
      findmnt: "present",
      host_mounts_status: "ok",
      host_mounts: "",
      host_home: "absent",
      rosetta: "absent",
      probe: "ok",
    }
  )
})

test("assertVmIsolation passes a VM that still matches the design", () => {
  const verdict = assertVm([runningInstance()], cleanProbe())
  assert.deepEqual({ ...verdict }, { vm: "nabaperks-ci", status: "Running" })
})

test("assertVmIsolation refuses when there is no VM to assert", () => {
  for (const vm of [null, "", "   ", undefined]) {
    assert.throws(
      () =>
        assertVmIsolation({
          vm,
          instances: [],
          probe: cleanProbe(),
          contract: vmContract,
        }),
      (error) => {
        assert.equal(error.code, "VM_NOT_CONFIGURED")
        assert.match(error.message, /directly on the Mac/)
        return true
      },
      `${JSON.stringify(vm)} must be refused`
    )
  }
})

test("assertVmIsolation refuses a missing or stopped instance", () => {
  assert.throws(() => assertVm([], cleanProbe()), { code: "VM_NOT_FOUND" })
  assert.throws(
    () => assertVm([runningInstance({ status: "Stopped" })], cleanProbe()),
    { code: "VM_NOT_RUNNING" }
  )
})

test("assertVmIsolation refuses a declared isolation change", () => {
  for (const [label, instance] of [
    ["a host mount", runningInstance({ mounts: [{ location: "~" }] })],
    ["a shared network", runningInstance({ networks: [{ lima: "shared" }] })],
    [
      "a forwarded agent",
      runningInstance({ config: { ssh: { forwardAgent: true } } }),
    ],
    [
      "the operator's keys",
      runningInstance({ config: { ssh: { loadDotSSHPubKeys: true } } }),
    ],
    ["Rosetta", runningInstance({ config: { rosetta: { enabled: true } } })],
  ]) {
    assert.throws(
      () => assertVm([instance], cleanProbe()),
      (error) => {
        assert.equal(error.code, "VM_ISOLATION_VIOLATION")
        assert.match(error.message, /no pull-request code will be dispatched/)
        return true
      },
      `${label} must be refused`
    )
  }
})

test("assertVmIsolation refuses what only the live guest can show", () => {
  // The point of the guest probe: a directory mounted into a running VM by
  // hand appears in no configuration file at all.
  for (const [label, probe] of [
    ["a live host mount", cleanProbe({ host_mounts: "/mnt/host" })],
    // An unanswerable mount question must refuse, not pass: otherwise the
    // strongest isolation check is disabled by deleting one binary.
    ["no usable findmnt", cleanProbe({ findmnt: "absent" })],
    ["a findmnt that failed", cleanProbe({ host_mounts_status: "failed" })],
    ["a forwarded agent socket", cleanProbe({ ssh_auth_sock: "[/tmp/ssh]" })],
    ["the Mac's home directory", cleanProbe({ host_home: "/Users" })],
    ["Rosetta mounted", cleanProbe({ rosetta: "/mnt/lima-rosetta" })],
  ]) {
    assert.throws(
      () => assertVm([runningInstance()], probe),
      { code: "VM_ISOLATION_VIOLATION" },
      `${label} must be refused`
    )
  }
})

test("assertVmIsolation refuses a probe that did not finish", () => {
  // A probe killed halfway reports every property as absent, which reads
  // exactly like every property being satisfied.
  for (const probe of [
    null,
    {},
    cleanProbe({ probe: undefined }),
    cleanProbe({ probe: "" }),
  ]) {
    assert.throws(() => assertVm([runningInstance()], probe), {
      code: "VM_UNVERIFIABLE",
    })
  }
})

test("the guest probe asks about every property the template pins", () => {
  // The script is text handed to `sh -c`; these are the questions it must ask.
  assert.match(VM_PROBE_SCRIPT, /SSH_AUTH_SOCK/)
  assert.match(VM_PROBE_SCRIPT, /findmnt -rn -t virtiofs,9p/)
  assert.match(VM_PROBE_SCRIPT, /\/Users/)
  assert.match(VM_PROBE_SCRIPT, /lima-rosetta/)
  assert.ok(
    VM_PROBE_SCRIPT.trimEnd().endsWith(`printf "${VM_PROBE_MARKER}\\n"`)
  )
})

test("every dispatch path re-asserts the VM before it runs anything", () => {
  // The assertion cannot be proven against a VM that does not exist yet, so
  // what is pinned here is that no dispatch bypasses it: `dispatchRun` is the
  // single door, and its first statement is the check.
  const source = readFileSync(AGENT_SOURCE, "utf8")
  const dispatch = source.slice(source.indexOf("async function dispatchRun("))
  assert.match(
    dispatch.slice(0, dispatch.indexOf("evidence.open(")),
    /await dependencies\.assertVmIsolationLive\(/,
    "dispatchRun must assert the VM before opening a run"
  )
  // And nothing else materialises a worktree inside the VM.
  assert.equal(
    source.split("await dependencies.buildDependencies(").length - 1,
    1,
    "buildDependencies must have exactly one call site, inside dispatchRun"
  )
})

/* ------------------------------------------------------- run evidence keys */

test("a run directory name carries the profile, the instant and entropy", () => {
  const name = runDirectoryName({
    profile: "main",
    at: Date.parse("2026-09-05T03:15:00.123Z"),
    entropy: "a1b2c3",
  })
  assert.equal(name, "main-20260905T031500Z-a1b2c3")
  assert.deepEqual(
    { ...parseRunDirectoryName(name) },
    {
      profile: "main",
      at: Date.parse("2026-09-05T03:15:00Z"),
    }
  )
  assert.equal(parseRunDirectoryName("deadbeef"), null)
  assert.equal(parseRunDirectoryName(""), null)
})

test("two runs of one commit keep separate evidence", () => {
  // The collision this exists to stop: a pull-request commit is fast-forwarded
  // onto main and tested again, and the second run truncates the first one's
  // lane logs and rewrites its lane-result.json - destroying exactly the
  // shadow-qualification record the cutover is built from.
  const stateRoot = mkdtempSync(join(tmpdir(), "nabaperks-evidence-"))
  try {
    let clock = Date.parse("2026-09-05T03:15:00Z")
    let counter = 0
    const store = createRunEvidenceStore({
      stateRoot,
      now: () => clock,
      entropy: () => String(counter++).padStart(6, "0"),
    })
    const sha = "c".repeat(40)

    const pr = store.open({ headSha: sha, profile: "pr" })
    writeFileSync(join(pr.path, "lane-result.json"), '{"profile":"pr"}')
    pr.close()

    clock += 3_600_000
    const main = store.open({ headSha: sha, profile: "main" })
    writeFileSync(join(main.path, "lane-result.json"), '{"profile":"main"}')

    assert.notEqual(pr.path, main.path)
    assert.equal(
      readFileSync(join(pr.path, "lane-result.json"), "utf8"),
      '{"profile":"pr"}',
      "the earlier run's evidence must survive the later one"
    )

    // Two runs of the same profile at the same instant still get their own.
    clock = Date.parse("2026-09-05T03:15:00Z")
    const again = store.open({ headSha: sha, profile: "pr" })
    assert.notEqual(again.path, pr.path)

    const entries = store.list()
    assert.equal(entries.length, 3)
    assert.deepEqual(entries.map((entry) => entry.profile).sort(), [
      "main",
      "pr",
      "pr",
    ])
    // An open run is protected from the retention sweep whatever its age.
    const open = entries.filter((entry) => entry.running).map((e) => e.path)
    assert.deepEqual(open.sort(), [again.path, main.path].sort())
    main.close()
    again.close()
    assert.deepEqual(
      store.list().filter((entry) => entry.running),
      []
    )
  } finally {
    rmSync(stateRoot, { recursive: true, force: true })
  }
})

test("the evidence store reports and removes what has aged out", () => {
  const stateRoot = mkdtempSync(join(tmpdir(), "nabaperks-evidence-"))
  try {
    let clock = Date.parse("2026-01-01T00:00:00Z")
    let counter = 0
    const store = createRunEvidenceStore({
      stateRoot,
      now: () => clock,
      entropy: () => String(counter++).padStart(6, "0"),
    })
    const sha = "d".repeat(40)
    const old = store.open({ headSha: sha, profile: "nightly" })
    old.close()
    clock += 40 * 24 * 3_600_000
    const fresh = store.open({ headSha: sha, profile: "nightly" })
    fresh.close()

    assert.equal(store.lastRunAt("nightly"), clock)
    assert.equal(store.lastRunAt("pr"), null)

    const partition = partitionLogs(store.list(), clock, {
      agent: { logRetentionDays: 30 },
    })
    assert.deepEqual(
      partition.expired.map((entry) => entry.path),
      [old.path]
    )
    store.remove(partition.expired[0])
    assert.deepEqual(
      store.list().map((entry) => entry.path),
      [fresh.path],
      "the surviving run keeps its own directory"
    )

    // The sweep may only ever delete inside its own root.
    assert.throws(() => store.remove({ path: stateRoot }), {
      code: "EVIDENCE_DIRECTORY",
    })
    assert.throws(() => store.remove({ path: "/" }), {
      code: "EVIDENCE_DIRECTORY",
    })
  } finally {
    rmSync(stateRoot, { recursive: true, force: true })
  }
})

test("the watch loop is handed a store, so retention actually runs", async () => {
  // Without a logStore the loop's sweep returns 0 on every tick and
  // agent.logRetentionDays is a number no code reads.
  const contract = loadContract((path) =>
    readFileSync(join(REPO_ROOT, path), "utf8")
  )
  const stateRoot = mkdtempSync(join(tmpdir(), "nabaperks-retention-"))
  try {
    let clock = Date.parse("2026-01-01T00:00:00Z")
    let counter = 0
    const store = createRunEvidenceStore({
      stateRoot,
      now: () => clock,
      entropy: () => String(counter++).padStart(6, "0"),
    })
    const aged = store.open({ headSha: "e".repeat(40), profile: "main" })
    aged.close()
    clock += (contract.agent.logRetentionDays + 1) * 24 * 3_600_000

    const loop = createLoop({
      contract,
      github: {
        getRef: async () => null,
        listOpenPullRequests: async () => [],
      },
      runner: { runProfile: async () => assert.fail("nothing to run") },
      loadProfile: () => assert.fail("nothing to load"),
      logStore: store,
      now: () => clock,
    })

    const result = await loop.tick()
    assert.equal(result.swept, 1)
    assert.deepEqual(store.list(), [])
  } finally {
    rmSync(stateRoot, { recursive: true, force: true })
  }
})

/* ------------------------------------------------------------- the nightly */

const nightlyContract = Object.freeze({
  nightlyProof: { maxAgeHours: 36, profile: "nightly" },
  nightlyCheckName: "Nabaperks Local CI (nightly)",
})

test("the nightly cadence has to fit inside the freshness window", () => {
  const cadence = nightlyCadence(nightlyContract)
  assert.equal(cadence.cadenceHours, NIGHTLY_CADENCE_HOURS)
  assert.equal(cadence.maxAgeHours, 36)
  assert.equal(cadence.recoveryHours, 12)

  // The contract this plane actually ships must satisfy it.
  const shipped = loadContract((path) =>
    readFileSync(join(REPO_ROOT, path), "utf8")
  )
  assert.ok(nightlyCadence(shipped).recoveryHours > 0)

  // A window no wider than the cadence leaves no recovery at all, so a single
  // missed run would fail the monitor. That is a contract bug, not a schedule.
  for (const maxAgeHours of [24, 12, 0, -1, null, "36"]) {
    assert.throws(
      () => nightlyCadence({ nightlyProof: { maxAgeHours } }),
      { code: "INVALID_CONTRACT" },
      `maxAgeHours ${JSON.stringify(maxAgeHours)} must be refused`
    )
  }
})

test("a nightly is due once per cadence, and after any missed window", () => {
  const now = Date.parse("2026-09-05T03:15:00Z")
  const hours = (count) => now - count * 3_600_000

  assert.equal(
    nightlyRunIsDue({ lastRunAt: null, now, contract: nightlyContract }).due,
    true
  )
  assert.equal(
    nightlyRunIsDue({ lastRunAt: hours(1), now, contract: nightlyContract })
      .due,
    false
  )
  assert.equal(
    nightlyRunIsDue({ lastRunAt: hours(23.9), now, contract: nightlyContract })
      .due,
    false
  )
  assert.equal(
    nightlyRunIsDue({ lastRunAt: hours(24), now, contract: nightlyContract })
      .due,
    true
  )
  // The laptop was shut for three days. The window was missed, not skipped:
  // the run happens as soon as anyone asks again.
  const late = nightlyRunIsDue({
    lastRunAt: hours(72),
    now,
    contract: nightlyContract,
  })
  assert.equal(late.due, true)
  assert.match(late.reason, /72\.0h ago/)
  assert.match(late.reason, /fails at 36h/)
})

function fakeLogger() {
  const lines = []
  const record = (level) => (message) => lines.push(`${level} ${message}`)
  return {
    lines,
    info: record("info"),
    warn: record("warn"),
    error: record("error"),
  }
}

test("nightlyTick runs nothing while the last proof is inside the cadence", async () => {
  const dispatched = []
  const result = await nightlyTick({
    contract: nightlyContract,
    logger: fakeLogger(),
    github: { getRef: async () => assert.fail("must not reach GitHub") },
    evidence: { lastRunAt: () => Date.now() - 3_600_000 },
    loadProfileFor: () => assert.fail("must not load a profile"),
    dispatch: async (args) => dispatched.push(args),
  })
  assert.equal(result.ran, false)
  assert.equal(result.due, false)
  assert.deepEqual(dispatched, [])
})

test("nightlyTick proves the default branch head when one is due", async () => {
  const logger = fakeLogger()
  const dispatched = []
  const published = []
  const headSha = "f".repeat(40)
  const result = await nightlyTick({
    contract: nightlyContract,
    logger,
    github: {
      getRef: async (ref) => {
        assert.equal(ref, DEFAULT_MAIN_REF)
        return { ref, sha: headSha.toUpperCase() }
      },
    },
    evidence: { lastRunAt: () => null },
    loadProfileFor: (name) => {
      assert.equal(name, "nightly")
      return { profile: "nightly" }
    },
    dispatch: async (args) => {
      dispatched.push(args)
      return { record: { conclusion: "success" } }
    },
    publish: async (args) => published.push(args),
  })

  assert.equal(result.ran, true)
  assert.equal(result.headSha, headSha)
  assert.equal(result.conclusion, "success")
  assert.equal(dispatched.length, 1)
  assert.deepEqual(dispatched[0].profile, { profile: "nightly" })
  assert.equal(dispatched[0].ref, DEFAULT_MAIN_REF)
  // Lower-cased on the way in: GitHub answers in whatever case it likes, and
  // the check run, the evidence directory and the bridge must agree.
  assert.equal(dispatched[0].headSha, headSha)
  assert.equal(published.length, 1)
  assert.equal(published[0].headSha, headSha)
})

test("nightlyTick keeps the run when the proof cannot be published", async () => {
  const logger = fakeLogger()
  const result = await nightlyTick({
    contract: nightlyContract,
    logger,
    github: {
      getRef: async () => ({ ref: DEFAULT_MAIN_REF, sha: "1".repeat(40) }),
    },
    evidence: { lastRunAt: () => null },
    loadProfileFor: () => ({ profile: "nightly" }),
    dispatch: async () => ({ record: { conclusion: "failure" } }),
    publish: async () => {
      throw new Error("GitHub is down")
    },
  })
  assert.equal(result.ran, true)
  assert.equal(result.conclusion, "failure")
  assert.ok(
    logger.lines.some((line) =>
      /could not be published: GitHub is down/.test(line)
    ),
    "a publish failure must be loud, not silent"
  )
})

test("the nightly scheduler keeps asking until it is stopped", async () => {
  const logger = fakeLogger()
  let ticks = 0
  const scheduler = createNightlyScheduler({
    logger,
    intervalMs: 1,
    sleep: async () => {},
    tick: async () => {
      ticks += 1
      if (ticks === 2) throw new Error("transient")
      if (ticks >= 4) scheduler.stop()
      return { ran: ticks === 3, headSha: "abc", conclusion: "success" }
    },
  })
  await scheduler.start()
  assert.equal(ticks, 4)
  // A failing check must not take the schedule down with it.
  assert.ok(
    logger.lines.some((line) => /nightly check failed: transient/.test(line))
  )
})

test("the poll loop and the nightly never dispatch at the same time", async () => {
  // agent.maxConcurrentJobs is 1, and two container runs at once would exceed
  // the VM's whole budget. A gate rather than a refusal: the loop treats a
  // throwing runner as a failed job, and a pull request must not be failed for
  // arriving while the nightly happened to be running.
  const gate = createSerialGate()
  const order = []
  let concurrent = 0
  let peak = 0
  const task = (name) => async () => {
    concurrent += 1
    peak = Math.max(peak, concurrent)
    order.push(`${name}:start`)
    await new Promise((resolve) => setTimeout(resolve, 1))
    order.push(`${name}:end`)
    concurrent -= 1
    return name
  }

  const first = gate.run(task("nightly"))
  const failing = gate.run(async () => {
    throw new Error("the nightly blew up")
  })
  const second = gate.run(task("pr"))

  assert.equal(await first, "nightly")
  await assert.rejects(failing, /blew up/)
  assert.equal(await second, "pr")
  assert.equal(peak, 1)
  assert.deepEqual(order, [
    "nightly:start",
    "nightly:end",
    "pr:start",
    "pr:end",
  ])
  assert.equal(gate.waiting, 0)
})

test("CLI help executes through the installed current symlink with spaces", () => {
  const root = mkdtempSync(join(tmpdir(), "local ci entry-"))
  try {
    const current = join(root, "current")
    symlinkSync(
      fileURLToPath(new URL("../../ops/local-ci/agent", import.meta.url)),
      current
    )
    const result = spawnSync(
      process.execPath,
      [join(current, "main.mjs"), "--help"],
      {
        encoding: "utf8",
      }
    )
    assert.equal(result.status, 0, result.stderr)
    assert.match(result.stdout, /nabaperks local CI agent/)
    assert.match(result.stdout, /--watch/)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("dispatch preserves cancellation through preparation and releases the workspace", async () => {
  const controller = new AbortController()
  const events = []
  const args = {
    contract: {},
    config: {},
    logger: { info() {} },
    evidence: {
      open: () => ({ path: "/unused", close: () => events.push("closed") }),
    },
    profile: { profile: "main" },
    ref: "refs/heads/main",
    headSha: "a".repeat(40),
    signal: controller.signal,
  }
  const reason = new Error("operator stopped the agent")
  const dependencies = {
    assertVmIsolationLive: async () => events.push("isolation"),
    buildDependencies: async () => ({
      runner: {
        runProfile: async ({ signal }) => {
          assert.equal(signal, controller.signal)
          controller.abort(reason)
          signal.throwIfAborted()
        },
      },
    }),
    makeEnvFileWriter: () => () => {},
    releaseWorkspace: async () => events.push("released"),
  }
  await assert.rejects(
    dispatchRun(args, dependencies),
    (error) => error === reason
  )
  assert.deepEqual(events, ["isolation", "released", "closed"])
})

test("cancellation while preparing a workspace prevents any container launch", async () => {
  const controller = new AbortController()
  const events = []
  const reason = new Error("superseded during checkout")
  await assert.rejects(
    dispatchRun(
      {
        contract: {},
        config: {},
        logger: { info() {} },
        evidence: {
          open: () => ({ path: "/unused", close: () => events.push("closed") }),
        },
        profile: { profile: "main" },
        headSha: "a".repeat(40),
        signal: controller.signal,
      },
      {
        assertVmIsolationLive: async () => {},
        buildDependencies: async () => {
          controller.abort(reason)
          return {
            runner: {
              runProfile: () => assert.fail("cancelled work must not launch"),
            },
          }
        },
        makeEnvFileWriter: () =>
          assert.fail("cancelled work must not create fixtures"),
        releaseWorkspace: async () => events.push("released"),
      }
    ),
    (error) => error === reason
  )
  assert.deepEqual(events, ["released", "closed"])
})

test("execHost cancellation terminates descendants and preserves its reason", async () => {
  const controller = new AbortController()
  const started = Date.now()
  const reason = new Error("cancel fixture checkout")
  const timer = setTimeout(() => controller.abort(reason), 50)
  try {
    await assert.rejects(
      execHost(["/bin/sh", "-c", "sleep 6 & wait"], {
        input: "x".repeat(1024 * 1024),
        signal: controller.signal,
      }),
      (error) => error === reason
    )
    assert.ok(
      Date.now() - started < 3000,
      "descendant output pipes must close promptly"
    )
  } finally {
    clearTimeout(timer)
  }
})

test("nightly shutdown settles an outstanding interval wait", async () => {
  let entered
  const waiting = new Promise((resolve) => {
    entered = resolve
  })
  const scheduler = createNightlyScheduler({
    tick: async () => ({ ran: false }),
    sleep: () => {
      entered()
      return new Promise(() => {})
    },
  })
  const run = scheduler.start()
  await waiting
  scheduler.stop()
  await run
})
