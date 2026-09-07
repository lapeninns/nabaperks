/**
 * The disposable job container.
 *
 * A job container runs code that arrived in a pull request, so the shape of
 * its `docker run` invocation is a security boundary rather than a
 * configuration detail. Two properties are asserted by the builder itself,
 * every time it runs, rather than left to review:
 *
 *   1. **No host daemon socket, in any form.** Bind-mounting the Docker daemon
 *      socket into a container that runs untrusted code is equivalent to
 *      handing that code root on the VM. `assertNoDaemonSocket` walks the
 *      finished argv and refuses if any element names it. The contract's
 *      `container.mountHostDockerSocket` is re-checked at the same point, so a
 *      contract edit alone cannot open the hole either.
 *
 *   2. **The job container is never privileged and publishes no port.** The
 *      lanes that need a Docker daemon get one from a sibling `dind` container
 *      on a job-private network. The job shares only its sidecar's network
 *      namespace, making nested services reachable on loopback. Privilege stays in the
 *      sidecar, which runs no repository code; the job container that does run
 *      repository code stays unprivileged. `docs/operations/local-ci.md` §9
 *      verifies exactly this with `docker inspect`.
 *
 * The argv builders are pure functions returning arrays, separate from the
 * impure `runContainer` that spawns them, because the argv is the part worth
 * pinning in a test: an assertion that the array contains no privilege flag is
 * a proof, while an assertion about a spawned process is a hope.
 *
 * The socket path is assembled from fragments rather than written as a
 * literal. `docs/operations/local-ci.md` §9 audits this plane by grepping
 * `ops/local-ci/` for that path, and a literal here - even inside a refusal -
 * would be a false positive that teaches the operator to ignore the grep.
 */

import { spawn } from "node:child_process"

import { LocalCiError, describeValue } from "../core/contract.mjs"
import { hostSecretNames } from "../core/contract.mjs"
import {
  buildImageCacheLoadArgv,
  IMAGE_CACHE_LOAD_TIMEOUT_MS,
} from "../core/image-cache.mjs"
import {
  PROCESS_TREE_OPTIONS,
  signalProcessTree,
} from "../core/process-tree.mjs"

export class ContainerError extends LocalCiError {}

/** Name prefixes, matching what the runbook's `docker ps --filter` expects. */
export const JOB_CONTAINER_PREFIX = "nabaperks-ci-job-"
export const DAEMON_CONTAINER_PREFIX = "nabaperks-ci-dind-"
export const NETWORK_PREFIX = "nabaperks-ci-net-"

/**
 * Every name this agent creates carries one of these prefixes, and nothing
 * else on the operator's daemon does.
 *
 * The reconciliation below removes resources before it creates them, which is
 * how the agent recovers from being killed mid-lane. That makes "which
 * resources may this agent destroy?" a safety question rather than a naming
 * convention, so the destroying argv builders answer it themselves.
 */
export const OWNED_NAME_PREFIXES = Object.freeze([
  JOB_CONTAINER_PREFIX,
  DAEMON_CONTAINER_PREFIX,
  NETWORK_PREFIX,
])

/**
 * The network alias the sidecar daemon answers on. The job image pins
 * `DOCKER_HOST` to this host name, so the two must agree; changing it here
 * without changing `ops/local-ci/image/Dockerfile` breaks every lane that
 * starts a container.
 */
export const DAEMON_NETWORK_ALIAS = "docker"
export const DAEMON_TCP_PORT = 2375

/** Grace period between SIGTERM and SIGKILL, in seconds. */
export const STOP_GRACE_SECONDS = 30

/**
 * Playwright's Chromium needs more shared memory than Docker's 64 MB default.
 * `--ipc=host` is the other documented remedy and is deliberately not used: it
 * puts the job container in the VM's IPC namespace, which is a wider boundary
 * than this plane should hand to unreviewed code for a memory tuning problem.
 */
export const DEFAULT_SHM_SIZE = "2g"

const SOCKET_BASENAME = ["docker", "sock"].join(".")
const SOCKET_FRAGMENTS = Object.freeze([
  SOCKET_BASENAME,
  `/var/run/${SOCKET_BASENAME}`,
  `/run/${SOCKET_BASENAME}`,
  ["docker", "socket"].join("."),
])

/** Argument forms that publish a container port to the VM. */
const PUBLISH_FLAGS = Object.freeze(["-p", "--publish", "-P", "--publish-all"])

/**
 * Flags that put a container in one of the VM's own namespaces when their
 * value is `host`. Checked in both spellings docker accepts - `--network=host`
 * and `--network host` - because the builders in this file emit the
 * space-separated form for every flag they set, so that is the form a future
 * edit is most likely to introduce.
 */
const NAMESPACE_FLAGS = Object.freeze([
  "--network",
  "--net",
  "--pid",
  "--ipc",
  "--uts",
  "--userns",
  "--cgroupns",
])

/** The flag that hands a container every capability on the VM. */
const PRIVILEGED_FLAG = "--privileged"

function fail(code, message) {
  throw new ContainerError(code, `local-ci container: ${message}`)
}

function requireObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(
      "INVALID_INPUT",
      `${label} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(
      "INVALID_INPUT",
      `${label} must be a non-empty string (received ${describeValue(value)})`
    )
  }
  return value
}

/** True for a docker resource name one of this module's builders produced. */
export function isAgentOwnedName(name) {
  return (
    typeof name === "string" &&
    OWNED_NAME_PREFIXES.some((prefix) => name.startsWith(prefix))
  )
}

/**
 * Refuse a name this agent did not create.
 *
 * Applied to the builders that create and destroy, not to the ones that run a
 * container: the VM's daemon is shared with whatever else the operator keeps
 * there, and `docker rm --force` against a name that arrived from outside this
 * module is the one mistake in this file that would be felt off the plane.
 */
function requireOwnedName(name, label) {
  requireNonEmptyString(name, label)
  if (!isAgentOwnedName(name)) {
    fail(
      "FOREIGN_RESOURCE",
      `${label} is ${JSON.stringify(name)}, which carries none of this agent's prefixes (${OWNED_NAME_PREFIXES.join(", ")}); this plane creates and destroys only the resources it named itself`
    )
  }
  return name
}

/**
 * Quote one value for POSIX `sh`.
 *
 * Only the workspace read below assembles a script rather than an argv, and
 * the path it interpolates ends in a name a profile declared, so the quoting
 * is the seam that keeps a declared file name from becoming a command.
 */
function shQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

/**
 * Refuse an argv that names the host Docker daemon socket anywhere.
 *
 * Applied to every builder's output, including the sidecar's: the sidecar runs
 * its own daemon and has no more business seeing the VM's socket than the job
 * does. Pure, and exported so a caller that assembles its own argv can run the
 * same proof.
 */
export function assertNoDaemonSocket(argv, label = "argv") {
  if (!Array.isArray(argv)) {
    fail(
      "INVALID_INPUT",
      `${label} must be an array of arguments (received ${describeValue(argv)})`
    )
  }
  for (const [index, argument] of argv.entries()) {
    if (typeof argument !== "string") {
      fail(
        "INVALID_INPUT",
        `${label}[${index}] must be a string (received ${describeValue(argument)})`
      )
    }
    for (const fragment of SOCKET_FRAGMENTS) {
      if (argument.includes(fragment)) {
        fail(
          "HOST_DOCKER_SOCKET_MOUNTED",
          `${label}[${index}] names the host Docker daemon socket; mounting it into a container that runs repository code is equivalent to giving that code root on the VM`
        )
      }
    }
  }
  return argv
}

function assertNoPublishedPorts(argv, label) {
  for (const argument of argv) {
    const flag = argument.split("=", 1)[0]
    if (PUBLISH_FLAGS.includes(flag)) {
      fail(
        "PUBLISHED_PORT",
        `${label} publishes a container port (${argument}); job containers reach each other over a private network and publish nothing to the VM`
      )
    }
  }
  return argv
}

function assertUnprivileged(argv, label) {
  for (const [index, argument] of argv.entries()) {
    const separator = argument.indexOf("=")
    const flag = separator === -1 ? argument : argument.slice(0, separator)
    if (flag === PRIVILEGED_FLAG) {
      fail(
        "PRIVILEGED_JOB_CONTAINER",
        `${label} carries ${JSON.stringify(argument)}; the container that runs repository code is never privileged - the sidecar daemon holds that privilege instead`
      )
    }
    if (!NAMESPACE_FLAGS.includes(flag)) continue
    // `--network=host` and `--network host` are the same instruction to
    // docker. Reading the next element is what makes the second form - the one
    // every builder here would produce - visible to this proof.
    const value =
      separator === -1 ? argv[index + 1] : argument.slice(separator + 1)
    if (value === "host") {
      fail(
        "PRIVILEGED_JOB_CONTAINER",
        `${label} puts the container in the VM's own namespace (${JSON.stringify(flag)} ${JSON.stringify(value)}); a container that runs repository code never shares a host namespace`
      )
    }
  }
  return argv
}

function containerConfig(contract) {
  requireObject(contract, "contract")
  const container = requireObject(contract.container, "contract.container")
  if (container.mountHostDockerSocket !== false) {
    fail(
      "HOST_DOCKER_SOCKET_MOUNTED",
      "contract.container.mountHostDockerSocket must be false before any container argv can be built"
    )
  }
  return container
}

/** Reject malformed or overcommitted budgets before either container starts. */
export function assertResourceBudgets(contract) {
  const container = containerConfig(contract)
  const daemon = requireObject(container.daemon, "contract.container.daemon")
  const vm = requireObject(contract.vm, "contract.vm")
  const budgets = {
    "container.cpus": container.cpus,
    "container.memoryGb": container.memoryGb,
    "container.daemon.cpus": daemon.cpus,
    "container.daemon.memoryGb": daemon.memoryGb,
    "vm.cpus": vm.cpus,
    "vm.memoryGb": vm.memoryGb,
    "vm.reserveCpus": vm.reserveCpus,
    "vm.reserveMemoryGb": vm.reserveMemoryGb,
  }
  for (const [label, value] of Object.entries(budgets)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
      fail(
        "INVALID_RESOURCE_BUDGET",
        `${label} must be a positive finite number`
      )
    }
  }
  if (
    container.cpus + daemon.cpus + vm.reserveCpus > vm.cpus ||
    container.memoryGb + daemon.memoryGb + vm.reserveMemoryGb > vm.memoryGb
  ) {
    fail(
      "RESOURCE_OVERCOMMIT",
      "job and daemon budgets must leave the declared VM CPU and memory reserves"
    )
  }
  return Object.freeze({ container, daemon })
}

/** The container wall-clock ceiling in milliseconds. Pure. */
export function containerTimeoutMs(contract) {
  const container = containerConfig(contract)
  const minutes = container.timeoutMinutes
  if (
    typeof minutes !== "number" ||
    !Number.isFinite(minutes) ||
    minutes <= 0
  ) {
    fail(
      "INVALID_CONTRACT",
      `contract.container.timeoutMinutes must be a positive finite number (received ${describeValue(minutes)})`
    )
  }
  return Math.round(minutes * 60_000)
}

function shortSha(headSha) {
  return requireNonEmptyString(headSha, "headSha").toLowerCase().slice(0, 12)
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/** Deterministic job container name. Pure. */
export function jobContainerName({ headSha, laneId, attempt = 1 }) {
  return `${JOB_CONTAINER_PREFIX}${shortSha(headSha)}-${slug(requireNonEmptyString(laneId, "laneId"))}-${attempt}`
}

/** Deterministic sidecar daemon container name. Pure. */
export function daemonContainerName({ headSha, laneId, attempt = 1 }) {
  return `${DAEMON_CONTAINER_PREFIX}${shortSha(headSha)}-${slug(requireNonEmptyString(laneId, "laneId"))}-${attempt}`
}

/** Deterministic job-private network name. Pure. */
export function networkName({ headSha, laneId, attempt = 1 }) {
  return `${NETWORK_PREFIX}${shortSha(headSha)}-${slug(requireNonEmptyString(laneId, "laneId"))}-${attempt}`
}

/**
 * Prefix that runs any command inside the Lima VM, or nothing when there is no
 * VM to enter. Pure.
 */
function vmPrefix({ vm = null, limactl = "limactl" } = {}) {
  if (vm === null || vm === undefined || vm === "") return []
  return [limactl, "shell", requireNonEmptyString(vm, "vm"), "--"]
}

/**
 * Prefix that runs a docker command inside the Lima VM.
 *
 * The Mac never talks to a Docker daemon directly: the engine lives in the VM,
 * and the VM has no mounts back to the Mac. Pure.
 */
export function dockerPrefix({
  vm = null,
  docker = "docker",
  limactl = "limactl",
} = {}) {
  return [...vmPrefix({ vm, limactl }), docker]
}

/** `docker network create --driver <driver> --label … <name>`. Pure. */
export function buildNetworkCreateArgv({
  name,
  vm = null,
  docker,
  limactl,
  driver = "bridge",
  labels = {},
} = {}) {
  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "network",
    "create",
    "--driver",
    driver,
  ]
  // Labelled for the same reason the containers are: the runbook's sweep has
  // to be able to name what this plane left behind without matching on a
  // prefix that a human could also have typed.
  for (const [key, value] of Object.entries(labels)) {
    argv.push("--label", `${key}=${value}`)
  }
  argv.push(requireOwnedName(name, "name"))
  return Object.freeze(assertNoDaemonSocket(argv, "network create argv"))
}

/** `docker network rm <name>`. Pure. */
export function buildNetworkRemoveArgv({
  name,
  vm = null,
  docker,
  limactl,
} = {}) {
  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "network",
    "rm",
    requireOwnedName(name, "name"),
  ]
  return Object.freeze(assertNoDaemonSocket(argv, "network rm argv"))
}

/** `docker stop --timeout <n> <name>`. Pure. */
export function buildStopArgv({
  name,
  vm = null,
  docker,
  limactl,
  timeoutSeconds = STOP_GRACE_SECONDS,
} = {}) {
  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "stop",
    "--timeout",
    String(timeoutSeconds),
    requireOwnedName(name, "name"),
  ]
  return Object.freeze(assertNoDaemonSocket(argv, "stop argv"))
}

/** `docker rm --force --volumes <name>`. Pure. */
export function buildRemoveArgv({ name, vm = null, docker, limactl } = {}) {
  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "rm",
    "--force",
    "--volumes",
    requireOwnedName(name, "name"),
  ]
  return Object.freeze(assertNoDaemonSocket(argv, "rm argv"))
}

/** `docker inspect --format <fmt> <name>`, for the runbook's own proof. Pure. */
export function buildInspectArgv({
  name,
  vm = null,
  docker,
  limactl,
  format = "{{json .HostConfig}}",
} = {}) {
  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "inspect",
    "--format",
    format,
    requireNonEmptyString(name, "name"),
  ]
  return Object.freeze(assertNoDaemonSocket(argv, "inspect argv"))
}

/* ------------------------------------------------- reading back a job's log */

/** Exit status the read script uses for "the declared file is not there". */
export const READ_ABSENT_STATUS = 3

/** Exit status for "something is at that path, but not a regular file". */
export const READ_NOT_A_FILE_STATUS = 4

/**
 * Ceiling on one log part read back out of the workspace. A background service
 * that logged a gigabyte does not get to exhaust the agent's heap on its way
 * into the evidence directory; the read is truncated and says so.
 */
export const MAX_LOG_PART_BYTES = 4 * 1024 * 1024

/**
 * Read one file out of a run's workspace **inside the VM**. Pure: returns the
 * argv.
 *
 * A lane's background service writes its log into the bind-mounted workspace,
 * which lives in the VM and is deleted with the worktree once the run ends. The
 * evidence directory is on the Mac, so the bytes have to be carried across that
 * boundary before the workspace is released, and this module is where the VM
 * boundary is already crossed.
 *
 * The script refuses a symlink rather than following it. The file it reads was
 * created by repository code running in the job container, and that code shares
 * the workspace with the lane's own `.env` file: following a link would let a
 * pull request choose what gets copied to the Mac and published as evidence.
 */
export function buildWorkspaceReadArgv({
  workspaceHostPath,
  name,
  vm = null,
  limactl,
  shell = "/bin/sh",
  maxBytes = MAX_LOG_PART_BYTES,
} = {}) {
  requireNonEmptyString(workspaceHostPath, "workspaceHostPath")
  requireNonEmptyString(name, "name")
  if (name.includes("/") || name.split("/").includes("..")) {
    fail(
      "INVALID_INPUT",
      `log part name ${JSON.stringify(name)} must be a single file name inside the workspace, with no path separator`
    )
  }
  if (!Number.isInteger(maxBytes) || maxBytes <= 0) {
    fail(
      "INVALID_INPUT",
      `maxBytes must be a positive integer (received ${describeValue(maxBytes)})`
    )
  }
  const path = `${workspaceHostPath}/${name}`
  const script = [
    "set -eu",
    `part=${shQuote(path)}`,
    `if [ -L "$part" ]; then exit ${READ_NOT_A_FILE_STATUS}; fi`,
    `if [ ! -e "$part" ]; then exit ${READ_ABSENT_STATUS}; fi`,
    `if [ ! -f "$part" ]; then exit ${READ_NOT_A_FILE_STATUS}; fi`,
    `head -c ${maxBytes} -- "$part"`,
  ].join("\n")
  const argv = [
    ...vmPrefix({ vm, limactl }),
    requireNonEmptyString(shell, "shell"),
    "-c",
    script,
  ]
  return Object.freeze(assertNoDaemonSocket(argv, "workspace read argv"))
}

function assertPinnedImage(image, label) {
  requireNonEmptyString(image, label)
  // The tag lives on the last path segment. Splitting the whole reference on
  // ":" reads the registry port of `registry.example:5000/nabaperks-ci` as a
  // tag and lets an untagged image through.
  const lastSegment = image.split("/").at(-1)
  const tag = lastSegment.includes(":") ? lastSegment.split(":").at(-1) : null
  if (
    !image.includes("@") &&
    (tag === null || tag === "" || tag === "latest")
  ) {
    fail(
      "UNPINNED_IMAGE",
      `${label} is ${JSON.stringify(image)}; every image this plane runs must be pinned to an explicit tag or digest, because "latest" makes the run unreproducible and lets a registry change what executes`
    )
  }
  return image
}

/**
 * The sidecar Docker daemon.
 *
 * This is the container that carries `--privileged`, and it is the only one.
 * It runs the upstream `dind` image and no repository code: the lanes that
 * need a daemon (`supabase start`) talk to it over TCP on the job-private
 * network. `DOCKER_TLS_CERTDIR` is emptied so the daemon listens on plain TCP,
 * which is safe precisely because the network is private to this one job and
 * no port is published.
 *
 * Pure: returns the argv array.
 */
export function buildDaemonArgv({
  contract,
  name,
  network,
  image,
  vm = null,
  docker,
  limactl,
  labels = {},
} = {}) {
  const { container, daemon } = assertResourceBudgets(contract)
  if (container.dockerInDocker !== true) {
    fail(
      "DIND_DISABLED",
      "contract.container.dockerInDocker is not true; a lane that needs a Docker daemon has no daemon to talk to, and the answer is never to hand it the VM's"
    )
  }
  assertPinnedImage(image, "daemon image")

  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "run",
    "--detach",
    "--rm",
    "--name",
    requireNonEmptyString(name, "name"),
    "--network",
    requireNonEmptyString(network, "network"),
    "--network-alias",
    DAEMON_NETWORK_ALIAS,
    // The privilege that a nested daemon genuinely requires, held by the one
    // container in this design that executes nothing from the repository.
    "--privileged",
    "--cpus",
    String(daemon.cpus),
    "--memory",
    `${daemon.memoryGb}g`,
    "--memory-swap",
    `${daemon.memoryGb}g`,
    "--pull=never",
    "--stop-timeout",
    String(STOP_GRACE_SECONDS),
    "--env",
    "DOCKER_TLS_CERTDIR=",
    "--env",
    `DOCKER_HOST=tcp://0.0.0.0:${DAEMON_TCP_PORT}`,
  ]
  for (const [key, value] of Object.entries(labels)) {
    argv.push("--label", `${key}=${value}`)
  }
  argv.push(image, "--host", `tcp://0.0.0.0:${DAEMON_TCP_PORT}`, "--tls=false")

  assertNoDaemonSocket(argv, "daemon argv")
  assertNoPublishedPorts(argv, "daemon argv")
  return Object.freeze(argv)
}

/**
 * The argv for one lane's disposable job container. **Pure.**
 *
 * `env` is the already-built job environment from core/job-env.mjs. Values are
 * passed with `--env NAME=VALUE` only when `envFile` is absent; the runtime
 * always supplies `envFile`, because an argument is visible to every process
 * on the VM through `ps` and a file at mode 0600 is not.
 *
 * Returns a frozen array whose first element is the executable, so a caller
 * spawns `argv[0]` with `argv.slice(1)` and the pure function fully determines
 * what runs.
 */
export function buildContainerArgv({
  contract,
  daemonName = null,
  image,
  name,
  network,
  command,
  workspaceHostPath,
  env = {},
  envFile = null,
  vm = null,
  docker,
  limactl,
  labels = {},
  addHosts = ["host.docker.internal:host-gateway"],
  shmSize = DEFAULT_SHM_SIZE,
  timeoutSeconds = null,
} = {}) {
  const { container } = assertResourceBudgets(contract)
  assertPinnedImage(image, "job image")
  requireObject(env, "env")

  if (daemonName !== null) {
    requireOwnedName(daemonName, "daemonName")
    if (!daemonName.startsWith(DAEMON_CONTAINER_PREFIX)) {
      fail(
        "FOREIGN_RESOURCE",
        "daemonName must identify an agent-owned sidecar"
      )
    }
  }
  const workspacePath = requireNonEmptyString(
    container.workspacePath,
    "contract.container.workspacePath"
  )
  const seconds =
    timeoutSeconds === null
      ? Math.round(containerTimeoutMs(contract) / 1000)
      : timeoutSeconds
  if (!Number.isInteger(seconds) || seconds <= 0) {
    fail(
      "INVALID_INPUT",
      `timeoutSeconds must be a positive integer (received ${describeValue(seconds)})`
    )
  }

  const denied = new Set(hostSecretNames(contract))
  for (const key of Object.keys(env)) {
    if (denied.has(key)) {
      fail(
        "HOST_SECRET_LEAKED",
        `the job environment carries ${JSON.stringify(key)}, which contract.hostSecrets forbids from entering a container`
      )
    }
  }

  const argv = [
    ...dockerPrefix({ vm, docker, limactl }),
    "run",
    "--rm",
    // PID 1 that reaps. Lanes background a dev server and a browser; without
    // an init the container accumulates zombies for the whole run.
    "--init",
    "--name",
    requireNonEmptyString(name, "name"),
    "--network",
    daemonName === null
      ? requireNonEmptyString(network, "network")
      : `container:${daemonName}`,
    "--pull=never",
    "--cpus",
    String(container.cpus),
    "--memory",
    `${container.memoryGb}g`,
    // Equal to --memory, which disables swap for the container: a lane that
    // exceeds its budget must fail fast rather than swap the VM to a halt.
    "--memory-swap",
    `${container.memoryGb}g`,
    "--shm-size",
    requireNonEmptyString(shmSize, "shmSize"),
    "--stop-timeout",
    String(STOP_GRACE_SECONDS),
    "--security-opt",
    "no-new-privileges",
    "--workdir",
    workspacePath,
    "--volume",
    `${requireNonEmptyString(workspaceHostPath, "workspaceHostPath")}:${workspacePath}`,
    "--env",
    `DOCKER_HOST=tcp://${daemonName === null ? DAEMON_NETWORK_ALIAS : "127.0.0.1"}:${DAEMON_TCP_PORT}`,
  ]

  if (container.readOnlyRootFilesystem === true) {
    argv.push("--read-only")
  }
  for (const entry of daemonName === null ? addHosts : []) {
    argv.push("--add-host", requireNonEmptyString(entry, "addHosts entry"))
  }
  for (const [key, value] of Object.entries(labels)) {
    argv.push("--label", `${key}=${value}`)
  }
  if (envFile !== null) {
    argv.push("--env-file", requireNonEmptyString(envFile, "envFile"))
  } else {
    for (const [key, value] of Object.entries(env)) {
      argv.push("--env", `${key}=${value}`)
    }
  }

  argv.push(image)

  // The wall-clock ceiling, inside the container as well as on the host. The
  // host-side kill in `runContainer` is the backstop; this is the one that
  // still applies when the agent process itself has gone away.
  argv.push(
    "timeout",
    "--signal=TERM",
    `--kill-after=${STOP_GRACE_SECONDS}s`,
    `${seconds}s`
  )

  const inner = Array.isArray(command)
    ? command
    : ["bash", "-lc", String(command)]
  for (const [index, part] of inner.entries()) {
    requireNonEmptyString(part, `command[${index}]`)
    argv.push(part)
  }

  // The three proofs, over the finished array rather than over the inputs.
  assertNoDaemonSocket(argv, "job container argv")
  assertNoPublishedPorts(argv, "job container argv")
  assertUnprivileged(argv, "job container argv")
  return Object.freeze(argv)
}

/**
 * Spawn an argv and collect its output. **Impure.**
 *
 * Enforces the wall clock on the host as well: the in-container `timeout`
 * cannot help if the daemon itself wedges, so this escalates SIGTERM then
 * SIGKILL and reports `timedOut: true`.
 *
 * `onOutput` receives every chunk as it arrives, so the caller can stream to a
 * log file without buffering an hour of Playwright output in memory.
 */
export async function runContainer(
  argv,
  {
    timeoutMs = null,
    onOutput = null,
    onTerminate = null,
    signal = null,
    spawnFn = spawn,
    maxBufferBytes = 8 * 1024 * 1024,
  } = {}
) {
  if (!Array.isArray(argv) || argv.length === 0) {
    fail(
      "INVALID_INPUT",
      `runContainer requires a non-empty argv array (received ${describeValue(argv)})`
    )
  }
  assertNoDaemonSocket(argv, "runContainer argv")

  if (signal?.aborted) {
    return Object.freeze({
      exitCode: null,
      signal: null,
      timedOut: false,
      cancelled: true,
      truncated: false,
      output: "",
      durationMs: 0,
    })
  }
  const [executable, ...args] = argv
  const started = Date.now()
  const child = spawnFn(executable, args, {
    ...PROCESS_TREE_OPTIONS,
    stdio: ["ignore", "pipe", "pipe"],
  })

  let buffered = ""
  let bufferedBytes = 0
  let truncated = false
  const collect = (stream, chunk) => {
    const text = chunk.toString("utf8")
    if (onOutput) onOutput(text, stream)
    if (bufferedBytes >= maxBufferBytes) {
      truncated = true
      return
    }
    buffered += text
    bufferedBytes += Buffer.byteLength(text, "utf8")
  }
  child.stdout?.on("data", (chunk) => collect("stdout", chunk))
  child.stderr?.on("data", (chunk) => collect("stderr", chunk))

  let timedOut = false
  let cancelled = false
  let killTimer = null
  let escalationTimer = null

  const terminate = () => {
    if (escalationTimer) return
    // SSH multiplexing can retain a remote channel after the local client
    // dies. The lifecycle owner must stop the remote container as well.
    onTerminate?.()
    signalProcessTree(child, "SIGTERM")
    escalationTimer = setTimeout(() => {
      signalProcessTree(child, "SIGKILL")
    }, STOP_GRACE_SECONDS * 1000)
    escalationTimer.unref?.()
  }

  if (typeof timeoutMs === "number" && timeoutMs > 0) {
    killTimer = setTimeout(() => {
      timedOut = true
      terminate()
    }, timeoutMs)
    killTimer.unref?.()
  }
  const onAbort = () => {
    cancelled = true
    terminate()
  }
  signal?.addEventListener?.("abort", onAbort, { once: true })

  try {
    const { code, signalName } = await new Promise((resolve, reject) => {
      child.once("error", reject)
      child.once("close", (exitCode, closeSignal) =>
        resolve({ code: exitCode, signalName: closeSignal })
      )
    })
    return Object.freeze({
      exitCode: code,
      signal: signalName,
      timedOut,
      cancelled,
      truncated,
      output: buffered,
      durationMs: Date.now() - started,
    })
  } catch (error) {
    throw new ContainerError(
      "SPAWN_FAILED",
      `local-ci container: could not execute ${JSON.stringify(executable)}: ${error.message}`
    )
  } finally {
    if (killTimer) clearTimeout(killTimer)
    if (escalationTimer) clearTimeout(escalationTimer)
    signal?.removeEventListener?.("abort", onAbort)
  }
}

/**
 * A small lifecycle wrapper: reconcile whatever a previous run left behind,
 * create the job-private network, start the sidecar daemon, run the job
 * container, then tear all three down whether the job passed, failed, timed out
 * or threw. **Impure.**
 *
 * Teardown is unconditional and its failures are reported rather than thrown:
 * a leaked container is an operational problem, but losing the lane's real
 * result to a teardown error would be worse.
 *
 * The reconciliation is what makes that teardown survivable. Kill the agent -
 * or the VM - between the create and the finally, and the detached sidecar and
 * the named network outlive the process that owned them. The names are
 * deterministic in the head SHA and the lane, so the next attempt at the same
 * lane collides with its own leftovers, and launchd would restart into the same
 * collision forever. Removing this attempt's three names before creating them
 * turns that into a self-healing restart. It removes only those three names,
 * every one of which carries a prefix this module owns.
 */
export function createContainerRuntime({
  contract,
  vm = null,
  docker = "docker",
  limactl = "limactl",
  spawnFn = spawn,
  logger = null,
  imageCachePin = null,
} = {}) {
  assertResourceBudgets(contract)
  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }
  const exec = (argv, options = {}) =>
    runContainer(argv, { spawnFn, ...options })

  return Object.freeze({
    async withJobContainer({
      headSha,
      laneId,
      attempt = 1,
      image,
      daemonImage,
      command,
      workspaceHostPath,
      env,
      envFile,
      labels = {},
      timeoutMs = null,
      onOutput = null,
      signal = null,
      needsDaemon = false,
    }) {
      signal?.throwIfAborted()
      const identity = { headSha, laneId, attempt }
      const net = networkName(identity)
      const jobName = jobContainerName(identity)
      const daemonName = daemonContainerName(identity)
      const teardownErrors = []

      const quietly = async (argv, label) => {
        try {
          await exec(argv, { timeoutMs: 15_000 })
        } catch (error) {
          teardownErrors.push(`${label}: ${error.message}`)
        }
      }

      // Nothing is reported when these find nothing: on a healthy run they all
      // exit non-zero because the resource is absent, which is the normal case
      // and not a fact worth putting in front of an operator.
      const reconcile = async (argv) => {
        try {
          await exec(argv, { timeoutMs: 30_000, signal })
          signal?.throwIfAborted()
        } catch {
          signal?.throwIfAborted()
          // A reconciliation that cannot run is not itself a failure; the
          // create below is what decides whether this lane can start.
        }
      }
      await reconcile(buildRemoveArgv({ name: jobName, vm, docker, limactl }))
      await reconcile(
        buildRemoveArgv({ name: daemonName, vm, docker, limactl })
      )
      await reconcile(
        buildNetworkRemoveArgv({ name: net, vm, docker, limactl })
      )

      try {
        signal?.throwIfAborted()
        const created = await exec(
          buildNetworkCreateArgv({
            name: net,
            vm,
            docker,
            limactl,
            labels,
          }),
          { timeoutMs: 30_000, signal }
        )
        signal?.throwIfAborted()
        // Checked rather than assumed. An ignored non-zero exit here surfaces
        // three commands later as a `docker run` that cannot find its network,
        // and the lane's evidence would blame the lane.
        if (created.exitCode !== 0) {
          fail(
            "NETWORK_UNAVAILABLE",
            `could not create the job-private network ${JSON.stringify(net)} for lane ${JSON.stringify(laneId)} (docker exited ${created.exitCode}): ${created.output.trim() || "no output"}`
          )
        }
        if (needsDaemon) {
          const started = await exec(
            buildDaemonArgv({
              contract,
              name: daemonName,
              network: net,
              image: daemonImage,
              vm,
              docker,
              limactl,
              labels,
            }),
            { timeoutMs: 30_000, signal }
          )
          if (started.exitCode !== 0) {
            fail(
              "DAEMON_UNAVAILABLE",
              `could not start the sidecar daemon for lane ${JSON.stringify(laneId)} (docker exited ${started.exitCode}): ${started.output.trim() || "no output"}`
            )
          }
          const ready = await exec(
            [
              ...dockerPrefix({ vm, docker, limactl }),
              "exec",
              daemonName,
              "sh",
              "-c",
              'i=0; until docker info >/dev/null 2>&1; do i=$((i + 1)); if [ "$i" -ge 25 ]; then docker info; exit 1; fi; sleep 1; done',
            ],
            { timeoutMs: 30_000, signal }
          )
          if (ready.exitCode !== 0) {
            fail(
              "DAEMON_UNAVAILABLE",
              `the sidecar daemon for lane ${JSON.stringify(laneId)} did not become ready: ${ready.output.trim() || "no output"}`
            )
          }
          if (imageCachePin !== null) {
            const loadStartedAt = Date.now()
            log("info", `loading verified Supabase image archive for ${laneId}`)
            const loaded = await exec(
              buildImageCacheLoadArgv({
                pin: imageCachePin,
                vm,
                daemonName,
                docker,
                limactl,
              }),
              {
                timeoutMs: Math.min(
                  timeoutMs ?? IMAGE_CACHE_LOAD_TIMEOUT_MS,
                  IMAGE_CACHE_LOAD_TIMEOUT_MS
                ),
                signal,
              }
            )
            signal?.throwIfAborted()
            if (loaded.exitCode !== 0 || loaded.timedOut || loaded.cancelled) {
              fail(
                "IMAGE_CACHE_UNAVAILABLE",
                `verified image archive could not be loaded for ${laneId}: ${loaded.output.trim() || "no output"}`
              )
            }
            // Loading is part of the lane budget, not extra time added to it.
            if (timeoutMs !== null) {
              timeoutMs -= Date.now() - loadStartedAt
              if (timeoutMs <= 0)
                fail(
                  "IMAGE_CACHE_TIMEOUT",
                  "image loading exhausted the lane budget"
                )
            }
          }
        }
        signal?.throwIfAborted()
        const argv = buildContainerArgv({
          contract,
          daemonName: needsDaemon ? daemonName : null,
          image,
          name: jobName,
          network: net,
          command,
          workspaceHostPath,
          env,
          envFile,
          vm,
          docker,
          limactl,
          labels,
        })
        let terminationCleanup = null
        let result
        try {
          result = await exec(argv, {
            timeoutMs,
            onOutput,
            signal,
            onTerminate: () => {
              terminationCleanup = quietly(
                buildRemoveArgv({ name: jobName, vm, docker, limactl }),
                "remove cancelled or timed-out job container"
              )
            },
          })
        } finally {
          await terminationCleanup
        }
        return Object.freeze({
          ...result,
          jobName,
          daemonName,
          network: net,
          teardownErrors,
        })
      } finally {
        await quietly(
          buildRemoveArgv({ name: jobName, vm, docker, limactl }),
          "remove job container"
        )
        if (needsDaemon) {
          await quietly(
            buildRemoveArgv({ name: daemonName, vm, docker, limactl }),
            "remove sidecar daemon"
          )
        }
        await quietly(
          buildNetworkRemoveArgv({ name: net, vm, docker, limactl }),
          "remove job network"
        )
        if (teardownErrors.length > 0) {
          log(
            "warn",
            `lane ${laneId}: teardown reported ${teardownErrors.join("; ")}`
          )
        }
      }
    },

    /**
     * Read one declared log back out of a run's workspace. **Impure.**
     *
     * Returns `{ name, status, text, reason }` and never throws: a log that
     * cannot be read is a fact about the evidence, and the caller records it as
     * one. `absent` and `unreadable` are kept apart from an empty `captured`
     * because a service that logged nothing and a service whose log vanished
     * are different things to be told.
     *
     * Only stdout becomes the text. `limactl` writes its own notices to stderr,
     * and a notice folded into the bytes would corrupt a digest that is
     * supposed to be reproducible from the file on disk.
     */
    async readWorkspaceLog({
      workspaceHostPath,
      name,
      timeoutMs = 60_000,
      maxBytes = MAX_LOG_PART_BYTES,
    }) {
      let argv
      try {
        argv = buildWorkspaceReadArgv({
          workspaceHostPath,
          name,
          vm,
          limactl,
          maxBytes,
        })
      } catch (error) {
        return Object.freeze({
          name,
          status: "unreadable",
          text: "",
          reason: error.message,
        })
      }

      let text = ""
      let result
      try {
        result = await exec(argv, {
          timeoutMs,
          onOutput: (chunk, stream) => {
            if (stream === "stdout") text += chunk
          },
        })
      } catch (error) {
        return Object.freeze({
          name,
          status: "unreadable",
          text: "",
          reason: error.message,
        })
      }

      if (result.exitCode === 0) {
        return Object.freeze({
          name,
          status: "captured",
          text,
          truncated: Buffer.byteLength(text, "utf8") >= maxBytes,
          reason: null,
        })
      }
      if (result.exitCode === READ_ABSENT_STATUS) {
        return Object.freeze({
          name,
          status: "absent",
          text: "",
          reason: `no file at ${workspaceHostPath}/${name} when the lane ended`,
        })
      }
      if (result.exitCode === READ_NOT_A_FILE_STATUS) {
        return Object.freeze({
          name,
          status: "unreadable",
          text: "",
          reason: `${workspaceHostPath}/${name} is a symlink or not a regular file; this plane does not follow a link the job container could have planted`,
        })
      }
      return Object.freeze({
        name,
        status: "unreadable",
        text: "",
        reason: `reading ${workspaceHostPath}/${name} exited ${result.exitCode}${result.timedOut ? " (timed out)" : ""}`,
      })
    },
  })
}
