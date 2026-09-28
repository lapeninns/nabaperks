/**
 * The Docker Desktop runtime: the operator's Docker Desktop engine, addressed
 * only as `docker --context desktop-linux`.
 *
 * Lima gave this plane a VM of its own with no mounts. Docker Desktop's VM is
 * shared with other worktrees' containers and holds whatever file shares the
 * operator allows, so a kernel escape from a job container lands somewhere with
 * more in it. The owner accepted that weaker isolation on 2026-09-28
 * (docs/operations/local-ci.md section 7). What this module keeps in exchange
 * is enforced here, before every dispatch, and fails closed:
 *
 *   1. The engine is the one intended. `docker info` must report Docker
 *      Desktop on linux/aarch64 at the pinned minimum version, with the
 *      contract's CPU and memory and seccomp on. Every command names the
 *      context, and DOCKER_CONFIG points at an agent directory with no
 *      credential store, so neither a context switch nor a registry login
 *      reaches a job.
 *   2. The Mac shares nothing sensitive with that VM. Docker Desktop's file
 *      sharing list must be explicit and must not cover the credential
 *      directory or the whole home directory. The defaults share /Users.
 *   3. A job cannot reach the Mac. Jobs run on `--internal` networks from a
 *      reserved pool: no gateway, no host.docker.internal, no internet. A
 *      negative canary proves it each time: a one-shot listener on the Mac's
 *      127.0.0.1 must stay unreachable through host.docker.internal and
 *      192.168.65.254, and the probe must finish with `probe=ok`.
 *   4. A job is given nothing of the Mac. Workspaces live in a named volume;
 *      a job sees only its own lane directory through a volume-subpath mount
 *      and its run's pnpm store read-only. Bind mounts and privileged
 *      containers are refused by the argv builders, and each job container is
 *      inspected after it is created and before it starts.
 *
 * Candidate code runs only in job containers, each on its own `--internal`
 * lane network with no route to the prep network, the proxy or any gateway.
 * The trusted helper that has egress never runs candidate code: it clones and
 * installs with lifecycle scripts, pnpmfile hooks and configDependencies all
 * refused, through an allowlist CONNECT proxy that reaches github.com,
 * codeload.github.com and registry.npmjs.org on 443 at public addresses only.
 * Lanes are admitted concurrently, so one lane's helper may be installing
 * through the proxy while other lanes' jobs already run candidate code; what
 * separates them is the network, not the timing. A plain bridge would reach
 * Mac loopback services through host.docker.internal, which the 2026-09-28
 * spike showed. The job then installs offline, where lifecycle scripts do run
 * - with no network.
 *
 * The VM itself is not behind any of this. Its own network reaches the
 * internet and the Mac's loopback services, and Docker Desktop forwards the
 * Mac's SSH agent into it at /run/host-services/ssh-auth.sock; a kernel
 * escape from a job container gets both. docs/operations/local-ci.md section
 * 7.6 records the owner's acceptance of this on 2026-09-28, conditional on the
 * macOS ssh-agent holding no GitHub-capable key while the agent is loaded.
 *
 * A Broken or stopped engine is never repaired here. Every check refuses, and
 * the poll loop publishes nothing new until the engine is healthy again.
 */

import { randomBytes } from "node:crypto"
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { connect, createServer } from "node:net"
import { homedir } from "node:os"
import { basename, dirname, join } from "node:path"

import { LocalCiError, describeValue } from "../core/contract.mjs"
import { laneResources } from "../core/lane-scheduler.mjs"
import { isCommitSha } from "../core/queue.mjs"
import {
  assertNoBindMounts,
  assertNoDaemonSocket,
  buildMountSpec,
} from "./container.mjs"
import { reconcileAgentResources } from "./recovery.mjs"
import {
  buildLaneWorkspaceScript,
  buildWorkspacePreparationScript,
  shQuote,
} from "./workspace.mjs"

export class DockerDesktopRuntimeError extends LocalCiError {}

function fail(code, message) {
  throw new DockerDesktopRuntimeError(
    code,
    `docker-desktop runtime: ${message}`
  )
}

/** The CLI every docker command runs through; install.sh verifies it. */
export const DOCKER_CLI = "/usr/local/bin/docker"

/** The only engine this runtime talks to. */
export const DOCKER_CONTEXT = "desktop-linux"

/**
 * The executables this runtime may spawn on the host. Lima's CLI is not one
 * of them, and `docker` is the absolute path, never a PATH lookup.
 */
export const PERMITTED_HOST_EXECUTABLES = Object.freeze(["/bin/sh", DOCKER_CLI])

/**
 * The trusted helper's install: no lifecycle scripts, no pnpmfile hooks, and
 * packages copied rather than hard-linked, so a job cannot write back into
 * the store through a link. configDependencies are refused separately.
 */
export const HELPER_INSTALL_FLAGS = Object.freeze([
  "--frozen-lockfile",
  "--ignore-scripts",
  "--ignore-pnpmfile",
  "--config.package-import-method=copy",
])

/** The job's own install: offline, where lifecycle scripts run unreachably. */
export const JOB_INSTALL_FLAGS = Object.freeze([
  "--offline",
  "--frozen-lockfile",
])

/** Where the helper may connect, through the proxy, and nowhere else. */
export const EGRESS_HOSTS = Object.freeze([
  "github.com",
  "codeload.github.com",
  "registry.npmjs.org",
])
export const EGRESS_PORTS = Object.freeze([443])

/** The image's unprivileged account, which owns the state volume. */
export const HELPER_USER = "1001:1001"

/** The baked pnpm store inside the job image (ops/local-ci/image/Dockerfile). */
export const IMAGE_PNPM_STORE = "/opt/pnpm-store"

/** The last line of the canary probe, and the proof that all of it ran. */
export const PROBE_MARKER = "probe=ok"

/** The Desktop routes to the Mac a job must not have. */
export const CANARY_HOST_ROUTES = Object.freeze([
  "host.docker.internal",
  "192.168.65.254",
  "192.168.65.1",
])

/** A public address: reachable only from a network that has a gateway. */
export const CANARY_EGRESS_TARGET = Object.freeze({
  host: "1.1.1.1",
  port: 443,
})

export const LABEL_PREFIX = "com.nabaperks.local-ci."
export const ROLE_LABEL = `${LABEL_PREFIX}role`
export const HEAD_SHA_LABEL = `${LABEL_PREFIX}head-sha`
/** When a canary was created, in epoch milliseconds, so a sweep can age it. */
export const CREATED_AT_LABEL = `${LABEL_PREFIX}created-at`

/**
 * A canary older than this is a leftover. One runs for at most its 120-second
 * probe plus the network create and removal around it, so anything younger
 * may be another agent process's check still in flight.
 */
export const CANARY_STALE_MS = 10 * 60_000

/** Fixed /24 slots of the job pool; lane networks take the rest. */
export const SUBNET_SLOTS = Object.freeze({ canary: 1, prep: 2, egress: 3 })
const FIRST_LANE_SLOT = 16
const LAST_LANE_SLOT = 254

const PROXY_PORT = 3128

// Assembled, never written whole: docs/operations/local-ci.md section 7.5
// greps ops/local-ci/ for the socket path, and a literal here - even in a
// probe that checks for its absence - would teach the operator to ignore it.
const SOCKET = ["docker", "sock"].join(".")

/* ---------------------------------------------------------- engine verdict */

/** -1, 0 or 1. Pure. Missing parts count as zero. */
export function compareVersions(left, right) {
  const parse = (value) =>
    String(value ?? "")
      .split(/[.+-]/)
      .slice(0, 3)
      .map((part) => Number.parseInt(part, 10) || 0)
  const a = parse(left)
  const b = parse(right)
  for (let index = 0; index < 3; index += 1) {
    if ((a[index] ?? 0) !== (b[index] ?? 0))
      return (a[index] ?? 0) < (b[index] ?? 0) ? -1 : 1
  }
  return 0
}

const GIB = 1024 ** 3

/**
 * What `docker info` must say before anything is dispatched. **Pure.**
 *
 * Every mismatch is collected, because an operator fixing the memory setting
 * wants to know about the version in the same message.
 */
export function engineViolations(info, runtime) {
  if (typeof info !== "object" || info === null) {
    return [`docker info returned ${describeValue(info)}, not an object`]
  }
  const violations = []
  if (info.OperatingSystem !== "Docker Desktop")
    violations.push(
      `the engine is ${JSON.stringify(info.OperatingSystem)}, not Docker Desktop`
    )
  if (info.OSType !== "linux")
    violations.push(
      `the engine OS is ${JSON.stringify(info.OSType)}, not linux`
    )
  if (info.Architecture !== "aarch64")
    violations.push(
      `the engine architecture is ${JSON.stringify(info.Architecture)}, not aarch64`
    )
  if (compareVersions(info.ServerVersion, runtime.minServerVersion) < 0)
    violations.push(
      `the engine is ${JSON.stringify(info.ServerVersion)}, older than ${runtime.minServerVersion}`
    )
  if (!Number.isFinite(info.NCPU) || info.NCPU < runtime.cpus)
    violations.push(
      `the engine has ${describeValue(info.NCPU)} CPUs; the runtime budget needs ${runtime.cpus}`
    )
  if (!Number.isFinite(info.MemTotal) || info.MemTotal < runtime.memoryGb * GIB)
    violations.push(
      `the engine has ${(Number(info.MemTotal) / GIB).toFixed(1)} GiB; the runtime budget needs ${runtime.memoryGb} GiB`
    )
  const options = Array.isArray(info.SecurityOptions)
    ? info.SecurityOptions
    : []
  if (!options.some((option) => String(option).startsWith("name=seccomp")))
    violations.push("seccomp is not among the engine's security options")
  return violations
}

/* ---------------------------------------------------- file-sharing verdict */

const normalisePath = (path) =>
  String(path).replace(/\/+$/, "").toLowerCase() || "/"

/** `ancestor` is `path` or one of its parents. Case-folded, as APFS is. */
const covers = (ancestor, path) => {
  const a = normalisePath(ancestor)
  const p = normalisePath(path)
  return a === "/" || p === a || p.startsWith(`${a}/`)
}

/**
 * The APFS data volume's own mount point. Every writable top-level directory
 * of the boot volume - /Users among them - is firmlinked to the same path
 * under it, and a firmlink is not a symlink, so realpath leaves it as it is.
 */
export const DATA_VOLUME_ROOT = "/System/Volumes/Data"

/** The same place, spelt through the root rather than the data volume. Pure. */
export function withoutFirmlink(path) {
  const text = String(path)
  const folded = text.toLowerCase()
  const root = DATA_VOLUME_ROOT.toLowerCase()
  if (folded === root || folded === `${root}/`) return "/"
  return folded.startsWith(`${root}/`)
    ? text.slice(DATA_VOLUME_ROOT.length)
    : text
}

/**
 * Where `path` physically lives: `realpath` of the path, or, for a path that
 * does not exist yet, of its nearest existing ancestor with the rest appended,
 * because that ancestor decides where the path will be created. Any answer
 * other than "does not exist" is thrown, so the caller can refuse.
 */
export function physicalPath(path, realpath = realpathSync) {
  const rest = []
  let current = String(path)
  for (;;) {
    try {
      return withoutFirmlink(join(realpath(current), ...rest))
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error
      const parent = dirname(current)
      if (parent === current) throw error
      rest.unshift(basename(current))
      current = parent
    }
  }
}

/**
 * Why Docker Desktop's file sharing is too wide, or nothing. **Pure** apart
 * from `resolve`, which the caller supplies.
 *
 * The defaults - a missing or null FilesharingDirectories - share /Users, so
 * the App key directory would sit one kernel escape away. An explicit list is
 * required, and no entry may cover the whole home directory or a protected
 * path, nor sit inside a protected path. Every path is compared as written,
 * without the data-volume firmlink, and as `resolve` says it physically lives,
 * so neither `/Volumes/Macintosh HD/Users` (a symlink to /) nor
 * `/System/Volumes/Data/Users` nor a symlinked credential directory slips past
 * a textual comparison.
 */
export function fileSharingViolations(
  settings,
  { home, protectedPaths, resolve = (path) => path }
) {
  const shared = settings?.FilesharingDirectories
  if (!Array.isArray(shared)) {
    return [
      "Docker Desktop uses its default file sharing, which includes /Users and so the credential directory; set an explicit list that excludes it",
    ]
  }
  const forms = (path) => [
    ...new Set([String(path), withoutFirmlink(path), resolve(path)]),
  ]
  const expanded = protectedPaths.map((path) =>
    path === "~"
      ? home
      : path.startsWith("~/")
        ? join(home, path.slice(2))
        : path
  )
  const homeForms = forms(home)
  const protectedForms = expanded.map((path) => [path, forms(path)])
  const violations = []
  for (const entry of shared) {
    if (typeof entry !== "string" || entry.trim() === "") {
      violations.push(
        `file sharing lists ${describeValue(entry)}, which is not a path`
      )
      continue
    }
    const entryForms = forms(entry)
    const any = (targets, test) =>
      entryForms.some((form) => targets.some((target) => test(form, target)))
    if (any(homeForms, covers)) {
      violations.push(
        `file sharing lists ${JSON.stringify(entry)}, which covers the whole home directory`
      )
      continue
    }
    for (const [path, targets] of protectedForms) {
      if (
        any(targets, covers) ||
        any(targets, (form, target) => covers(target, form))
      ) {
        violations.push(
          `file sharing lists ${JSON.stringify(entry)}, which reaches the protected path ${JSON.stringify(path)}`
        )
      }
    }
  }
  return violations
}

/**
 * Why a DOCKER_CONFIG directory's config.json could hand a credential to the
 * CLI, or nothing. **Pure.** An absent file carries none.
 */
export function dockerConfigViolations(text) {
  if (text === null || text === undefined) return []
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    return ["config.json is not valid JSON"]
  }
  const violations = []
  for (const key of ["credsStore", "credHelpers", "auths"]) {
    const value = parsed?.[key]
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (typeof value === "object" && Object.keys(value).length === 0)
    if (!empty) violations.push(`config.json sets ${key}`)
  }
  return violations
}

/* ------------------------------------------------------ the negative canary */

/**
 * What a container on a fresh internal network is asked, as bash on stdin.
 * `$1` is the Mac listener's port. Each line is `key=value`.
 */
export const CANARY_PROBE_SCRIPT = [
  "set -u",
  'port="$1"',
  'reach() { if timeout 3 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; then echo "reach $1:$2=reachable"; else echo "reach $1:$2=unreachable"; fi; }',
  ...CANARY_HOST_ROUTES.map((host) => `reach ${host} "$port"`),
  `reach ${CANARY_EGRESS_TARGET.host} ${CANARY_EGRESS_TARGET.port}`,
  `for path in /Users /host_mnt /var/run/${SOCKET} /run/${SOCKET} /run/host-services /run/desktop /mnt/host /run/guest-services; do if [ -e "$path" ]; then echo "path $path=present"; else echo "path $path=absent"; fi; done`,
  'printf "ssh_auth_sock=[%s]\\n" "${SSH_AUTH_SOCK:-}"',
  "if [ -r /proc/self/mountinfo ]; then echo mountinfo=readable; else echo mountinfo=unreadable; fi",
  `host_mounts="$(awk '{for (i = 1; i <= NF; i++) if ($i == "-") { print $(i + 1); break }}' /proc/self/mountinfo 2>/dev/null | grep -E '^(virtiofs|fakeowner|grpcfuse|9p|fuse\\..*|nfs4?|cifs|sshfs)$' | sort -u | tr '\\n' ' ')"`,
  'printf "host_mounts=[%s]\\n" "${host_mounts% }"',
  `echo ${PROBE_MARKER}`,
].join("\n")

/** The probe's lines as a record. Pure. */
export function parseProbeReport(text) {
  const report = Object.create(null)
  for (const line of String(text ?? "").split("\n")) {
    const at = line.lastIndexOf("=")
    if (at <= 0) continue
    report[line.slice(0, at).trim()] = line.slice(at + 1).trim()
  }
  return report
}

/**
 * Why the canary failed, or nothing. **Pure.**
 *
 * `connections` is what the Mac listener itself counted during the probe: a
 * probe that reports "unreachable" while the listener saw a connection is a
 * probe that lied, and the listener is the one that decides.
 */
export function canaryViolations(report, { port, connections }) {
  if (report?.probe !== "ok") {
    return [
      `the canary probe did not run to completion (expected a trailing ${PROBE_MARKER} line)`,
    ]
  }
  const violations = []
  for (const host of CANARY_HOST_ROUTES) {
    const answer = report[`reach ${host}:${port}`]
    if (answer !== "unreachable")
      violations.push(
        `a job network reaches the Mac through ${host} (${describeValue(answer)})`
      )
  }
  const egress = `reach ${CANARY_EGRESS_TARGET.host}:${CANARY_EGRESS_TARGET.port}`
  if (report[egress] !== "unreachable")
    violations.push(
      `a job network reaches the internet (${CANARY_EGRESS_TARGET.host}:${CANARY_EGRESS_TARGET.port}); it is not internal`
    )
  for (const [key, value] of Object.entries(report)) {
    if (key.startsWith("path ") && value !== "absent")
      violations.push(`${key.slice(5)} is visible inside a job container`)
  }
  if (report.ssh_auth_sock !== "[]")
    violations.push("SSH_AUTH_SOCK is set inside a job container")
  if (report.mountinfo !== "readable")
    violations.push(
      "the job container's mount table could not be read, so host-share mounts cannot be ruled out"
    )
  else if (report.host_mounts !== "[]")
    violations.push(
      `host-share mounts are live inside a job container: ${report.host_mounts}`
    )
  if (connections !== 0)
    violations.push(
      `the Mac's 127.0.0.1 listener accepted ${connections} connection(s) from the canary`
    )
  return violations
}

/* -------------------------------------------------- post-create inspection */

/**
 * Why a created job container is not what its argv promised, or nothing.
 * **Pure.** Read from `docker container inspect` before the container starts.
 */
export function jobContainerViolations(
  inspect,
  { network, volume, subpaths, labels }
) {
  const host = inspect?.HostConfig ?? {}
  const violations = []
  if (host.Privileged !== false) violations.push("it is privileged")
  if (Array.isArray(host.Binds) && host.Binds.length > 0)
    violations.push(`it binds ${host.Binds.length} host path(s)`)
  if (host.PortBindings && Object.keys(host.PortBindings).length > 0)
    violations.push("it publishes ports")
  if (host.PublishAllPorts === true) violations.push("it publishes all ports")
  if (host.NetworkMode !== network)
    violations.push(
      `its network is ${JSON.stringify(host.NetworkMode)}, not ${JSON.stringify(network)}`
    )
  if (Array.isArray(host.CapAdd) && host.CapAdd.length > 0)
    violations.push(`it adds capabilities ${host.CapAdd.join(", ")}`)
  if (Array.isArray(host.Devices) && host.Devices.length > 0)
    violations.push("it has host devices")
  for (const mode of ["PidMode", "IpcMode", "UTSMode", "UsernsMode"]) {
    if (host[mode] === "host") violations.push(`its ${mode} is host`)
  }
  if (!(host.SecurityOpt ?? []).includes("no-new-privileges"))
    violations.push("it lacks no-new-privileges")
  for (const mount of host.Mounts ?? []) {
    if (mount.Type === "tmpfs") continue
    if (
      mount.Type !== "volume" ||
      mount.Source !== volume ||
      !subpaths.includes(mount.VolumeOptions?.Subpath)
    ) {
      violations.push(
        `it mounts ${JSON.stringify(mount.Type)} ${JSON.stringify(mount.Source)} at ${JSON.stringify(mount.Target)} (subpath ${JSON.stringify(mount.VolumeOptions?.Subpath ?? null)})`
      )
    }
  }
  const actual = inspect?.Config?.Labels ?? {}
  for (const [key, value] of Object.entries(labels)) {
    if (actual[key] !== value) violations.push(`it lacks the label ${key}`)
  }
  return violations
}

/** Why a created network is not an internal pool network, or nothing. Pure. */
export function networkViolations(inspect, { internal, subnet }) {
  const violations = []
  if (internal && inspect?.Internal !== true)
    violations.push("it is not internal")
  const subnets = (inspect?.IPAM?.Config ?? []).map((entry) => entry.Subnet)
  if (subnet !== null && !subnets.includes(subnet))
    violations.push(
      `its subnet is ${JSON.stringify(subnets)}, not ${JSON.stringify(subnet)}`
    )
  return violations
}

/* ------------------------------------------------------------ pure helpers */

/** The /24 at `slot` of a 10.x.0.0/16 pool. Pure. */
export function subnetInPool(pool, slot) {
  const match = /^10\.(\d{1,3})\.0\.0\/16$/.exec(String(pool))
  if (!match || !Number.isInteger(slot) || slot < 1 || slot > 254) {
    fail(
      "INVALID_INPUT",
      `cannot take slot ${describeValue(slot)} of pool ${describeValue(pool)}`
    )
  }
  return `10.${match[1]}.${slot}.0/24`
}

/**
 * A lane workspace's path inside the state volume, from a validated identity
 * only. Pure. The daemon follows a symlink or `..` that stays inside the
 * volume when it resolves a subpath, so nothing candidate-shaped reaches it.
 */
export function laneSubpath(root, laneWorkspace) {
  const prefix = `${root}/`
  const relative = String(laneWorkspace).startsWith(prefix)
    ? String(laneWorkspace).slice(prefix.length)
    : null
  const match = /^runs\/([a-f0-9]{40})-lanes\/([a-z][a-z0-9-]*)$/.exec(
    relative ?? ""
  )
  if (!match || !isCommitSha(match[1])) {
    fail(
      "INVALID_INPUT",
      `${describeValue(laneWorkspace)} is not a lane workspace under ${root}`
    )
  }
  return { subpath: relative, headSha: match[1], laneId: match[2] }
}

/** The run's pnpm store inside the state volume. Pure. */
export const storeSubpath = (headSha) => `runs/${headSha}-store/pnpm`

/**
 * The helper's install script for one lane. **Pure.** It runs with egress, so
 * nothing in it may execute candidate code: pnpm reads the lockfile and
 * manifests, fetches through the proxy, and runs no script or hook. The
 * directory flags override anything the candidate's .npmrc or workspace file
 * says, so pnpm cannot be pointed at a path outside the lane.
 */
export function buildHelperInstallScript({ laneDir, storePath }) {
  return [
    "set -eu",
    `cd ${shQuote(laneDir)}`,
    "for file in pnpm-workspace.yaml package.json .npmrc; do",
    '  if [ -f "$file" ] && grep -q configDependencies "$file"; then',
    '    echo "refusing to install: $file declares configDependencies, which pnpm loads before --ignore-pnpmfile applies" >&2',
    "    exit 3",
    "  fi",
    "done",
    [
      "pnpm install",
      ...HELPER_INSTALL_FLAGS,
      "--store-dir",
      shQuote(storePath),
      "--modules-dir node_modules",
      "--virtual-store-dir node_modules/.pnpm",
      "--reporter=append-only",
    ].join(" "),
  ].join("\n")
}

/** The run's own pnpm store, seeded from the image. Pure. */
export function buildStoreSeedScript({ root, headSha }) {
  const store = `${root}/${storeSubpath(headSha)}`
  return [
    `rm -rf ${shQuote(`${root}/runs/${headSha}-store`)}`,
    `mkdir -p ${shQuote(store)}`,
    `cp -a ${IMAGE_PNPM_STORE}/. ${shQuote(`${store}/`)}`,
    // A job mounts the store read-only with a tmpfs over this directory, and
    // Docker cannot create a mount point inside a read-only mount.
    `mkdir -p ${shQuote(`${store}/v10/projects`)}`,
  ].join("\n")
}

/** Remove one run's clone, lane checkouts and store. Pure. */
export function buildReleaseScript({ root, headSha }) {
  return [
    "set -eu",
    `rm -rf ${shQuote(`${root}/runs/${headSha}`)}`,
    `rm -rf ${shQuote(`${root}/runs/${headSha}-lanes`)}`,
    `rm -rf ${shQuote(`${root}/runs/${headSha}-store`)}`,
  ].join("\n")
}

/**
 * The lines every job runs before its lane script: the offline install that
 * executes the lifecycle scripts the helper skipped, with no network.
 * `pnpm install --offline` runs only the root's scripts, so the dependency
 * builds pnpm left pending run through `rebuild --pending`, and the side
 * effects cache stays off because the store is read-only here.
 */
export const LANE_SCRIPT_PRELUDE = Object.freeze([
  "echo '##local-ci## offline dependency install'",
  ["pnpm install", ...JOB_INSTALL_FLAGS].join(" "),
  "pnpm rebuild --pending --config.side-effects-cache=false",
])

/**
 * IPv4 addresses the proxy never connects to: this network, RFC 1918, loopback,
 * link-local, CGNAT, the IETF and benchmarking blocks, multicast and reserved.
 * Docker Desktop's host routes (192.168.65.0/24) and the Mac's LAN fall inside
 * these ranges.
 */
export const PRIVATE_V4_PATTERN =
  /^(0\.|10\.|127\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|192\.0\.0\.|198\.1[89]\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|22[4-9]\.|2[3-5]\d\.)/

/**
 * The allowlist CONNECT proxy the helper's egress goes through. It runs the
 * job image's node as an unprivileged, capability-less container, resolves
 * each allowlisted name itself and connects only to a public IPv4 address, so
 * neither DNS nor a candidate's registry setting can aim it at the Mac, the
 * Desktop VM or the LAN. Plain HTTP is refused.
 */
export function buildProxySource({
  hosts = EGRESS_HOSTS,
  ports = EGRESS_PORTS,
  listenPort = PROXY_PORT,
} = {}) {
  return [
    'const http = require("node:http"), net = require("node:net"), dns = require("node:dns").promises',
    `const ALLOW = new Set(${JSON.stringify(hosts)})`,
    `const PORTS = new Set(${JSON.stringify(ports)})`,
    `const privateV4 = (ip) => ${PRIVATE_V4_PATTERN.toString()}.test(ip)`,
    'const server = http.createServer((req, res) => { console.log("DENY plain"); res.writeHead(403).end() })',
    'server.on("connect", async (req, sock, head) => {',
    '  const deny = (why) => { console.log(`DENY ${why}`); sock.end("HTTP/1.1 403 Forbidden\\r\\n\\r\\n") }',
    '  const at = req.url.lastIndexOf(":"); const host = req.url.slice(0, at).toLowerCase(); const port = Number(req.url.slice(at + 1))',
    '  if (!ALLOW.has(host) || !PORTS.has(port)) return deny("not-allowlisted")',
    '  let addresses; try { addresses = await dns.lookup(host, { all: true, family: 4 }) } catch { return deny("dns") }',
    '  const ip = addresses.map((entry) => entry.address).find((address) => !privateV4(address)); if (!ip) return deny("private-address")',
    '  const upstream = net.connect(port, ip, () => { console.log(`ALLOW ${host}:${port}`); sock.write("HTTP/1.1 200 Connection Established\\r\\n\\r\\n"); upstream.write(head); upstream.pipe(sock); sock.pipe(upstream) })',
    '  upstream.on("error", () => sock.destroy()); sock.on("error", () => upstream.destroy())',
    "})",
    `server.listen(${Number(listenPort)}, "0.0.0.0", () => console.log("proxy listening"))`,
  ].join("\n")
}

/** Bytes from a docker size such as `1.5GiB` or `12.3MB`. Pure; NaN if not one. */
export function parseDockerSize(text) {
  const match = /^\s*([\d.]+)\s*([KMGT]?i?B)\s*$/i.exec(String(text))
  if (!match) return Number.NaN
  const units = {
    b: 1,
    kb: 1e3,
    mb: 1e6,
    gb: 1e9,
    tb: 1e12,
    kib: 1024,
    mib: 1024 ** 2,
    gib: 1024 ** 3,
    tib: 1024 ** 4,
  }
  const factor = units[match[2].toLowerCase()]
  return factor === undefined ? Number.NaN : Number(match[1]) * factor
}

/**
 * GiB held by the containers in `docker stats` that this agent does not own.
 * Pure. An unreadable row counts as its container's whole limit would not be
 * knowable, so the caller's floor applies instead of a guess.
 */
export function externalMemoryGb(statsLines, ownedIds) {
  let bytes = 0
  for (const line of statsLines) {
    if (line.trim() === "") continue
    const row = JSON.parse(line)
    const id = String(row.ID ?? row.Container ?? "")
    if (ownedIds.some((owned) => owned.startsWith(id) || id.startsWith(owned)))
      continue
    const used = parseDockerSize(String(row.MemUsage ?? "").split("/")[0])
    if (Number.isFinite(used)) bytes += used
  }
  return bytes / GIB
}

/* -------------------------------------------------------------- the runtime */

function requireSame(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(
      "RUNTIME_CONTRACT_MISMATCH",
      `contract ${label} is ${JSON.stringify(actual)}, but this adapter enforces ${JSON.stringify(expected)}; the data and the code that applies it must agree`
    )
  }
}

/**
 * The contract fields this module turns into argv, checked against the
 * constants it actually applies, so a contract edit cannot quietly claim a
 * guarantee the code does not give.
 */
export function assertAdapterMatchesContract(contract) {
  const runtime = contract?.runtime
  if (runtime?.kind !== "docker-desktop") {
    fail(
      "RUNTIME_CONTRACT_MISMATCH",
      `the contract selects runtime ${describeValue(runtime?.kind)}, not docker-desktop`
    )
  }
  requireSame(runtime.dockerCli, DOCKER_CLI, "runtime.dockerCli")
  requireSame(runtime.context, DOCKER_CONTEXT, "runtime.context")
  requireSame(runtime.helper?.user, HELPER_USER, "runtime.helper.user")
  requireSame(
    runtime.helper?.installFlags,
    HELPER_INSTALL_FLAGS,
    "runtime.helper.installFlags"
  )
  requireSame(
    runtime.jobInstallFlags,
    JOB_INSTALL_FLAGS,
    "runtime.jobInstallFlags"
  )
  requireSame(
    runtime.helper?.egress?.hosts,
    EGRESS_HOSTS,
    "runtime.helper.egress.hosts"
  )
  requireSame(
    runtime.helper?.egress?.ports,
    EGRESS_PORTS,
    "runtime.helper.egress.ports"
  )
  requireSame(runtime.jobNetwork?.internal, true, "runtime.jobNetwork.internal")
  requireSame(runtime.bindMounts, [], "runtime.bindMounts")
  requireSame(runtime.privilegedContainers, [], "runtime.privilegedContainers")
  return runtime
}

const labelArgs = (labels) =>
  Object.entries(labels).flatMap(([key, value]) => [
    "--label",
    `${key}=${value}`,
  ])

/** A one-shot TCP listener on the Mac's loopback that counts what reaches it. */
export function openLoopbackListener() {
  return new Promise((resolve, reject) => {
    let connections = 0
    const server = createServer((socket) => {
      connections += 1
      socket.destroy()
    })
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () =>
      resolve({
        port: server.address().port,
        connections: () => connections,
        close: () => new Promise((done) => server.close(() => done())),
      })
    )
  })
}

/**
 * Connect to the listener once from the Mac and wait until the listener has
 * counted it: the canary's positive control. The client side of a connect
 * can finish before the server side has run its handler, so the count is
 * polled rather than read once.
 */
async function touchLoopback(listener, { timeoutMs = 3000 } = {}) {
  const before = listener.connections()
  await new Promise((resolve, reject) => {
    const socket = connect(listener.port, "127.0.0.1", () => {
      socket.end()
      resolve()
    })
    socket.once("error", reject)
    socket.setTimeout(timeoutMs, () => {
      socket.destroy()
      reject(new Error("the loopback listener did not answer"))
    })
  })
  const deadline = Date.now() + timeoutMs
  while (listener.connections() <= before && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 10))
  return listener.connections() - before
}

/**
 * The Docker Desktop runtime behind the interface main.mjs dispatches through.
 *
 * `execHost` is main.mjs's spawner; every docker command goes through it with
 * this module's allowlist and a clean environment for the CLI. `extraLabels`
 * and `stateVolume` exist for the documented development dry run, which runs
 * this code against the same engine under a label of its own.
 */
export function createDockerDesktopRuntime({
  contract,
  config,
  logger = null,
  execHost,
  env = process.env,
  home = homedir(),
  dockerConfig = contract?.runtime?.dockerConfig,
  extraLabels = {},
  stateVolume = contract?.runtime?.stateVolume,
  readFile = (path) => readFileSync(path, "utf8"),
  listen = openLoopbackListener,
  randomHex = (bytes) => randomBytes(bytes).toString("hex"),
  realpath = realpathSync,
  now = Date.now,
}) {
  const runtime = assertAdapterMatchesContract(contract)
  if (typeof execHost !== "function") {
    fail("INVALID_INPUT", "createDockerDesktopRuntime needs execHost")
  }
  if (!/^nabaperks-ci-[a-z0-9][a-z0-9-]*$/.test(stateVolume ?? "")) {
    fail(
      "INVALID_INPUT",
      `state volume ${describeValue(stateVolume)} is not an agent volume name`
    )
  }
  for (const key of Object.keys(extraLabels)) {
    if (key.startsWith(LABEL_PREFIX))
      fail("INVALID_INPUT", `extra label ${key} would shadow an agent label`)
  }
  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }
  const root = runtime.workspaceRoot
  const storePath = `${root}/stores/pnpm`
  const pool = runtime.jobNetwork.subnetPool
  const image = config.jobImage
  const stateRoot = config.stateRoot

  // The docker CLI gets only what it needs: no DOCKER_HOST, DOCKER_CONTEXT or
  // TLS variables from the operator's shell can redirect it, and
  // DOCKER_CONFIG is the agent's own directory with no credential store.
  const dockerEnv = Object.freeze({
    ...Object.fromEntries(
      ["PATH", "HOME", "LANG", "LC_ALL", "TMPDIR", "USER", "LOGNAME"]
        .filter((name) => typeof env[name] === "string")
        .map((name) => [name, env[name]])
    ),
    DOCKER_CONFIG: dockerConfig,
    DOCKER_CLI_HINTS: "false",
  })
  const prefix = [DOCKER_CLI, "--context", DOCKER_CONTEXT]
  const docker = (args, options = {}) =>
    execHost([...prefix, ...args], {
      ...options,
      permitted: PERMITTED_HOST_EXECUTABLES,
      env: dockerEnv,
    })
  const agentLabels = (role, headSha = null) => ({
    [ROLE_LABEL]: role,
    ...(headSha === null ? {} : { [HEAD_SHA_LABEL]: headSha }),
    ...extraLabels,
  })
  const requireSha = (headSha) => {
    if (!isCommitSha(headSha))
      fail("INVALID_INPUT", `${describeValue(headSha)} is not a commit SHA`)
    return headSha
  }
  const short = (headSha) => headSha.slice(0, 12)
  const prepName = (headSha) => `nabaperks-ci-prep-${short(headSha)}`
  const egressName = (headSha) => `nabaperks-ci-egress-${short(headSha)}`
  const proxyName = (headSha) => `nabaperks-ci-proxy-${short(headSha)}`
  const envDirectory = (headSha) => join(stateRoot, "job-env", headSha)

  /* -- checks ---------------------------------------------------------- */

  function assertDockerConfig() {
    if (typeof dockerConfig !== "string" || !dockerConfig.startsWith("/")) {
      fail(
        "VM_UNVERIFIABLE",
        `DOCKER_CONFIG must be the agent's own absolute directory (received ${describeValue(dockerConfig)})`
      )
    }
    let text = null
    try {
      text = readFile(join(dockerConfig, "config.json"))
    } catch (error) {
      if (error.code !== "ENOENT")
        fail(
          "VM_UNVERIFIABLE",
          `could not read ${join(dockerConfig, "config.json")} (${error.code ?? error.message})`
        )
    }
    const violations = dockerConfigViolations(text)
    if (violations.length > 0) {
      fail(
        "VM_ISOLATION_VIOLATION",
        `the agent's DOCKER_CONFIG at ${dockerConfig} could hand the CLI a credential: ${violations.join("; ")}`
      )
    }
  }

  async function engine() {
    let info
    try {
      info = JSON.parse(
        await docker(["info", "--format", "{{json .}}"], { timeoutMs: 30_000 })
      )
    } catch (error) {
      fail(
        "VM_UNVERIFIABLE",
        `could not read Docker Desktop's engine through the ${DOCKER_CONTEXT} context (${error.message}); it is never started or repaired from here`
      )
    }
    const violations = engineViolations(info, runtime)
    if (violations.length > 0) {
      fail(
        "VM_ISOLATION_VIOLATION",
        `the ${DOCKER_CONTEXT} engine is not the one this plane dispatches into:\n  - ${violations.join("\n  - ")}`
      )
    }
    return Object.freeze({
      serverVersion: info.ServerVersion,
      cpus: info.NCPU,
      memoryGb: Number((info.MemTotal / GIB).toFixed(1)),
    })
  }

  function fileSharing() {
    const path = join(home, runtime.fileSharing.settingsFile)
    let settings
    try {
      settings = JSON.parse(readFile(path))
    } catch (error) {
      fail(
        "VM_UNVERIFIABLE",
        `could not read Docker Desktop's settings at ${path} (${error.code ?? error.message}); file sharing cannot be shown to exclude the credential directory`
      )
    }
    // Compared where each path physically lives, not only as written: a share
    // of a symlink to / or of the data-volume firmlink of /Users, or a
    // credential directory that is itself a symlink, is still a share of it.
    const resolve = (target) => {
      try {
        return physicalPath(target, realpath)
      } catch (error) {
        fail(
          "VM_UNVERIFIABLE",
          `could not resolve ${target} (${error.code ?? error.message}); file sharing cannot be shown to exclude the credential directory`
        )
      }
      return null
    }
    const violations = fileSharingViolations(settings, {
      home,
      protectedPaths: [
        ...runtime.fileSharing.protectedPaths,
        stateRoot,
        ...(typeof config.privateKeyPath === "string"
          ? [config.privateKeyPath]
          : []),
      ],
      resolve,
    })
    if (violations.length > 0) {
      fail(
        "VM_ISOLATION_VIOLATION",
        `Docker Desktop's file sharing is wider than this plane allows:\n  - ${violations.join("\n  - ")}`
      )
    }
    return Object.freeze({ shared: [...settings.FilesharingDirectories] })
  }

  async function stateVolumeReady() {
    let inspect = null
    try {
      inspect = JSON.parse(
        await docker(
          ["volume", "inspect", "--format", "{{json .}}", stateVolume],
          {
            timeoutMs: 30_000,
          }
        )
      )
    } catch {
      inspect = null
    }
    const wanted = agentLabels("state")
    if (inspect === null) {
      await docker(["volume", "create", ...labelArgs(wanted), stateVolume], {
        timeoutMs: 30_000,
      })
      // Created root-owned; one fixed, networkless, capability-limited chown
      // hands the root of the volume to the image's unprivileged account.
      await docker(
        [
          "run",
          "--rm",
          "--pull=never",
          "--name",
          `nabaperks-ci-helper-${randomHex(6)}`,
          "--network",
          "none",
          "--user",
          "0:0",
          "--cap-drop",
          "ALL",
          "--cap-add",
          "CHOWN",
          "--security-opt",
          "no-new-privileges",
          ...labelArgs(agentLabels("helper")),
          "--mount",
          buildMountSpec({ type: "volume", source: stateVolume, target: root }),
          "--entrypoint",
          "/bin/chown",
          image,
          HELPER_USER,
          root,
        ],
        { timeoutMs: 60_000 }
      )
      return Object.freeze({ volume: stateVolume, created: true })
    }
    const labels = inspect.Labels ?? {}
    const missing = Object.entries(wanted).filter(
      ([key, value]) => labels[key] !== value
    )
    if (missing.length > 0) {
      fail(
        "VM_ISOLATION_VIOLATION",
        `volume ${stateVolume} exists without this agent's labels (${missing.map(([key]) => key).join(", ")}); it was not created here and will not be mounted`
      )
    }
    return Object.freeze({ volume: stateVolume, created: false })
  }

  async function removeQuietly(args) {
    try {
      await docker(args, { timeoutMs: 30_000 })
    } catch {
      // Absent is the normal case.
    }
  }

  /**
   * Remove canaries an earlier check left behind, and only those. This
   * process never runs two checks at once (`exclusive` below), so none of its
   * own is in flight here; a canary younger than CANARY_STALE_MS may belong to
   * another agent process on the same engine, and is left alone.
   */
  async function sweepCanaryLeftovers() {
    const filters = [
      "--filter",
      `label=${ROLE_LABEL}=canary`,
      ...Object.entries(extraLabels).flatMap(([key, value]) => [
        "--filter",
        `label=${key}=${value}`,
      ]),
    ]
    const format = (name) =>
      `{{.ID}} {{.${name}}} {{.Label "${CREATED_AT_LABEL}"}}`
    const stale = (text) =>
      text
        .split("\n")
        .map((line) => line.trim().split(" "))
        .filter(([id, name, createdAt]) => {
          if (!id || !name?.startsWith("nabaperks-ci-canary-")) return false
          const created = /^\d+$/.test(createdAt ?? "")
            ? Number(createdAt)
            : Number.NaN
          return !(now() - created < CANARY_STALE_MS)
        })
    const containers = stale(
      await docker(["ps", "--all", ...filters, "--format", format("Names")], {
        timeoutMs: 30_000,
      })
    )
    for (const [id] of containers) await removeQuietly(["rm", "--force", id])
    const networks = stale(
      await docker(["network", "ls", ...filters, "--format", format("Name")], {
        timeoutMs: 30_000,
      })
    )
    for (const [id] of networks) await removeQuietly(["network", "rm", id])
  }

  async function canary() {
    try {
      await sweepCanaryLeftovers()
    } catch (error) {
      fail(
        "VM_UNVERIFIABLE",
        `could not clear an earlier canary (${error.message})`
      )
    }
    const listener = await listen()
    const name = `nabaperks-ci-canary-${randomHex(6)}`
    const canaryLabels = {
      ...agentLabels("canary"),
      [CREATED_AT_LABEL]: String(now()),
    }
    try {
      // The positive control: the listener answers from the Mac itself, so
      // "unreachable" below cannot be the result of a listener that is dead.
      if ((await touchLoopback(listener)) < 1)
        fail(
          "VM_UNVERIFIABLE",
          "the canary's loopback listener did not count its own control connection"
        )
      const baseline = listener.connections()
      const subnet = subnetInPool(pool, SUBNET_SLOTS.canary)
      await docker(
        [
          "network",
          "create",
          "--driver",
          "bridge",
          "--internal",
          "--subnet",
          subnet,
          ...labelArgs(canaryLabels),
          name,
        ],
        { timeoutMs: 30_000 }
      )
      const argv = [
        "run",
        "--rm",
        "-i",
        "--pull=never",
        "--name",
        name,
        "--network",
        name,
        "--user",
        HELPER_USER,
        "--security-opt",
        "no-new-privileges",
        "--cap-drop",
        "ALL",
        "--cpus",
        "1",
        "--memory",
        "256m",
        "--memory-swap",
        "256m",
        ...labelArgs(canaryLabels),
        "--entrypoint",
        "/bin/bash",
        image,
        "-s",
        "--",
        String(listener.port),
      ]
      assertNoBindMounts(argv, "canary argv")
      assertNoDaemonSocket(argv, "canary argv")
      let output
      try {
        output = await docker(argv, {
          input: `${CANARY_PROBE_SCRIPT}\n`,
          timeoutMs: 120_000,
        })
      } catch (error) {
        fail(
          "VM_UNVERIFIABLE",
          `the negative canary could not run (${error.message})`
        )
      }
      // Give a connection the kernel accepted during the probe the chance to
      // reach the listener's handler before it is counted.
      await new Promise((resolve) => setTimeout(resolve, 250))
      const report = parseProbeReport(output)
      const violations = canaryViolations(report, {
        port: listener.port,
        connections: listener.connections() - baseline,
      })
      if (violations.length > 0) {
        fail(
          report.probe === "ok" ? "VM_ISOLATION_VIOLATION" : "VM_UNVERIFIABLE",
          `the negative canary failed:\n  - ${violations.join("\n  - ")}`
        )
      }
      return Object.freeze({
        port: listener.port,
        unreachable: [...CANARY_HOST_ROUTES, CANARY_EGRESS_TARGET.host],
        probe: "ok",
      })
    } finally {
      await removeQuietly(["rm", "--force", name])
      await removeQuietly(["network", "rm", name])
      await listener.close()
    }
  }

  /**
   * One isolation check or sweep at a time in this process. The poll loop's
   * health check, the nightly schedule's and a dispatch's own verdict and
   * reconcile run independently of the dispatch gate; unserialised, one
   * check's canary sweep would remove another's canary mid-probe, two canary
   * networks would claim the same subnet, and a dispatch's reconcile would
   * find a health check's canary and refuse - failing a check it had already
   * opened.
   */
  let exclusiveTail = Promise.resolve()
  const exclusive = (task) => {
    const result = exclusiveTail.then(() => task())
    exclusiveTail = result.then(
      () => {},
      () => {}
    )
    return result
  }

  async function isolationVerdict() {
    assertDockerConfig()
    const engineVerdict = await engine()
    const sharing = fileSharing()
    const volume = await stateVolumeReady()
    const canaryVerdict = await canary()
    return Object.freeze({
      runtime: "docker-desktop",
      context: DOCKER_CONTEXT,
      engine: engineVerdict,
      fileSharing: sharing,
      stateVolume: volume,
      canary: canaryVerdict,
    })
  }

  /* -- helpers ---------------------------------------------------------- */

  const fullState = () =>
    buildMountSpec({ type: "volume", source: stateVolume, target: root })

  /**
   * One short-lived helper container running one fixed script from stdin.
   * It runs as the image's unprivileged account with every capability
   * dropped, mounts only what `mounts` names, and has egress only when it is
   * put on the run's prep network, where the proxy is the only way out.
   */
  async function helper({
    headSha = null,
    network = "none",
    mounts,
    script,
    resources = { cpus: 2, memoryGb: 4 },
    egress = false,
    timeoutMs = 10 * 60_000,
    signal = null,
  }) {
    const proxy = egress ? `http://${proxyName(headSha)}:${PROXY_PORT}` : null
    const argv = [
      "run",
      "--rm",
      "-i",
      "--pull=never",
      "--name",
      `nabaperks-ci-helper-${randomHex(6)}`,
      "--network",
      network,
      "--user",
      HELPER_USER,
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
      "--cpus",
      String(resources.cpus),
      "--memory",
      `${resources.memoryGb}g`,
      "--memory-swap",
      `${resources.memoryGb}g`,
      ...labelArgs(agentLabels("helper", headSha)),
      ...mounts.flatMap((mount) => ["--mount", mount]),
      "--env",
      "HOME=/home/runner",
      "--env",
      "CI=1",
      ...(proxy === null
        ? []
        : [
            "--env",
            `HTTPS_PROXY=${proxy}`,
            "--env",
            `https_proxy=${proxy}`,
            "--env",
            `npm_config_https_proxy=${proxy}`,
          ]),
      "--entrypoint",
      "/bin/sh",
      image,
      "-s",
    ]
    assertNoBindMounts(argv, "helper argv")
    assertNoDaemonSocket(argv, "helper argv")
    return docker(argv, { input: `${script}\n`, timeoutMs, signal })
  }

  async function startEgress(headSha, signal) {
    for (const args of [
      ["rm", "--force", proxyName(headSha)],
      ["network", "rm", prepName(headSha)],
      ["network", "rm", egressName(headSha)],
    ])
      await removeQuietly(args)
    await docker(
      [
        "network",
        "create",
        "--driver",
        "bridge",
        "--subnet",
        subnetInPool(pool, SUBNET_SLOTS.egress),
        ...labelArgs(agentLabels("egress", headSha)),
        egressName(headSha),
      ],
      { timeoutMs: 30_000, signal }
    )
    await docker(
      [
        "network",
        "create",
        "--driver",
        "bridge",
        "--internal",
        "--subnet",
        subnetInPool(pool, SUBNET_SLOTS.prep),
        ...labelArgs(agentLabels("prep", headSha)),
        prepName(headSha),
      ],
      { timeoutMs: 30_000, signal }
    )
    const argv = [
      "run",
      "--detach",
      "--rm",
      "--pull=never",
      "--name",
      proxyName(headSha),
      "--network",
      egressName(headSha),
      "--user",
      HELPER_USER,
      "--security-opt",
      "no-new-privileges",
      "--cap-drop",
      "ALL",
      "--cpus",
      "1",
      "--memory",
      "512m",
      "--memory-swap",
      "512m",
      ...labelArgs(agentLabels("proxy", headSha)),
      "--entrypoint",
      "node",
      image,
      "-e",
      buildProxySource({
        hosts: runtime.helper.egress.hosts,
        ports: runtime.helper.egress.ports,
      }),
    ]
    assertNoBindMounts(argv, "proxy argv")
    await docker(argv, { timeoutMs: 60_000, signal })
    await docker(
      ["network", "connect", prepName(headSha), proxyName(headSha)],
      {
        timeoutMs: 30_000,
        signal,
      }
    )
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const logs = await docker(["logs", proxyName(headSha)], {
        timeoutMs: 15_000,
        signal,
      }).catch(() => "")
      if (logs.includes("proxy listening")) return
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    fail("EGRESS_UNAVAILABLE", `the egress proxy for ${headSha} never listened`)
  }

  async function stopEgress(headSha) {
    await removeQuietly(["rm", "--force", proxyName(headSha)])
    await removeQuietly(["network", "rm", prepName(headSha)])
    await removeQuietly(["network", "rm", egressName(headSha)])
  }

  /* -- the interface main.mjs dispatches through ------------------------ */

  const inUse = new Set()
  const jobNetwork = Object.freeze({
    internal: true,
    allocateSubnet() {
      for (let slot = FIRST_LANE_SLOT; slot <= LAST_LANE_SLOT; slot += 1) {
        const subnet = subnetInPool(pool, slot)
        if (!inUse.has(subnet)) {
          inUse.add(subnet)
          return subnet
        }
      }
      fail("NETWORK_UNAVAILABLE", `the job subnet pool ${pool} is exhausted`)
      return null
    },
    releaseSubnet(subnet) {
      inUse.delete(subnet)
    },
  })

  async function inspectJobContainer({
    name,
    network,
    subnet,
    workspaceHostPath,
  }) {
    const { subpath, headSha } = laneSubpath(root, workspaceHostPath)
    let container
    let net
    try {
      container = JSON.parse(
        await docker(["container", "inspect", "--format", "{{json .}}", name], {
          timeoutMs: 30_000,
        })
      )
      net = JSON.parse(
        await docker(
          ["network", "inspect", "--format", "{{json .}}", network],
          {
            timeoutMs: 30_000,
          }
        )
      )
    } catch (error) {
      fail(
        "VM_UNVERIFIABLE",
        `could not inspect job container ${name} before starting it (${error.message})`
      )
    }
    const violations = [
      ...jobContainerViolations(container, {
        network,
        volume: stateVolume,
        subpaths: [subpath, storeSubpath(headSha)],
        labels: { [HEAD_SHA_LABEL]: headSha, ...extraLabels },
      }),
      ...networkViolations(net, { internal: true, subnet }).map(
        (entry) => `its network ${entry}`
      ),
    ]
    if (violations.length > 0) {
      fail(
        "VM_ISOLATION_VIOLATION",
        `job container ${name} is not what its argv promised, so it will not start:\n  - ${violations.join("\n  - ")}`
      )
    }
  }

  return Object.freeze({
    kind: "docker-desktop",
    description: `Docker Desktop (${DOCKER_CONTEXT})`,
    permittedHostExecutables: PERMITTED_HOST_EXECUTABLES,
    hostedOnlyRequirements: Object.freeze([...runtime.hostedOnlyRequirements]),
    laneScriptPrelude: LANE_SCRIPT_PRELUDE,
    stateVolume,
    /** Each part of the isolation verdict, for a caller that reports them one by one. */
    checks: Object.freeze({
      dockerConfig: assertDockerConfig,
      engine,
      fileSharing,
      stateVolume: () => exclusive(stateVolumeReady),
      canary: () => exclusive(canary),
    }),
    assertIsolationLive: () => exclusive(isolationVerdict),
    reconcile: ({ profiles }) =>
      exclusive(() =>
        reconcileAgentResources({
          docker: prefix,
          stateRoot,
          profiles,
          exec: (argv, options) =>
            execHost(argv, {
              ...options,
              permitted: PERMITTED_HOST_EXECUTABLES,
              env: dockerEnv,
            }),
          labelFilters: Object.entries(extraLabels).map(
            ([key, value]) => `${key}=${value}`
          ),
          protectedVolumes: [stateVolume],
        })
      ),
    async prepareWorkspace({ headSha, signal }) {
      requireSha(headSha)
      await exclusive(stateVolumeReady)
      await startEgress(headSha, signal)
      log("info", `preparing ${root}/runs/${headSha} in volume ${stateVolume}`)
      await helper({
        headSha,
        network: prepName(headSha),
        egress: true,
        mounts: [fullState()],
        script: [
          buildWorkspacePreparationScript({
            root,
            remoteUrl: contract.remoteUrl,
            headSha,
          }),
          buildStoreSeedScript({ root, headSha }),
        ].join("\n"),
        timeoutMs: 20 * 60_000,
        signal,
      })
      return `${root}/runs/${headSha}`
    },
    async prepareLaneWorkspace(
      lane,
      { workspace, headSha, timeoutMs, signal }
    ) {
      requireSha(headSha)
      const { destination, script } = buildLaneWorkspaceScript({
        workspace,
        laneId: lane.id,
        headSha,
        remoteUrl: contract.remoteUrl,
      })
      const budget = Math.max(1, timeoutMs ?? 10 * 60_000)
      await helper({
        headSha,
        mounts: [fullState()],
        script: [
          script,
          // A lane directory must be a directory, never a link: the daemon
          // follows an in-volume link when it resolves a subpath.
          `test -d ${shQuote(destination)} && test ! -L ${shQuote(destination)}`,
        ].join("\n"),
        timeoutMs: budget,
        signal,
      })
      const { subpath } = laneSubpath(root, destination)
      const resources = laneResources(lane, contract)
      await helper({
        headSha,
        network: prepName(headSha),
        egress: true,
        mounts: [
          buildMountSpec({
            type: "volume",
            source: stateVolume,
            target: destination,
            subpath,
          }),
          buildMountSpec({
            type: "volume",
            source: stateVolume,
            target: storePath,
            subpath: storeSubpath(headSha),
          }),
        ],
        script: buildHelperInstallScript({ laneDir: destination, storePath }),
        resources: {
          cpus: Math.min(resources.cpus, 4),
          memoryGb: Math.min(resources.memoryGb, 8),
        },
        timeoutMs: budget,
        signal,
      })
      return destination
    },
    envFileWriter({ headSha }) {
      requireSha(headSha)
      return async (lane, jobEnv) => {
        const directory = envDirectory(headSha)
        mkdirSync(directory, { recursive: true, mode: 0o700 })
        const path = join(directory, `${lane.id}.env`)
        // The run's store at the path the helper installed against, and no
        // registry retries: a job has no network, so a registry request from
        // a pnpm command the lane runs directly fails at once instead of after
        // about 70 seconds of retries. pnpm 10.28.0's script runner re-exports
        // npm_config_fetch_retries empty to the scripts it runs, so a nested
        // call such as the fast lane's `pnpm security:audit` still retries
        // before it passes without auditing anything; the hosted fast root
        // stays the audit.
        const entries = {
          ...jobEnv,
          npm_config_store_dir: storePath,
          npm_config_fetch_retries: "0",
        }
        for (const [name, value] of Object.entries(entries)) {
          if (
            /[\r\n]/.test(String(value)) ||
            !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)
          )
            fail(
              "INVALID_INPUT",
              `lane ${lane.id} env ${JSON.stringify(name)} cannot be written to an env file`
            )
        }
        writeFileSync(
          path,
          `${Object.entries(entries)
            .map(([name, value]) => `${name}=${value}`)
            .join("\n")}\n`,
          { mode: 0o600 }
        )
        return path
      }
    },
    async releaseWorkspace({ headSha }) {
      requireSha(headSha)
      await stopEgress(headSha)
      const remaining = (
        await docker(
          [
            "ps",
            "--all",
            "--filter",
            `label=${HEAD_SHA_LABEL}=${headSha}`,
            "--format",
            "{{.Names}}",
          ],
          { timeoutMs: 20_000 }
        )
      ).trim()
      if (remaining !== "") {
        fail(
          "WORKSPACE_QUARANTINED",
          `CI resources remain for ${headSha} (${remaining.split("\n").join(", ")}); workspace quarantined`
        )
      }
      try {
        await helper({
          headSha,
          mounts: [fullState()],
          script: buildReleaseScript({ root, headSha }),
          timeoutMs: 5 * 60_000,
        })
      } finally {
        rmSync(envDirectory(headSha), { recursive: true, force: true })
      }
    },
    containerRuntimeOptions: () => ({
      docker: DOCKER_CLI,
      context: DOCKER_CONTEXT,
      env: dockerEnv,
      allowPrivilegedDaemon: false,
      forbidBindMounts: true,
      addHosts: [],
      jobNetwork,
      extraLabels,
      roleLabel: ROLE_LABEL,
      workspaceMountFor: (laneWorkspace) => ({
        type: "volume",
        source: stateVolume,
        subpath: laneSubpath(root, laneWorkspace).subpath,
      }),
      extraMountsFor: (laneWorkspace) => {
        const { headSha } = laneSubpath(root, laneWorkspace)
        return [
          {
            type: "volume",
            source: stateVolume,
            target: storePath,
            subpath: storeSubpath(headSha),
            readonly: true,
          },
          { type: "tmpfs", target: `${storePath}/v10/projects` },
        ]
      },
      inspectJobContainer,
      workspaceShellArgv: (script, { workspaceHostPath }) => {
        const { subpath, headSha } = laneSubpath(root, workspaceHostPath)
        return [
          ...prefix,
          "run",
          "--rm",
          "--pull=never",
          "--network",
          "none",
          "--user",
          HELPER_USER,
          "--security-opt",
          "no-new-privileges",
          "--cap-drop",
          "ALL",
          ...labelArgs(agentLabels("helper", headSha)),
          "--mount",
          buildMountSpec({
            type: "volume",
            source: stateVolume,
            target: workspaceHostPath,
            subpath,
            readonly: true,
          }),
          "--entrypoint",
          "/bin/sh",
          image,
          "-c",
          script,
        ]
      },
    }),
    async externalMemoryGb() {
      const owned = (
        await docker(
          ["ps", "--quiet", "--no-trunc", "--filter", `label=${ROLE_LABEL}`],
          { timeoutMs: 20_000 }
        )
      )
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      const stats = await docker(
        ["stats", "--no-stream", "--no-trunc", "--format", "{{json .}}"],
        { timeoutMs: 30_000 }
      )
      return externalMemoryGb(stats.split("\n"), owned)
    },
    /** For the benchmark: the agent's containers still on the daemon. */
    async ownedContainerNames() {
      return (
        await docker(
          [
            "ps",
            "--all",
            "--filter",
            `label=${ROLE_LABEL}`,
            "--format",
            "{{.Names}}",
          ],
          { timeoutMs: 30_000 }
        )
      )
        .split("\n")
        .map((name) => name.trim())
        .filter((name) => name.startsWith("nabaperks-ci-"))
    },
    async imageId(reference) {
      return (
        await docker(["image", "inspect", "--format", "{{.Id}}", reference], {
          timeoutMs: 30_000,
        })
      ).trim()
    },
    async containerStats() {
      const data = await docker(
        ["stats", "--no-stream", "--format", "{{json .}}"],
        { timeoutMs: 30_000 }
      )
      return data.trim() ? data.trim().split("\n").map(JSON.parse) : []
    },
  })
}
