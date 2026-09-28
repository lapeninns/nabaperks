import assert from "node:assert/strict"
import { spawn, spawnSync } from "node:child_process"
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { request } from "node:http"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { test } from "node:test"

import {
  CANARY_HOST_ROUTES,
  CANARY_PROBE_SCRIPT,
  CANARY_STALE_MS,
  CREATED_AT_LABEL,
  DOCKER_CLI,
  EGRESS_HOSTS,
  HELPER_INSTALL_FLAGS,
  JOB_INSTALL_FLAGS,
  LANE_SCRIPT_PRELUDE,
  PERMITTED_HOST_EXECUTABLES,
  PRIVATE_V4_PATTERN,
  PROBE_MARKER,
  assertAdapterMatchesContract,
  buildHelperInstallScript,
  buildProxySource,
  buildReleaseScript,
  buildStoreSeedScript,
  canaryViolations,
  compareVersions,
  createDockerDesktopRuntime,
  dockerConfigViolations,
  engineViolations,
  externalMemoryGb,
  fileSharingViolations,
  jobContainerViolations,
  laneSubpath,
  networkViolations,
  openLoopbackListener,
  parseDockerSize,
  parseProbeReport,
  physicalPath,
  storeSubpath,
  subnetInPool,
  withoutFirmlink,
} from "../../ops/local-ci/agent/runtime-docker-desktop.mjs"
import { committedContract } from "../support/local-ci-contracts.mjs"

/**
 * local CI - the Docker Desktop runtime.
 *
 * The runtime replaces a dedicated VM with a shared one, so everything the
 * dedicated VM gave for free is a check here, and every check has to fail
 * closed: an answer it cannot get is a refusal, and an answer it does not
 * like is a refusal that names what to fix. These tests drive the pure
 * verdicts with the shapes Docker Desktop actually returns, and the runtime
 * object with a scripted `execHost`, so no test touches a real daemon.
 */

const contract = committedContract()
const runtimeBlock = contract.runtime
const SHA = "b".repeat(40)
const ROOT = "/var/lib/nabaperks-ci"
const HOME = "/Users/operator"
const GIB = 1024 ** 3

const goodInfo = Object.freeze({
  OperatingSystem: "Docker Desktop",
  OSType: "linux",
  Architecture: "aarch64",
  ServerVersion: "29.8.0",
  NCPU: 18,
  MemTotal: 54643150848,
  SecurityOptions: ["name=seccomp,profile=builtin", "name=cgroupns"],
})

test("the host may run only /bin/sh and Docker Desktop's CLI - never Lima's", () => {
  assert.deepEqual(PERMITTED_HOST_EXECUTABLES, ["/bin/sh", DOCKER_CLI])
  assert.equal(DOCKER_CLI, "/usr/local/bin/docker")
  assert.ok(Object.isFrozen(PERMITTED_HOST_EXECUTABLES))
  assert.equal(PERMITTED_HOST_EXECUTABLES.includes("limactl"), false)
})

test("the adapter refuses a contract that claims a guarantee its code does not apply", () => {
  assert.equal(assertAdapterMatchesContract(contract), contract.runtime)
  for (const edit of [
    (runtime) => (runtime.kind = "lima"),
    (runtime) => (runtime.dockerCli = "/opt/homebrew/bin/docker"),
    (runtime) => (runtime.context = "default"),
    (runtime) => runtime.helper.installFlags.pop(),
    (runtime) => runtime.jobInstallFlags.shift(),
    (runtime) => runtime.helper.egress.hosts.push("example.com"),
    (runtime) => (runtime.helper.egress.ports = [443, 80]),
    (runtime) => (runtime.helper.user = "0:0"),
    (runtime) => (runtime.jobNetwork.internal = false),
    (runtime) => runtime.bindMounts.push("/Users"),
    (runtime) => runtime.privilegedContainers.push("netguard"),
  ]) {
    const modified = structuredClone(contract)
    edit(modified.runtime)
    assert.throws(() => assertAdapterMatchesContract(modified), {
      code: "RUNTIME_CONTRACT_MISMATCH",
    })
  }
})

test("the engine must be Docker Desktop on arm64 at the pinned version and size", () => {
  assert.deepEqual(engineViolations(goodInfo, runtimeBlock), [])
  const cases = {
    OperatingSystem: ["Ubuntu 24.04", /not Docker Desktop/],
    OSType: ["windows", /not linux/],
    Architecture: ["x86_64", /not aarch64/],
    ServerVersion: ["27.5.1", /older than 29\.0\.0/],
    NCPU: [12, /needs 18/],
    MemTotal: [40 * GIB, /needs 50 GiB/],
    SecurityOptions: [["name=cgroupns"], /seccomp/],
  }
  for (const [field, [value, pattern]] of Object.entries(cases)) {
    const violations = engineViolations(
      { ...goodInfo, [field]: value },
      runtimeBlock
    )
    assert.equal(violations.length, 1, field)
    assert.match(violations[0], pattern)
  }
  assert.equal(engineViolations(null, runtimeBlock).length, 1)
  assert.equal(compareVersions("29.8.0", "29.0.0"), 1)
  assert.equal(compareVersions("29.0.0", "29.0.0"), 0)
  assert.equal(compareVersions("28.9.9", "29.0.0"), -1)
  assert.equal(compareVersions("29.10.0-rc1", "29.9.9"), 1)
})

test("file sharing must be explicit and reach neither the key directory nor the whole home", () => {
  const protectedPaths = ["~/.nabaperks-local-ci"]
  const verdict = (shared) =>
    fileSharingViolations(
      shared === undefined ? {} : { FilesharingDirectories: shared },
      { home: HOME, protectedPaths }
    )
  // Docker Desktop writes no key until the operator changes the list, and its
  // defaults share /Users.
  assert.match(verdict(undefined)[0], /default file sharing/)
  assert.match(verdict(null)[0], /default file sharing/)
  assert.deepEqual(
    verdict([`${HOME}/LapenInns Project`, `${HOME}/.cache/nabaperks-local-ci`]),
    []
  )
  assert.deepEqual(verdict([]), [])
  for (const shared of [
    ["/Users"],
    ["/users/"],
    ["/"],
    [HOME],
    [`${HOME}/`],
    [`${HOME}/.nabaperks-local-ci`],
    [`${HOME}/.NABAPERKS-local-ci/runs`],
    [7],
  ]) {
    assert.equal(verdict(shared).length, 1, JSON.stringify(shared))
  }
  assert.equal(verdict(["/Users", `${HOME}/.nabaperks-local-ci`]).length, 2)
})

/** A realpath over a table of symlinks; everything else resolves to itself. */
function fakeRealpath(links, missing = []) {
  return (path) => {
    for (const prefix of missing) {
      if (path === prefix || path.startsWith(`${prefix}/`)) {
        const error = new Error(`ENOENT: ${path}`)
        error.code = "ENOENT"
        throw error
      }
    }
    for (const [link, target] of Object.entries(links)) {
      if (path === link || path.startsWith(`${link}/`))
        return join(target, path.slice(link.length))
    }
    return path
  }
}

test("file sharing is judged where each path physically lives, not as it is spelt", () => {
  const realpath = fakeRealpath({
    "/Volumes/Macintosh HD": "/",
    [`${HOME}/.nabaperks-local-ci`]: `${HOME}/secure/ci`,
  })
  const resolve = (path) => physicalPath(path, realpath)
  const protectedPaths = ["~/.nabaperks-local-ci"]
  const verdict = (shared, withResolve = true) =>
    fileSharingViolations(
      { FilesharingDirectories: shared },
      { home: HOME, protectedPaths, ...(withResolve ? { resolve } : {}) }
    )

  // A symlink to / spells /Users without saying it: text alone passes it.
  assert.deepEqual(verdict(["/Volumes/Macintosh HD/Users"], false), [])
  assert.match(
    verdict(["/Volumes/Macintosh HD/Users"])[0],
    /covers the whole home directory/
  )
  // The data volume's firmlinks are the same directories, with or without a
  // resolver, because realpath leaves a firmlink as it is.
  for (const entry of [
    "/System/Volumes/Data/Users",
    "/system/volumes/data/Users/operator/",
    "/System/Volumes/Data",
  ]) {
    assert.equal(verdict([entry], false).length, 1, entry)
    assert.equal(verdict([entry]).length, 1, entry)
  }
  // A symlinked credential directory is protected where it really is.
  assert.deepEqual(verdict([`${HOME}/secure`], false), [])
  assert.match(
    verdict([`${HOME}/secure`])[0],
    /reaches the protected path ".*\/\.nabaperks-local-ci"/
  )
  assert.equal(verdict([`${HOME}/secure/ci/runs`]).length, 1)
  assert.deepEqual(verdict([`${HOME}/LapenInns Project`, "/private/tmp"]), [])

  assert.equal(withoutFirmlink("/System/Volumes/Data/Users/x"), "/Users/x")
  assert.equal(
    withoutFirmlink("/System/Volumes/DataX"),
    "/System/Volumes/DataX"
  )
  // A path that does not exist yet lives where its nearest ancestor does.
  const partial = fakeRealpath({ "/a": "/x" }, ["/a/b"])
  assert.equal(physicalPath("/a/b/c", partial), "/x/b/c")
  const denied = () => {
    const error = new Error("EACCES")
    error.code = "EACCES"
    throw error
  }
  assert.throws(() => physicalPath("/a", denied), { code: "EACCES" })
})

test("the agent's DOCKER_CONFIG may carry no credential", () => {
  assert.deepEqual(dockerConfigViolations(null), [])
  assert.deepEqual(dockerConfigViolations("{}"), [])
  assert.deepEqual(dockerConfigViolations('{"auths":{},"credsStore":""}'), [])
  assert.deepEqual(dockerConfigViolations('{"credsStore":"desktop"}'), [
    "config.json sets credsStore",
  ])
  assert.deepEqual(
    dockerConfigViolations('{"auths":{"ghcr.io":{}},"credHelpers":{"a":"b"}}'),
    ["config.json sets credHelpers", "config.json sets auths"]
  )
  assert.deepEqual(dockerConfigViolations("not json"), [
    "config.json is not valid JSON",
  ])
})

const cleanReport = (port, overrides = {}) =>
  [
    ...CANARY_HOST_ROUTES.map((host) => `reach ${host}:${port}=unreachable`),
    "reach 1.1.1.1:443=unreachable",
    "path /Users=absent",
    "path /host_mnt=absent",
    "ssh_auth_sock=[]",
    "mountinfo=readable",
    "host_mounts=[]",
    ...Object.entries(overrides).map(([key, value]) => `${key}=${value}`),
    PROBE_MARKER,
    "",
  ].join("\n")

test("the negative canary passes only an internal network with nothing of the Mac in it", () => {
  const port = 41234
  const verdict = (text, connections = 0) =>
    canaryViolations(parseProbeReport(text), { port, connections })
  assert.deepEqual(verdict(cleanReport(port)), [])
  assert.match(
    verdict(
      cleanReport(port, { [`reach host.docker.internal:${port}`]: "reachable" })
    )[0],
    /reaches the Mac through host\.docker\.internal/
  )
  assert.match(
    verdict(
      cleanReport(port, { [`reach 192.168.65.254:${port}`]: "reachable" })
    )[0],
    /192\.168\.65\.254/
  )
  assert.match(
    verdict(cleanReport(port, { "reach 1.1.1.1:443": "reachable" }))[0],
    /not internal/
  )
  assert.match(
    verdict(cleanReport(port, { "path /Users": "present" }))[0],
    /\/Users is visible/
  )
  assert.match(
    verdict(cleanReport(port, { host_mounts: "[virtiofs]" }))[0],
    /host-share mounts/
  )
  assert.match(
    verdict(cleanReport(port, { ssh_auth_sock: "[/run/ssh]" }))[0],
    /SSH_AUTH_SOCK/
  )
  assert.match(
    verdict(cleanReport(port, { mountinfo: "unreadable" }))[0],
    /cannot be ruled out/
  )
  // The listener decides even when the probe claims otherwise.
  assert.match(verdict(cleanReport(port), 1)[0], /accepted 1 connection/)
  // A truncated probe proves nothing.
  assert.match(
    verdict(cleanReport(port).replace(PROBE_MARKER, ""))[0],
    /did not run to completion/
  )
  // The probe asks about each Desktop route to the Mac, and ends with the marker.
  for (const host of ["host.docker.internal", "192.168.65.254"])
    assert.ok(CANARY_PROBE_SCRIPT.includes(`reach ${host} "$port"`))
  assert.ok(CANARY_PROBE_SCRIPT.trimEnd().endsWith(`echo ${PROBE_MARKER}`))
})

test("a created job container must be exactly what its argv promised", () => {
  const network = `nabaperks-ci-net-${SHA.slice(0, 12)}-fast-1`
  const expectation = {
    network,
    volume: "nabaperks-ci-state",
    subpaths: [`runs/${SHA}-lanes/fast`, storeSubpath(SHA)],
    labels: { "com.nabaperks.local-ci.head-sha": SHA },
  }
  const inspect = {
    HostConfig: {
      Privileged: false,
      Binds: null,
      PortBindings: {},
      PublishAllPorts: false,
      NetworkMode: network,
      CapAdd: null,
      Devices: [],
      SecurityOpt: ["no-new-privileges"],
      Mounts: [
        {
          Type: "volume",
          Source: "nabaperks-ci-state",
          Target: "/workspace",
          VolumeOptions: { Subpath: `runs/${SHA}-lanes/fast` },
        },
        {
          Type: "volume",
          Source: "nabaperks-ci-state",
          Target: "/var/lib/nabaperks-ci/stores/pnpm",
          VolumeOptions: { Subpath: storeSubpath(SHA) },
        },
        {
          Type: "tmpfs",
          Target: "/var/lib/nabaperks-ci/stores/pnpm/v10/projects",
        },
      ],
    },
    Config: { Labels: { "com.nabaperks.local-ci.head-sha": SHA } },
  }
  assert.deepEqual(jobContainerViolations(inspect, expectation), [])
  const broken = [
    (host) => (host.Privileged = true),
    (host) => (host.Binds = ["/Users:/u"]),
    (host) => (host.PortBindings = { "3000/tcp": [{}] }),
    (host) => (host.PublishAllPorts = true),
    (host) => (host.NetworkMode = "bridge"),
    (host) => (host.CapAdd = ["SYS_ADMIN"]),
    (host) => (host.Devices = [{ PathOnHost: "/dev/kvm" }]),
    (host) => (host.PidMode = "host"),
    (host) => (host.SecurityOpt = []),
    (host) => (host.Mounts[0].Type = "bind"),
    (host) => (host.Mounts[0].Source = "someone-elses-volume"),
    (host) => (host.Mounts[0].VolumeOptions.Subpath = "repo"),
  ]
  for (const edit of broken) {
    const modified = structuredClone(inspect)
    edit(modified.HostConfig)
    assert.equal(
      jobContainerViolations(modified, expectation).length,
      1,
      edit.toString()
    )
  }
  const unlabelled = structuredClone(inspect)
  unlabelled.Config.Labels = {}
  assert.match(
    jobContainerViolations(unlabelled, expectation)[0],
    /lacks the label/
  )
  assert.deepEqual(
    networkViolations(
      { Internal: true, IPAM: { Config: [{ Subnet: "10.213.16.0/24" }] } },
      { internal: true, subnet: "10.213.16.0/24" }
    ),
    []
  )
  assert.equal(
    networkViolations(
      { Internal: false, IPAM: { Config: [{ Subnet: "172.30.0.0/16" }] } },
      { internal: true, subnet: "10.213.16.0/24" }
    ).length,
    2
  )
})

test("pool subnets, lane subpaths and store paths are built from validated ids only", () => {
  assert.equal(subnetInPool("10.213.0.0/16", 16), "10.213.16.0/24")
  for (const [pool, slot] of [
    ["10.213.0.0/16", 0],
    ["10.213.0.0/16", 255],
    ["10.213.0.0/16", 1.5],
    ["192.168.0.0/16", 3],
  ])
    assert.throws(() => subnetInPool(pool, slot), { code: "INVALID_INPUT" })
  assert.deepEqual(
    laneSubpath(ROOT, `${ROOT}/runs/${SHA}-lanes/e2e-chromium-odd`),
    {
      subpath: `runs/${SHA}-lanes/e2e-chromium-odd`,
      headSha: SHA,
      laneId: "e2e-chromium-odd",
    }
  )
  for (const path of [
    `/elsewhere/runs/${SHA}-lanes/fast`,
    `${ROOT}/runs/${SHA}-lanes/../repo`,
    `${ROOT}/runs/${SHA}-lanes/fast/sub`,
    `${ROOT}/runs/abc-lanes/fast`,
    `${ROOT}/repo`,
    `${ROOT}/runs/${SHA}-lanes/Fast`,
  ])
    assert.throws(() => laneSubpath(ROOT, path), { code: "INVALID_INPUT" })
  assert.equal(storeSubpath(SHA), `runs/${SHA}-store/pnpm`)
})

test("the helper installs with no scripts, no hooks and copied files, and refuses configDependencies", () => {
  const script = buildHelperInstallScript({
    laneDir: `${ROOT}/runs/${SHA}-lanes/fast`,
    storePath: `${ROOT}/stores/pnpm`,
  })
  for (const flag of HELPER_INSTALL_FLAGS)
    assert.ok(script.includes(flag), flag)
  assert.match(script, /--store-dir '\/var\/lib\/nabaperks-ci\/stores\/pnpm'/)
  assert.match(script, /--modules-dir node_modules/)
  assert.match(script, /--virtual-store-dir node_modules\/\.pnpm/)

  // Behaviour, with a stub pnpm on PATH: refuse, or install with the flags.
  const root = mkdtempSync(join(tmpdir(), "local-ci-helper-"))
  try {
    const bin = join(root, "bin")
    mkdirSync(bin)
    writeFileSync(
      join(bin, "pnpm"),
      `#!/bin/sh\nprintf '%s\\n' "$@" > "${join(root, "pnpm-args")}"\n`
    )
    chmodSync(join(bin, "pnpm"), 0o755)
    const lane = join(root, "lane")
    mkdirSync(lane)
    const run = () =>
      spawnSync(
        "/bin/sh",
        [
          "-c",
          buildHelperInstallScript({ laneDir: lane, storePath: "/store" }),
        ],
        { env: { PATH: `${bin}:/usr/bin:/bin` }, encoding: "utf8" }
      )
    writeFileSync(join(lane, "package.json"), '{"name":"x"}')
    writeFileSync(
      join(lane, "pnpm-workspace.yaml"),
      "configDependencies:\n  evil: 1.0.0\n"
    )
    const refused = run()
    assert.equal(refused.status, 3)
    assert.match(refused.stderr, /configDependencies/)
    assert.throws(() => readFileSync(join(root, "pnpm-args")))
    writeFileSync(join(lane, "pnpm-workspace.yaml"), "packages: []\n")
    const installed = run()
    assert.equal(installed.status, 0, installed.stderr)
    const args = readFileSync(join(root, "pnpm-args"), "utf8")
      .trim()
      .split("\n")
    assert.deepEqual(args.slice(0, 5), ["install", ...HELPER_INSTALL_FLAGS])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("each run gets its own store, and release removes the run's paths and nothing else", () => {
  const seed = buildStoreSeedScript({ root: ROOT, headSha: SHA })
  assert.match(seed, new RegExp(`rm -rf '${ROOT}/runs/${SHA}-store'`))
  assert.match(seed, /cp -a \/opt\/pnpm-store\/\. /)
  assert.match(seed, /v10\/projects/)
  const release = buildReleaseScript({ root: ROOT, headSha: SHA })
  assert.deepEqual(
    release.split("\n").filter((line) => line.startsWith("rm -rf")),
    [
      `rm -rf '${ROOT}/runs/${SHA}'`,
      `rm -rf '${ROOT}/runs/${SHA}-lanes'`,
      `rm -rf '${ROOT}/runs/${SHA}-store'`,
    ]
  )
  assert.doesNotMatch(release, /\/repo|stores/)
})

test("a job installs offline and runs the builds the helper skipped", () => {
  assert.deepEqual(JOB_INSTALL_FLAGS, ["--offline", "--frozen-lockfile"])
  assert.ok(
    LANE_SCRIPT_PRELUDE.includes("pnpm install --offline --frozen-lockfile")
  )
  assert.ok(
    LANE_SCRIPT_PRELUDE.includes(
      "pnpm rebuild --pending --config.side-effects-cache=false"
    )
  )
})

test("the egress proxy refuses everything but allowlisted HTTPS to public addresses", async () => {
  for (const address of [
    "10.0.0.1",
    "127.0.0.1",
    "169.254.1.1",
    "172.20.0.1",
    "192.168.65.254",
    "192.168.1.60",
    "100.64.0.1",
    "224.0.0.1",
    "0.0.0.0",
  ])
    assert.ok(PRIVATE_V4_PATTERN.test(address), address)
  for (const address of ["1.1.1.1", "104.16.7.34", "20.26.156.215"])
    assert.equal(PRIVATE_V4_PATTERN.test(address), false, address)

  const port = await new Promise((resolve) => {
    const probe = createServer().listen(0, "127.0.0.1", () => {
      const { port: free } = probe.address()
      probe.close(() => resolve(free))
    })
  })
  const proxy = spawn(
    process.execPath,
    ["-e", buildProxySource({ listenPort: port })],
    {
      stdio: ["ignore", "pipe", "pipe"],
    }
  )
  try {
    await new Promise((resolve, reject) => {
      proxy.stdout.on("data", (chunk) => {
        if (String(chunk).includes("proxy listening")) resolve()
      })
      proxy.once("exit", () => reject(new Error("proxy exited")))
    })
    const connectStatus = (target) =>
      new Promise((resolve, reject) => {
        const req = request({
          host: "127.0.0.1",
          port,
          method: "CONNECT",
          path: target,
        })
        req.on("connect", (res, socket) => {
          socket.destroy()
          resolve(res.statusCode)
        })
        req.on("response", (res) => resolve(res.statusCode))
        req.on("error", reject)
        req.end()
      })
    for (const target of [
      "example.com:443",
      "host.docker.internal:443",
      "registry.npmjs.org:80",
      "github.com.evil.test:443",
    ])
      assert.equal(await connectStatus(target), 403, target)
    const plain = await new Promise((resolve, reject) => {
      const req = request({ host: "127.0.0.1", port, path: "/" }, (res) =>
        resolve(res.statusCode)
      )
      req.on("error", reject)
      req.end()
    })
    assert.equal(plain, 403)
    for (const host of EGRESS_HOSTS)
      assert.ok(buildProxySource().includes(host))
  } finally {
    proxy.kill("SIGKILL")
  }
})

test("docker sizes parse in both unit systems, and only foreign containers count", () => {
  assert.equal(parseDockerSize("1.5GiB"), 1.5 * GIB)
  assert.equal(parseDockerSize("512MiB"), 512 * 1024 ** 2)
  assert.equal(parseDockerSize("12.3MB"), 12.3e6)
  assert.equal(parseDockerSize(" 7B "), 7)
  assert.ok(Number.isNaN(parseDockerSize("n/a")))
  const rows = [
    JSON.stringify({ ID: "aaaaaaaaaaaa", MemUsage: "4GiB / 50.9GiB" }),
    JSON.stringify({ ID: "bbbbbbbbbbbb", MemUsage: "2GiB / 50.9GiB" }),
    JSON.stringify({ ID: "cccccccccccc", MemUsage: "-- / --" }),
    "",
  ]
  assert.equal(externalMemoryGb(rows, [`bbbbbbbbbbbb${"0".repeat(52)}`]), 4)
  assert.equal(externalMemoryGb(rows, []), 6)
})

test("the loopback listener counts what reaches it", async () => {
  const listener = await openLoopbackListener()
  try {
    assert.equal(listener.connections(), 0)
    await new Promise((resolve, reject) => {
      const socket = request({
        host: "127.0.0.1",
        port: listener.port,
        path: "/",
      })
      socket.on("error", () => resolve())
      socket.on("close", resolve)
      socket.end()
      setTimeout(() => reject(new Error("timeout")), 3000).unref()
    })
    assert.equal(listener.connections(), 1)
  } finally {
    await listener.close()
  }
})

/* ------------------------------------------------ the runtime, scripted */

/** A scripted execHost: `respond(args)` sees the docker words after the prefix. */
function scriptedExec(respond) {
  const calls = []
  const exec = async (argv, options = {}) => {
    calls.push({ argv, options })
    const args = argv.slice(3)
    const answer = await respond(args, options, argv)
    if (answer instanceof Error) throw answer
    return answer ?? ""
  }
  return { exec, calls }
}

function harness({
  settings,
  config = null,
  respond = () => undefined,
  options = {},
} = {}) {
  const root = mkdtempSync(join(tmpdir(), "local-ci-dd-"))
  const files = {
    [join(HOME, runtimeBlock.fileSharing.settingsFile)]: JSON.stringify(
      settings ?? { FilesharingDirectories: [`${HOME}/LapenInns Project`] }
    ),
    ...(config === null ? {} : { "/cfg/config.json": config }),
  }
  const readFile = (path) => {
    if (Object.hasOwn(files, path)) return files[path]
    const error = new Error(`ENOENT: ${path}`)
    error.code = "ENOENT"
    throw error
  }
  const scripted = scriptedExec((args, options, argv) => {
    const answer = respond(args, options, argv)
    if (answer !== undefined) return answer
    if (args[0] === "info") return JSON.stringify(goodInfo)
    if (args[0] === "volume" && args[1] === "inspect")
      return JSON.stringify({
        Name: "nabaperks-ci-state",
        Labels: { "com.nabaperks.local-ci.role": "state" },
      })
    if (args[0] === "run" && args.includes("/bin/bash"))
      return cleanReport(args.at(-1))
    if (args[0] === "ps" || args[0] === "network") return ""
    if (args[0] === "logs") return "proxy listening\n"
    return ""
  })
  const runtime = createDockerDesktopRuntime({
    contract,
    config: {
      stateRoot: join(root, "state"),
      jobImage: "nabaperks-ci-job:abc123",
    },
    execHost: scripted.exec,
    env: { PATH: "/usr/bin:/bin", HOME, DOCKER_HOST: "tcp://evil:2375" },
    home: HOME,
    dockerConfig: "/cfg",
    readFile,
    randomHex: () => "0123456789ab",
    ...options,
  })
  return { runtime, calls: scripted.calls, root }
}

test("every docker call names the context, the allowlist and a clean CLI environment", async () => {
  const { runtime, calls, root } = harness()
  try {
    const verdict = await runtime.assertIsolationLive()
    assert.equal(verdict.runtime, "docker-desktop")
    assert.equal(verdict.engine.serverVersion, "29.8.0")
    assert.deepEqual(verdict.fileSharing.shared, [`${HOME}/LapenInns Project`])
    assert.equal(verdict.canary.probe, "ok")
    assert.ok(calls.length > 0)
    for (const { argv, options } of calls) {
      assert.deepEqual(argv.slice(0, 3), [
        "/usr/local/bin/docker",
        "--context",
        "desktop-linux",
      ])
      assert.equal(options.permitted, PERMITTED_HOST_EXECUTABLES)
      assert.equal(options.env.DOCKER_CONFIG, "/cfg")
      assert.equal(options.env.DOCKER_HOST, undefined)
      for (const word of argv) {
        assert.doesNotMatch(word, /^--privileged|^-v$|^--volume|type=bind/)
      }
    }
    // The canary ran on an internal pool network and was removed afterwards.
    const create = calls.find(
      ({ argv }) => argv[3] === "network" && argv[4] === "create"
    )
    assert.ok(create.argv.includes("--internal"))
    assert.ok(create.argv.includes("10.213.1.0/24"))
    assert.ok(
      calls.some(
        ({ argv }) =>
          argv[3] === "network" &&
          argv[4] === "rm" &&
          argv[5] === "nabaperks-ci-canary-0123456789ab"
      )
    )
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("every part of the verdict fails closed with the reason an operator can act on", async () => {
  const cases = [
    [
      {
        respond: (args) =>
          args[0] === "info" ? new Error("no daemon") : undefined,
      },
      "VM_UNVERIFIABLE",
      /never started or repaired/,
    ],
    [
      {
        respond: (args) =>
          args[0] === "info"
            ? JSON.stringify({ ...goodInfo, NCPU: 8 })
            : undefined,
      },
      "VM_ISOLATION_VIOLATION",
      /needs 18/,
    ],
    [{ settings: {} }, "VM_ISOLATION_VIOLATION", /default file sharing/],
    [
      { settings: { FilesharingDirectories: ["/Users"] } },
      "VM_ISOLATION_VIOLATION",
      /whole home directory/,
    ],
    [
      { config: '{"credsStore":"desktop"}' },
      "VM_ISOLATION_VIOLATION",
      /credsStore/,
    ],
    [
      {
        respond: (args) =>
          args[0] === "volume" && args[1] === "inspect"
            ? JSON.stringify({ Labels: {} })
            : undefined,
      },
      "VM_ISOLATION_VIOLATION",
      /without this agent's labels/,
    ],
    [
      {
        respond: (args) =>
          args[0] === "run" && args.includes("/bin/bash")
            ? cleanReport(args.at(-1), {
                [`reach host.docker.internal:${args.at(-1)}`]: "reachable",
              })
            : undefined,
      },
      "VM_ISOLATION_VIOLATION",
      /host\.docker\.internal/,
    ],
    [
      {
        respond: (args) =>
          args[0] === "run" && args.includes("/bin/bash")
            ? new Error("No such image")
            : undefined,
      },
      "VM_UNVERIFIABLE",
      /could not run/,
    ],
    [
      {
        respond: (args) =>
          args[0] === "run" && args.includes("/bin/bash")
            ? "reach nothing"
            : undefined,
      },
      "VM_UNVERIFIABLE",
      /did not run to completion/,
    ],
  ]
  for (const [setup, code, message] of cases) {
    const { runtime, root } = harness(setup)
    try {
      await assert.rejects(runtime.assertIsolationLive(), (error) => {
        assert.equal(error.code, code)
        assert.match(error.message, message)
        return true
      })
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  }
})

test("the runtime compares file sharing through symlinks and refuses a path it cannot resolve", async () => {
  const symlinked = harness({
    settings: { FilesharingDirectories: [`${HOME}/secure`] },
    options: {
      realpath: fakeRealpath({
        [`${HOME}/.nabaperks-local-ci`]: `${HOME}/secure/ci`,
      }),
    },
  })
  const denied = harness({
    options: {
      realpath: (path) => {
        if (!path.startsWith(HOME)) return path
        const error = new Error(`EACCES: ${path}`)
        error.code = "EACCES"
        throw error
      },
    },
  })
  try {
    await assert.rejects(symlinked.runtime.assertIsolationLive(), (error) => {
      assert.equal(error.code, "VM_ISOLATION_VIOLATION")
      assert.match(error.message, /reaches the protected path/)
      return true
    })
    await assert.rejects(denied.runtime.assertIsolationLive(), (error) => {
      assert.equal(error.code, "VM_UNVERIFIABLE")
      assert.match(error.message, /could not resolve .*EACCES/)
      return true
    })
  } finally {
    rmSync(symlinked.root, { recursive: true, force: true })
    rmSync(denied.root, { recursive: true, force: true })
  }
})

/**
 * A daemon that keeps canary containers and networks as state: a network on
 * a subnet already in use is refused, as the pool overlap is, and a canary
 * whose container is removed while its probe runs fails, as `docker run`
 * does.
 */
function canaryDaemon(seed = { containers: [], networks: [] }) {
  const containers = new Map(
    seed.containers.map(({ name, ...rest }) => [name, rest])
  )
  const networks = new Map(
    seed.networks.map(({ name, ...rest }) => [name, rest])
  )
  let sequence = 0
  const createdAt = (args) =>
    args
      .find((word) => word.startsWith(`${CREATED_AT_LABEL}=`))
      ?.slice(CREATED_AT_LABEL.length + 1) ?? ""
  const remove = (map, target) => {
    for (const [name, entry] of map)
      if (entry.id === target || name === target) map.delete(name)
    return ""
  }
  const respond = (args) => {
    if (
      args[0] === "ps" &&
      args.includes(`label=com.nabaperks.local-ci.role=canary`)
    )
      return [...containers]
        .map(([name, entry]) => `${entry.id} ${name} ${entry.createdAt}`)
        .join("\n")
    if (args[0] === "network" && args[1] === "ls")
      return [...networks]
        .map(([name, entry]) => `${entry.id} ${name} ${entry.createdAt}`)
        .join("\n")
    if (args[0] === "network" && args[1] === "create") {
      const subnet = args[args.indexOf("--subnet") + 1]
      if ([...networks.values()].some((entry) => entry.subnet === subnet))
        return new Error("Pool overlaps with other one on this address space")
      sequence += 1
      networks.set(args.at(-1), {
        id: `n${sequence}`,
        subnet,
        createdAt: createdAt(args),
      })
      return ""
    }
    if (args[0] === "network" && args[1] === "rm")
      return remove(networks, args[2])
    if (args[0] === "rm") return remove(containers, args[2])
    if (args[0] === "run" && args.includes("/bin/bash")) {
      const name = args[args.indexOf("--name") + 1]
      sequence += 1
      const id = `c${sequence}`
      containers.set(name, { id, createdAt: createdAt(args) })
      return new Promise((resolve) => setTimeout(resolve, 30)).then(() => {
        if (containers.get(name)?.id !== id)
          return new Error(`container ${name} was removed while it ran`)
        containers.delete(name)
        return cleanReport(args.at(-1))
      })
    }
    return undefined
  }
  return { respond, containers, networks }
}

const counterHex = () => {
  let next = 0
  return () => {
    next += 1
    return next.toString(16).padStart(12, "0")
  }
}

test("isolation checks in one process run one at a time, so neither fails the other", async () => {
  // The poll loop's health check and a dispatch's own verdict can arrive
  // together; each must see its own canary through to the end.
  const daemon = canaryDaemon()
  const { runtime, root } = harness({
    respond: daemon.respond,
    options: { randomHex: counterHex() },
  })
  try {
    const verdicts = await Promise.all([
      runtime.assertIsolationLive(),
      runtime.assertIsolationLive(),
      runtime.checks.canary(),
    ])
    assert.equal(verdicts[0].canary.probe, "ok")
    assert.equal(verdicts[1].canary.probe, "ok")
    assert.equal(verdicts[2].probe, "ok")
    assert.equal(daemon.containers.size, 0)
    assert.equal(daemon.networks.size, 0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the canary sweep removes stale leftovers and leaves another process's canary alone", async () => {
  const NOW = 1_800_000_000_000
  const young = String(NOW - 1000)
  const stale = String(NOW - CANARY_STALE_MS - 1)
  const daemon = canaryDaemon({
    containers: [
      {
        name: "nabaperks-ci-canary-aaaaaaaaaaaa",
        id: "c-old",
        createdAt: stale,
      },
      { name: "nabaperks-ci-canary-bbbbbbbbbbbb", id: "c-bare", createdAt: "" },
      {
        name: "nabaperks-ci-canary-cccccccccccc",
        id: "c-young",
        createdAt: young,
      },
    ],
    networks: [
      {
        name: "nabaperks-ci-canary-aaaaaaaaaaaa",
        id: "n-old",
        subnet: "10.213.1.0/24",
        createdAt: stale,
      },
      {
        name: "nabaperks-ci-canary-cccccccccccc",
        id: "n-young",
        subnet: "10.213.9.0/24",
        createdAt: young,
      },
    ],
  })
  const { runtime, calls, root } = harness({
    respond: daemon.respond,
    options: { randomHex: counterHex(), now: () => NOW },
  })
  try {
    await runtime.assertIsolationLive()
    assert.deepEqual(
      [...daemon.containers.keys()],
      ["nabaperks-ci-canary-cccccccccccc"]
    )
    assert.deepEqual(
      [...daemon.networks.keys()],
      ["nabaperks-ci-canary-cccccccccccc"]
    )
    const created = calls.find(
      ({ argv }) => argv[3] === "network" && argv[4] === "create"
    )
    assert.ok(created.argv.includes(`${CREATED_AT_LABEL}=${NOW}`))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("a missing state volume is created with the agent's label and handed to the image's user", async () => {
  const { runtime, calls, root } = harness({
    respond: (args) =>
      args[0] === "volume" && args[1] === "inspect"
        ? new Error("No such volume")
        : undefined,
  })
  try {
    assert.deepEqual(await runtime.checks.stateVolume(), {
      volume: "nabaperks-ci-state",
      created: true,
    })
    const created = calls.find(
      ({ argv }) => argv[3] === "volume" && argv[4] === "create"
    )
    assert.ok(created.argv.includes("com.nabaperks.local-ci.role=state"))
    const chown = calls.find(({ argv }) => argv.includes("/bin/chown"))
    for (const flag of ["--network", "--cap-drop", "--cap-add", "--user"])
      assert.ok(chown.argv.includes(flag), flag)
    assert.equal(chown.argv[chown.argv.indexOf("--network") + 1], "none")
    assert.equal(chown.argv[chown.argv.indexOf("--cap-add") + 1], "CHOWN")
    assert.deepEqual(chown.argv.slice(-2), ["1001:1001", ROOT])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("preparation gives only the helper egress, through the proxy, and a lane only its own paths", async () => {
  const { runtime, calls, root } = harness()
  try {
    const workspace = await runtime.prepareWorkspace({ headSha: SHA })
    assert.equal(workspace, `${ROOT}/runs/${SHA}`)
    const words = (call) => call.argv.slice(3)
    const egress = calls.find(
      (call) =>
        words(call)[0] === "network" &&
        words(call)[1] === "create" &&
        call.argv.includes(`nabaperks-ci-egress-${SHA.slice(0, 12)}`)
    )
    const prep = calls.find(
      (call) =>
        words(call)[0] === "network" &&
        words(call)[1] === "create" &&
        call.argv.includes(`nabaperks-ci-prep-${SHA.slice(0, 12)}`)
    )
    assert.equal(egress.argv.includes("--internal"), false)
    assert.ok(prep.argv.includes("--internal"))
    const proxy = calls.find((call) => call.argv.includes("node"))
    assert.ok(proxy.argv.includes("--cap-drop"))
    assert.equal(proxy.argv.includes("--mount"), false)
    const helper = calls.find(
      (call) =>
        words(call)[0] === "run" && call.options.input?.includes("git clone")
    )
    assert.ok(
      helper.argv.includes(
        `HTTPS_PROXY=http://nabaperks-ci-proxy-${SHA.slice(0, 12)}:3128`
      )
    )
    assert.equal(
      helper.argv[helper.argv.indexOf("--network") + 1],
      `nabaperks-ci-prep-${SHA.slice(0, 12)}`
    )
    assert.match(helper.options.input, /cp -a \/opt\/pnpm-store/)

    calls.length = 0
    const lane = { id: "fast", resources: { cpus: 4, memoryGb: 8 } }
    const destination = await runtime.prepareLaneWorkspace(lane, {
      workspace,
      headSha: SHA,
      timeoutMs: 60_000,
    })
    assert.equal(destination, `${ROOT}/runs/${SHA}-lanes/fast`)
    const [clone, install] = calls.filter((call) => words(call)[0] === "run")
    assert.equal(clone.argv[clone.argv.indexOf("--network") + 1], "none")
    assert.match(clone.options.input, /test ! -L/)
    assert.equal(
      install.argv[install.argv.indexOf("--network") + 1],
      `nabaperks-ci-prep-${SHA.slice(0, 12)}`
    )
    const mounts = install.argv.flatMap((word, index) =>
      word === "--mount" ? [install.argv[index + 1]] : []
    )
    assert.deepEqual(mounts, [
      `type=volume,src=nabaperks-ci-state,dst=${destination},volume-subpath=runs/${SHA}-lanes/fast`,
      `type=volume,src=nabaperks-ci-state,dst=${ROOT}/stores/pnpm,volume-subpath=runs/${SHA}-store/pnpm`,
    ])
    assert.match(install.options.input, /--ignore-scripts --ignore-pnpmfile/)
    assert.equal(install.argv[install.argv.indexOf("--memory") + 1], "8g")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("env files stay on the Mac at 0600 and carry the store path and no retries", async () => {
  const { runtime, root } = harness()
  try {
    const write = runtime.envFileWriter({ headSha: SHA })
    const path = await write(
      { id: "fast" },
      { CI: "1", STRIPE_SECRET_KEY: "sk_test_ci" }
    )
    assert.equal(statSync(path).mode & 0o777, 0o600)
    assert.equal(statSync(join(path, "..")).mode & 0o777, 0o700)
    assert.deepEqual(readFileSync(path, "utf8").trim().split("\n"), [
      "CI=1",
      "STRIPE_SECRET_KEY=sk_test_ci",
      "npm_config_store_dir=/var/lib/nabaperks-ci/stores/pnpm",
      "npm_config_fetch_retries=0",
    ])
    await assert.rejects(write({ id: "fast" }, { BAD: "a\nb" }), {
      code: "INVALID_INPUT",
    })
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("release quarantines a run whose containers remain, and otherwise removes only its paths", async () => {
  const remaining = harness({
    respond: (args) =>
      args[0] === "ps" &&
      args.includes(`label=com.nabaperks.local-ci.head-sha=${SHA}`)
        ? "nabaperks-ci-job-bbbbbbbbbbbb-fast-1\n"
        : undefined,
  })
  try {
    await assert.rejects(remaining.runtime.releaseWorkspace({ headSha: SHA }), {
      code: "WORKSPACE_QUARANTINED",
    })
    assert.equal(
      remaining.calls.some((call) => call.options.input?.includes("rm -rf")),
      false
    )
  } finally {
    rmSync(remaining.root, { recursive: true, force: true })
  }
  const clean = harness()
  try {
    await clean.runtime.envFileWriter({ headSha: SHA })({ id: "fast" }, {})
    await clean.runtime.releaseWorkspace({ headSha: SHA })
    const release = clean.calls.find((call) =>
      call.options.input?.includes(`rm -rf '${ROOT}/runs/${SHA}-store'`)
    )
    assert.ok(release)
    assert.equal(release.argv[release.argv.indexOf("--network") + 1], "none")
    assert.throws(() => statSync(join(clean.root, "state", "job-env", SHA)))
  } finally {
    rmSync(clean.root, { recursive: true, force: true })
  }
})

test("the container options mount a lane read-write, its store read-only, and inspect before start", async () => {
  const { runtime, root } = harness({
    respond: (args) => {
      if (args[0] === "container" && args[1] === "inspect")
        return JSON.stringify({
          HostConfig: {
            Privileged: false,
            NetworkMode: "net-a",
            SecurityOpt: ["no-new-privileges"],
            Mounts: [
              {
                Type: "volume",
                Source: "nabaperks-ci-state",
                VolumeOptions: { Subpath: `runs/${SHA}-lanes/fast` },
              },
            ],
          },
          Config: { Labels: { "com.nabaperks.local-ci.head-sha": SHA } },
        })
      if (args[0] === "network" && args[1] === "inspect")
        return JSON.stringify({
          Internal: true,
          IPAM: { Config: [{ Subnet: "10.213.16.0/24" }] },
        })
      return undefined
    },
  })
  try {
    const options = runtime.containerRuntimeOptions()
    const lanePath = `${ROOT}/runs/${SHA}-lanes/fast`
    assert.equal(options.allowPrivilegedDaemon, false)
    assert.equal(options.forbidBindMounts, true)
    assert.deepEqual(options.addHosts, [])
    assert.deepEqual(options.workspaceMountFor(lanePath), {
      type: "volume",
      source: "nabaperks-ci-state",
      subpath: `runs/${SHA}-lanes/fast`,
    })
    assert.deepEqual(
      options
        .extraMountsFor(lanePath)
        .map((mount) => [mount.type, mount.readonly ?? false]),
      [
        ["volume", true],
        ["tmpfs", false],
      ]
    )
    const first = options.jobNetwork.allocateSubnet()
    const second = options.jobNetwork.allocateSubnet()
    assert.deepEqual([first, second], ["10.213.16.0/24", "10.213.17.0/24"])
    options.jobNetwork.releaseSubnet(first)
    assert.equal(options.jobNetwork.allocateSubnet(), "10.213.16.0/24")
    await options.inspectJobContainer({
      name: "nabaperks-ci-job-bbbbbbbbbbbb-fast-1",
      network: "net-a",
      subnet: "10.213.16.0/24",
      workspaceHostPath: lanePath,
    })
    await assert.rejects(
      options.inspectJobContainer({
        name: "nabaperks-ci-job-bbbbbbbbbbbb-fast-1",
        network: "net-b",
        subnet: "10.213.16.0/24",
        workspaceHostPath: lanePath,
      }),
      { code: "VM_ISOLATION_VIOLATION" }
    )
    const read = options.workspaceShellArgv("head -c 1 x", {
      workspaceHostPath: lanePath,
    })
    assert.ok(
      read.includes(
        `type=volume,src=nabaperks-ci-state,dst=${lanePath},volume-subpath=runs/${SHA}-lanes/fast,readonly`
      )
    )
    assert.equal(read[read.indexOf("--network") + 1], "none")
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("external memory excludes the agent's own containers", async () => {
  const { runtime, root } = harness({
    respond: (args) => {
      if (args[0] === "ps" && args.includes("--quiet"))
        return `${"a".repeat(64)}\n`
      if (args[0] === "stats")
        return [
          JSON.stringify({ ID: "aaaaaaaaaaaa", MemUsage: "8GiB / 50GiB" }),
          JSON.stringify({ ID: "dddddddddddd", MemUsage: "3GiB / 50GiB" }),
        ].join("\n")
      return undefined
    },
  })
  try {
    assert.equal(await runtime.externalMemoryGb(), 3)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("the runtime refuses inputs that would shadow its labels or name another volume", () => {
  const base = {
    contract,
    config: { stateRoot: "/tmp/x", jobImage: "i:1" },
    execHost: async () => "",
  }
  assert.throws(() => createDockerDesktopRuntime({ ...base, execHost: null }), {
    code: "INVALID_INPUT",
  })
  assert.throws(
    () =>
      createDockerDesktopRuntime({
        ...base,
        extraLabels: { "com.nabaperks.local-ci.role": "state" },
      }),
    { code: "INVALID_INPUT" }
  )
  assert.throws(
    () => createDockerDesktopRuntime({ ...base, stateVolume: "postgres-data" }),
    { code: "INVALID_INPUT" }
  )
})
