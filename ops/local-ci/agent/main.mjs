#!/usr/bin/env node
/**
 * The agent's command-line entry point. Host filesystem operations are also
 * isolated in the attempt journal and controller lease helpers.
 *
 * Everything below is composition: it resolves the host's credentials, checks
 * their permissions, builds the injected dependencies, and hands them to the
 * pure core and the runtime modules. Keeping that in one file is what lets the
 * rest of the package be unit-tested with injected dependencies. Candidate
 * containers never receive the host GitHub App private key.
 *
 * Usage:
 *
 *   local-ci-agent --watch
 *   local-ci-agent --nightly
 *   local-ci-agent --profile pr --ref refs/pull/12/head --sha <40 hex>
 *   local-ci-agent --profile main --ref refs/heads/main --sha <40 hex> --dry-run
 *
 * Exit status is 0 only when the requested work completed and, for a one-shot
 * run, concluded successfully.
 */

import { createAttemptJournal, publishAttempt } from "../core/attempts.mjs"
import { acquireControllerLease } from "./lease.mjs"
import { assertInstalledExecutionCurrent } from "./installed-revision.mjs"
import { publishDurableCheck } from "./publisher.mjs"

import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  readdirSync,
  rmSync,
  rmdirSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve as resolvePath, sep } from "node:path"
import { arch as processArch } from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  PROCESS_TREE_OPTIONS,
  signalProcessTree,
} from "../core/process-tree.mjs"

import {
  LocalCiError,
  describeValue,
  loadContract,
  quoteForMessage,
  runtimeKind,
  toEpochMs,
} from "../core/contract.mjs"
import {
  DURATION_HISTORY,
  expectedLaneSeconds,
} from "../core/lane-scheduler.mjs"
import { loadProfile, snapshotGuardViolations } from "../core/profiles.mjs"
import { isCommitSha } from "../core/queue.mjs"
import { parseImageCachePin } from "../core/image-cache.mjs"
import { renderCheckSummary } from "../core/summary.mjs"
import { createContainerRuntime } from "./container.mjs"
import {
  PERMITTED_HOST_EXECUTABLES,
  createLimaRuntime,
} from "./runtime-lima.mjs"
import { createDockerDesktopRuntime } from "./runtime-docker-desktop.mjs"
import { createGitHubClient } from "./github.mjs"
import { createGitHubHeartbeat } from "./github-heartbeat.mjs"
import { createHeartbeat } from "./heartbeat.mjs"
import { createLoop, createSleepAssertion } from "./loop.mjs"
import { createRunner, createRuntimeEnvResolver } from "./runner.mjs"

// The Lima runtime's pieces and the shared workspace scripts moved out of this
// file unchanged. They are re-exported so every existing caller - the
// benchmark, the tests, an operator's REPL - keeps its import path.
export {
  PERMITTED_HOST_EXECUTABLES,
  VM_PROBE_MARKER,
  VM_PROBE_SCRIPT,
  assertVmIsolation,
  isStoppedInstance,
  parseLimaInstances,
  parseVmProbe,
} from "./runtime-lima.mjs"
export {
  buildLaneWorkspaceScript,
  buildWorkspacePreparationScript,
  shQuote,
} from "./workspace.mjs"

class CliError extends LocalCiError {}

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolvePath(HERE, "..", "..", "..")

/** Where the runbook and install.sh disagree, both names are accepted. */
const PRIVATE_KEY_FILENAMES = Object.freeze([
  "app-private-key.pem",
  "github-app-private-key.pem",
])
const HEARTBEAT_FILENAMES = Object.freeze([
  "heartbeat.url",
  "uptimerobot-heartbeat-url",
])

const USAGE = `nabaperks local CI agent

  --watch                 poll for work until stopped (the launchd mode)
  --nightly               one-shot: publish today's nightly proof if it is due
  --profile <name>        one-shot: pr | main | nightly
  --ref <ref>             one-shot: the git ref, e.g. refs/heads/main
  --sha <sha>             one-shot: the 40-character head commit SHA
  --dry-run               resolve everything and print the plan, run nothing
  --no-publish            run locally but publish no check run
  --help                  this text

Host configuration (environment first, then a file the installer wrote):

  LOCAL_CI_GITHUB_APP_ID              GitHub App id
  LOCAL_CI_GITHUB_INSTALLATION_ID     installation id
  LOCAL_CI_GITHUB_APP_PRIVATE_KEY     PEM contents (a path is used otherwise)
  LOCAL_CI_HEARTBEAT_URL              monitoring heartbeat URL
  LOCAL_CI_JOB_IMAGE                  the pinned job image tag
  LOCAL_CI_JOB_IMAGE_FILE             where install.sh recorded that tag
  LOCAL_CI_DIND_IMAGE                 the pinned sidecar daemon image tag
  LOCAL_CI_IMAGE_CACHE_PIN_FILE       optional reviewed image archive pin
  NABAPERKS_LOCAL_CI_HOME             state root (default ~/.nabaperks-local-ci)
  NABAPERKS_LOCAL_CI_VM               Lima instance (default from the contract)

The runtime is config/local-ci-contract.json runtime.kind: docker-desktop
dispatches into Docker Desktop through \`docker --context desktop-linux\`
with DOCKER_CONFIG at runtime.dockerConfig; lima dispatches into the
dedicated Lima VM.
`

/** The ref a nightly proof is produced for. */
export const DEFAULT_MAIN_REF = "refs/heads/main"

/** Parse argv into an options record. Pure. */
export function parseArgs(argv) {
  const options = {
    watch: false,
    nightly: false,
    profile: null,
    ref: null,
    sha: null,
    dryRun: false,
    publish: true,
    help: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith("--")) {
        throw new CliError(
          "INVALID_ARGUMENTS",
          `${argument} requires a value; see --help`
        )
      }
      index += 1
      return value
    }
    switch (argument) {
      case "--watch":
        options.watch = true
        break
      case "--nightly":
        options.nightly = true
        break
      case "--profile":
        options.profile = next()
        break
      case "--ref":
        options.ref = next()
        break
      case "--sha":
        options.sha = next()
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--no-publish":
        options.publish = false
        break
      case "--help":
      case "-h":
        options.help = true
        break
      default:
        throw new CliError(
          "INVALID_ARGUMENTS",
          `unknown argument ${JSON.stringify(argument)}; see --help`
        )
    }
  }
  if (options.help) return options
  const modes = [
    options.watch ? "--watch" : null,
    options.nightly ? "--nightly" : null,
    options.profile ? "--profile" : null,
  ].filter((name) => name !== null)
  if (modes.length > 1) {
    throw new CliError(
      "INVALID_ARGUMENTS",
      `${modes.join(", ")} are different modes; pass exactly one`
    )
  }
  if (options.nightly) {
    // The nightly proof is always the default branch's head, resolved from
    // GitHub at dispatch time: a scheduled run has no operator to name a SHA,
    // and pinning one in a schedule would prove a commit nobody is on.
    if (options.sha) {
      throw new CliError(
        "INVALID_ARGUMENTS",
        "--nightly resolves the default branch head itself; do not pass --sha"
      )
    }
    options.profile = "nightly"
    options.ref = options.ref ?? DEFAULT_MAIN_REF
    return options
  }
  if (!options.watch) {
    if (!options.profile || !options.sha) {
      throw new CliError(
        "INVALID_ARGUMENTS",
        "a one-shot run needs --profile and --sha (and normally --ref); pass --watch for the poll loop"
      )
    }
    if (!isCommitSha(options.sha)) {
      throw new CliError(
        "INVALID_ARGUMENTS",
        `--sha must be a 40-character hexadecimal commit SHA (received ${quoteForMessage(options.sha)})`
      )
    }
    options.ref = options.ref ?? `refs/heads/${options.profile}`
  }
  return options
}

/** Expand a leading `~` against the real home directory. Pure given `home`. */
export function expandHome(path, home) {
  if (typeof path !== "string") return path
  if (path === "~") return home
  if (path.startsWith("~/")) return join(home, path.slice(2))
  return path
}

/**
 * Read a credential file, refusing anything readable beyond the owner.
 *
 * Mode `0600` is what `githubApp.privateKeyMode` requires and what the runbook
 * verifies with `stat`. A group- or world-readable private key on a machine
 * that also runs pull-request code is not a warning: it is the whole boundary,
 * so this refuses rather than continuing with a caveat.
 *
 * The check and the read happen on **one descriptor**. Checking the mode by
 * path and then opening the path again leaves a window in which the name can be
 * repointed - the classic symlink swap - so the bytes that come back are not
 * the bytes whose permissions were approved. Since the barrier this enforces is
 * the one protecting the GitHub App private key, that window is the whole bug:
 * `openSync` once, `fstatSync` the descriptor, read the same descriptor.
 *
 * A symlink at the path is still followed. It is the target's mode that
 * `fstat` reports either way, and refusing `O_NOFOLLOW`-style would break an
 * operator who keeps the `.pem` outside the state root while buying nothing -
 * once the descriptor is fixed, no swap can change what is read through it.
 */
export function readCredentialFile(path, label) {
  let fd
  try {
    fd = openSync(path, "r")
  } catch (error) {
    // Only a genuinely absent file is "not configured". Every other failure -
    // a permission denial, a dangling symlink, a directory where a file was
    // expected - means a credential IS installed here and cannot be read, and
    // returning null for those would send firstExisting on to the next
    // candidate and silently authenticate as a different key. Fail loudly.
    if (error.code === "ENOENT") return null
    throw new CliError(
      "CREDENTIAL_UNREADABLE",
      `${label} at ${path} exists but could not be opened (${error.code ?? error.message}); refusing to fall back to another credential`
    )
  }
  try {
    const stats = fstatSync(fd)
    // `open` succeeds on a directory, so the type has to be checked explicitly
    // or the EISDIR surfaces later from the read as a raw fs error instead of a
    // refusal that names the credential.
    if (!stats.isFile()) {
      throw new CliError(
        "CREDENTIAL_UNREADABLE",
        `${label} at ${path} is not a regular file; refusing to fall back to another credential`
      )
    }
    const mode = stats.mode & 0o777
    if ((mode & 0o077) !== 0) {
      throw new CliError(
        "CREDENTIAL_PERMISSIONS",
        `${label} at ${path} is mode ${mode.toString(8).padStart(4, "0")}; it must be 0600 (owner-only). Fix it with: chmod 600 ${path}`
      )
    }
    try {
      return readFileSync(fd, "utf8")
    } catch (error) {
      if (error instanceof CliError) throw error
      throw new CliError(
        "CREDENTIAL_UNREADABLE",
        `${label} at ${path} could not be read (${error.code ?? error.message}); refusing to fall back to another credential`
      )
    }
  } finally {
    closeSync(fd)
  }
}

function firstExisting(root, filenames, label) {
  for (const name of filenames) {
    const value = readCredentialFile(join(root, name), label)
    if (value !== null) return { value, path: join(root, name) }
  }
  return null
}

/**
 * Read a host state file that is configuration rather than a credential.
 *
 * Absent is `null`; anything else that goes wrong is a refusal, for the same
 * reason `readCredentialFile` refuses: a file that exists and cannot be read
 * means the host was configured and the configuration is unreadable, which is
 * not the same thing as "not configured yet".
 */
export function readStateFile(path, label) {
  let fd
  try {
    fd = openSync(path, "r")
  } catch (error) {
    if (error.code === "ENOENT") return null
    throw new CliError(
      "STATE_FILE_UNREADABLE",
      `${label} at ${path} exists but could not be opened (${error.code ?? error.message})`
    )
  }
  try {
    if (!fstatSync(fd).isFile()) {
      throw new CliError(
        "STATE_FILE_UNREADABLE",
        `${label} at ${path} is not a regular file`
      )
    }
    return readFileSync(fd, "utf8")
  } finally {
    closeSync(fd)
  }
}

/**
 * Where `install.sh` recorded the pinned job image tag.
 *
 * The tag is per-host - it names an image built inside that Mac's VM - so it
 * cannot be a literal in the committed plist, which install.sh installs
 * byte-identically. The plist therefore carries the *path* (absolute and
 * operator-independent) and the installer writes the *value* there under
 * `sudo`, root-owned beside the release tree. The tag is not a secret, but it
 * decides which image executes pull-request code, so it belongs in the same
 * integrity domain as the agent source rather than in a user-writable dotfile.
 *
 * The default is derived from `contract.agent.installRoot` so the path exists
 * in exactly one place in this repository.
 */
export function jobImageFilePath(env, contract) {
  const named = env?.LOCAL_CI_JOB_IMAGE_FILE
  if (typeof named === "string" && named.trim() !== "") return named.trim()
  const installRoot = contract?.agent?.installRoot
  if (typeof installRoot !== "string" || installRoot.trim() === "") return null
  return join(dirname(installRoot), "job-image")
}

/**
 * The characters an image reference may contain here.
 *
 * The tag reaches `docker run` as an argv word, so a value with whitespace, a
 * leading `-` or shell punctuation is not a typo to tolerate: it is a word
 * that changes what the container runtime is being asked to do. Refusing at
 * the point the value is read keeps `container.mjs`'s argv builders working on
 * a reference that has already been proven to be one.
 */
const JOB_IMAGE_PATTERN =
  /^[A-Za-z0-9][A-Za-z0-9._\-/]*(?::[\w][\w.-]*|@[\w:.+-]+)$/

/** Validate a job image reference and return it trimmed. */
export function requireJobImage(value, source) {
  const text = typeof value === "string" ? value.trim() : ""
  if (text === "") {
    throw new CliError(
      "MISSING_JOB_IMAGE",
      `${source} holds no job image tag. It is the pinned tag of the image built from a verified main commit inside the VM (ops/local-ci/host/README.md §3), e.g. nabaperks-ci-job:<commit sha>.`
    )
  }
  if (text.length > 255 || !JOB_IMAGE_PATTERN.test(text)) {
    throw new CliError(
      "INVALID_JOB_IMAGE",
      `${source} is ${quoteForMessage(text)}, which is not a pinned image reference. Expected name:tag or name@digest, e.g. nabaperks-ci-job:<commit sha>.`
    )
  }
  return text
}

/**
 * Resolve the host's configuration from the environment and the state root.
 *
 * The environment wins so an operator can run a one-shot by hand without
 * touching the installed credential files, and the files are the launchd path
 * because launchd cannot hold a secret.
 */
export function resolveHostConfig({ env, contract, home }) {
  const stateRoot = expandHome(
    env.NABAPERKS_LOCAL_CI_HOME ?? contract.agent.stateRoot,
    home
  )
  const contractKeyPath = expandHome(
    contract.githubApp?.privateKeyPath ?? "",
    home
  )

  let privateKey = env.LOCAL_CI_GITHUB_APP_PRIVATE_KEY ?? null
  let privateKeyPath = null
  if (privateKey === null && contractKeyPath !== "") {
    privateKey = readCredentialFile(
      contractKeyPath,
      "the GitHub App private key"
    )
    if (privateKey !== null) privateKeyPath = contractKeyPath
  }
  if (privateKey === null) {
    const found = firstExisting(
      stateRoot,
      PRIVATE_KEY_FILENAMES,
      "the GitHub App private key"
    )
    if (found) {
      privateKey = found.value
      privateKeyPath = found.path
    }
  }
  if (privateKey === null) {
    throw new CliError(
      "MISSING_PRIVATE_KEY",
      `no GitHub App private key. Set LOCAL_CI_GITHUB_APP_PRIVATE_KEY, or place the .pem at ${contractKeyPath || join(stateRoot, PRIVATE_KEY_FILENAMES[0])} with mode 0600 (runbook docs/operations/local-ci.md §2.5).`
    )
  }

  let heartbeatUrl = env.LOCAL_CI_HEARTBEAT_URL ?? null
  if (heartbeatUrl === null) {
    const found = firstExisting(
      stateRoot,
      HEARTBEAT_FILENAMES,
      "the monitoring heartbeat URL"
    )
    heartbeatUrl = found ? found.value.trim() : null
  }

  const appId = env.LOCAL_CI_GITHUB_APP_ID ?? contract.githubApp?.appId ?? null
  const installationId =
    env.LOCAL_CI_GITHUB_INSTALLATION_ID ??
    contract.githubApp?.installationId ??
    null
  if (appId === null || installationId === null) {
    throw new CliError(
      "MISSING_APP_IDENTITY",
      "the GitHub App id and installation id are both required. They are still null sentinels in config/local-ci-contract.json; set LOCAL_CI_GITHUB_APP_ID and LOCAL_CI_GITHUB_INSTALLATION_ID, or pin them in the contract (runbook §2.6)."
    )
  }

  // The environment wins for a hand-run one-shot; the installed service has no
  // environment to speak of, so it reads the file install.sh pinned. Without
  // the file the launchd job used to start, fail MISSING_JOB_IMAGE and be
  // restarted by KeepAlive forever, which is a crash loop rather than a poller.
  const jobImageFile = jobImageFilePath(env, contract)
  let jobImage = env.LOCAL_CI_JOB_IMAGE ?? null
  let jobImageSource = "LOCAL_CI_JOB_IMAGE"
  if (jobImage === null && jobImageFile !== null) {
    jobImage = readStateFile(jobImageFile, "the pinned job image tag")
    jobImageSource = jobImageFile
  }
  if (jobImage === null) {
    throw new CliError(
      "MISSING_JOB_IMAGE",
      `no pinned job image. Set LOCAL_CI_JOB_IMAGE, or let ops/local-ci/host/install.sh record the tag at ${jobImageFile ?? "the path in LOCAL_CI_JOB_IMAGE_FILE"} (ops/local-ci/host/README.md §3).`
    )
  }
  const pinnedJobImage = requireJobImage(jobImage, jobImageSource)
  const explicitCacheFile = env.LOCAL_CI_IMAGE_CACHE_PIN_FILE?.trim() || null
  const imageCachePinFile =
    explicitCacheFile ??
    (jobImageFile === null
      ? null
      : join(dirname(jobImageFile), "image-cache.json"))
  const imageCachePinText =
    imageCachePinFile === null
      ? null
      : readStateFile(
          imageCachePinFile,
          "the verified Supabase image archive pin"
        )
  if (explicitCacheFile !== null && imageCachePinText === null) {
    throw new CliError(
      "INVALID_IMAGE_CACHE",
      "the explicitly configured image archive pin is missing"
    )
  }
  const imageCachePin = parseImageCachePin(imageCachePinText)

  return Object.freeze({
    stateRoot,
    privateKey,
    privateKeyPath,
    heartbeatUrl,
    appId,
    installationId,
    jobImage: pinnedJobImage,
    jobImageSource,
    imageCachePin,
    daemonImage: env.LOCAL_CI_DIND_IMAGE ?? "docker:27.5.1-dind",
    vm: env.NABAPERKS_LOCAL_CI_VM ?? contract.vm?.name ?? null,
    vmWorkspaceRoot: "/var/lib/nabaperks-ci",
  })
}

/* ---------------------------------------------------------------- plumbing */

function createLogger() {
  const line = (level, message) =>
    `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} ${message}`
  return {
    info: (message) => process.stdout.write(`${line("info", message)}\n`),
    warn: (message) => process.stderr.write(`${line("warn", message)}\n`),
    error: (message) => process.stderr.write(`${line("error", message)}\n`),
  }
}

/**
 * The executables this agent may spawn on the host.
 *
 * Every `execHost` argv is assembled from data that starts at the command line
 * - a head SHA, a profile name, the VM name - so leaving `argv[0]` free lets a
 * crafted invocation choose which binary runs *outside* the container, next to
 * the GitHub App private key. `ops/local-ci/README.md` describes a plane that
 * shells out to a fixed, small set of tools; this is that description as a
 * mechanism instead of a convention.
 *
 * Each runtime declares its own list. The Lima runtime's -
 * `["/bin/sh", "limactl"]`, re-exported above as `PERMITTED_HOST_EXECUTABLES`
 * - is the default for a caller that names none. The Docker Desktop runtime's
 * is `/bin/sh` and the absolute docker CLI, without limactl. `git` and `curl`
 * never run on the host: they run inside the VM or a helper container.
 *
 * Entries are matched whole. A basename match would accept `/tmp/x/limactl`,
 * which is the attack this exists to stop.
 */
/**
 * Check one argv and return the *allowlist's own* string for its executable.
 *
 * Returning the matched constant rather than `argv[0]` is the point: what
 * reaches `spawn` is then one of the two literals above by construction, not a
 * caller-supplied value that merely compared equal to one.
 */
export function permittedExecutable(
  argv,
  permitted = PERMITTED_HOST_EXECUTABLES
) {
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new CliError(
      "INVALID_COMMAND",
      `a host command must be a non-empty array (received ${describeValue(argv)})`
    )
  }
  const nonString = argv.findIndex((word) => typeof word !== "string")
  if (nonString !== -1) {
    throw new CliError(
      "INVALID_COMMAND",
      `host command word ${nonString} must be a string (received ${describeValue(argv[nonString])})`
    )
  }
  const executable = permitted.find((name) => name === argv[0])
  if (executable === undefined) {
    throw new CliError(
      "EXECUTABLE_NOT_PERMITTED",
      `this agent may not run ${JSON.stringify(argv[0])} on the host; the permitted executables are ${permitted.join(", ")}`
    )
  }
  return executable
}

/**
 * Run a command on the host or inside the VM, optionally feeding it stdin.
 *
 * `async` rather than a bare `Promise` so a refused argv arrives as a rejection
 * like every other failure here - `releaseWorkspace` swallows this call with
 * `.catch()`, and a synchronous throw would escape that and mask a run's real
 * outcome from inside a `finally`.
 */
export async function execHost(
  argv,
  {
    input = null,
    timeoutMs = 600_000,
    cwd = undefined,
    signal = null,
    permitted = PERMITTED_HOST_EXECUTABLES,
    env = undefined,
  } = {}
) {
  const executable = permittedExecutable(argv, permitted)
  signal?.throwIfAborted()
  return new Promise((resolveExec, rejectExec) => {
    const child = spawn(executable, argv.slice(1), {
      ...PROCESS_TREE_OPTIONS,
      cwd,
      ...(env === undefined ? {} : { env }),
      stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let abortTimer = null
    const onAbort = () => {
      signalProcessTree(child, "SIGTERM")
      abortTimer = setTimeout(() => signalProcessTree(child, "SIGKILL"), 5_000)
      abortTimer.unref?.()
    }
    signal?.addEventListener("abort", onAbort, { once: true })
    const cleanup = () => {
      clearTimeout(timer)
      if (abortTimer) clearTimeout(abortTimer)
      signal?.removeEventListener("abort", onAbort)
    }
    const timer = setTimeout(
      () => signalProcessTree(child, "SIGKILL"),
      timeoutMs
    )
    timer.unref?.()
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })
    child.once("error", (error) => {
      cleanup()
      rejectExec(signal?.aborted ? signal.reason : error)
    })
    child.once("close", (code) => {
      cleanup()
      if (signal?.aborted) {
        rejectExec(signal.reason)
        return
      }
      if (code === 0) resolveExec(stdout)
      else
        rejectExec(
          new CliError(
            "COMMAND_FAILED",
            `${argv.join(" ")} exited ${code}: ${stderr.trim() || stdout.trim()}`
          )
        )
    })
    if (input !== null) {
      child.stdin.on("error", (error) => {
        if (!signal?.aborted) rejectExec(error)
      })
      child.stdin.end(input)
    }
  })
}

/* ---------------------------------------------------------------- runtime */

/**
 * The VM layer this contract selects, behind one interface: the isolation
 * verdict, the resource sweep, workspace preparation, env files, release and
 * the container options. `runtime.kind` in the contract decides; a contract
 * without a runtime block predates the adapter and means Lima.
 */
export function createHostRuntime({
  contract,
  config,
  logger,
  exec = execHost,
  ...options
}) {
  const kind = runtimeKind(contract)
  if (kind === "docker-desktop")
    return createDockerDesktopRuntime({
      contract,
      config,
      logger,
      execHost: exec,
      ...options,
    })
  if (kind === "lima")
    return createLimaRuntime({ contract, config, logger, execHost: exec })
  throw new CliError(
    "UNKNOWN_RUNTIME",
    `contract.runtime.kind is ${describeValue(kind)}; this agent knows lima and docker-desktop`
  )
}

/** The installed profiles' lane ids, which the resource sweep validates against. */
function installedProfileLanes(contract) {
  return Object.fromEntries(
    Object.keys(contract.profiles).map((name) => [
      name,
      loadProfile(name, contract, (path) =>
        readFileSync(join(REPO_ROOT, path), "utf8")
      ).lanes.map((lane) => lane.id),
    ])
  )
}

export async function reconcileOwnedResources({ contract, runtime }) {
  return runtime.reconcile({ profiles: installedProfileLanes(contract) })
}

/* --------------------------------------------------------------- evidence */

/**
 * The name of one run's evidence directory: profile, instant, entropy.
 *
 * A commit is not a run. The queue deliberately admits a `pr`, a `main` and a
 * `nightly` job for the same SHA - a fast-forwarded pull-request commit is
 * tested again the moment it lands on main - and the contract promises one
 * lane-result document *per lane per run*. Keying the directory on the SHA
 * alone made the second run truncate the first one's `<lane>.log` and rewrite
 * its `lane-result.json`, destroying exactly the shadow-qualification record
 * the cutover is supposed to be built from.
 *
 * The instant is in the name rather than only in the filesystem metadata so
 * the ordering survives a copy, a backup restore and `rsync`.
 */
export function runDirectoryName({ profile, at, entropy }) {
  const stamp = new Date(toEpochMs(at, "run instant"))
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d+Z$/, "Z")
  return `${profile}-${stamp}-${entropy}`
}

const RUN_DIRECTORY_PATTERN = /^(.+)-(\d{8}T\d{6}Z)-([0-9a-f]+)$/

/** Read a run directory's name back. Pure; `null` when it is not one. */
export function parseRunDirectoryName(name) {
  const match = RUN_DIRECTORY_PATTERN.exec(String(name ?? ""))
  if (match === null) return null
  const [, profile, stamp] = match
  const iso = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 11)}:${stamp.slice(11, 13)}:${stamp.slice(13, 15)}Z`
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return null
  return Object.freeze({ profile, at })
}

function readDirectoryNames(path) {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
  } catch (error) {
    if (error.code === "ENOENT") return []
    throw error
  }
}

/**
 * The run evidence on the Mac: one directory per run, and the retention sweep
 * that eventually deletes it.
 *
 * This is the store `createLoop` takes as `logStore`. Without it the loop's
 * retention branch returns 0 on every tick and `agent.logRetentionDays` is a
 * number no code reads, so lane logs accumulate until the disk fills.
 *
 * A run that is still open is protected by construction: `open()` records the
 * directory and `list()` marks it `running`, which `core/retention.mjs` treats
 * as never expirable regardless of age.
 */
export function createRunEvidenceStore({
  stateRoot,
  now = () => Date.now(),
  entropy = () => randomBytes(3).toString("hex"),
}) {
  const root = join(stateRoot, "runs")
  const active = new Set()

  const entryFor = (path, name) => {
    const parsed = parseRunDirectoryName(name)
    let createdAt = parsed?.at ?? null
    if (createdAt === null) {
      const stats = statSync(path)
      createdAt = stats.birthtimeMs || stats.mtimeMs
    }
    return Object.freeze({
      path,
      profile: parsed?.profile ?? null,
      createdAt,
      running: active.has(path),
    })
  }

  const listEntries = () => {
    const entries = []
    for (const shaName of readDirectoryNames(root)) {
      const parent = join(root, shaName)
      const runs = readDirectoryNames(parent)
      if (runs.length === 0) {
        // A commit directory with no run inside it: either emptied by an
        // earlier sweep or written by a pre-per-run layout. Either way it is
        // the thing that ages out.
        entries.push(entryFor(parent, shaName))
        continue
      }
      for (const runName of runs) {
        entries.push(entryFor(join(parent, runName), runName))
      }
    }
    return entries
  }

  return Object.freeze({
    root,

    /** Create this run's directory, mode 0700, and protect it while open. */
    open({ headSha, profile }) {
      const parent = join(root, headSha)
      mkdirSync(parent, { recursive: true, mode: 0o700 })
      for (let attempt = 0; attempt < 8; attempt += 1) {
        const path = join(
          parent,
          runDirectoryName({ profile, at: now(), entropy: entropy() })
        )
        try {
          // Deliberately not `recursive`: an EEXIST here means another run
          // already owns the name, and silently sharing it is the collision
          // this directory layout exists to prevent.
          mkdirSync(path, { mode: 0o700 })
        } catch (error) {
          if (error.code === "EEXIST") continue
          throw error
        }
        active.add(path)
        return Object.freeze({
          path,
          close() {
            active.delete(path)
          },
        })
      }
      throw new CliError(
        "EVIDENCE_DIRECTORY",
        `could not create a fresh evidence directory under ${parent}`
      )
    },

    /** Every run's evidence directory, for the retention sweep. */
    list() {
      return listEntries()
    },

    /**
     * The newest `limit` successful durations of one lane on this host, in
     * seconds, newest first. They come from lane-result documents this agent
     * wrote and timed itself - never from anything a candidate printed - and
     * they order admission, longest first, and nothing else.
     */
    laneDurations(laneId, limit = DURATION_HISTORY) {
      if (!/^[a-z][a-z0-9-]*$/.test(String(laneId))) return []
      const durations = []
      const entries = listEntries().sort((a, b) => b.createdAt - a.createdAt)
      for (const entry of entries) {
        if (durations.length >= limit) break
        let document
        try {
          document = JSON.parse(
            readFileSync(join(entry.path, `${laneId}.lane-result.json`), "utf8")
          )
        } catch {
          continue
        }
        if (
          document?.laneId === laneId &&
          document.status === "success" &&
          Number.isFinite(document.durationSeconds) &&
          document.durationSeconds > 0
        )
          durations.push(document.durationSeconds)
      }
      return durations
    },

    /** When this profile last started a run here, or null. */
    lastRunAt(profile) {
      let newest = null
      for (const entry of listEntries()) {
        if (entry.profile !== profile) continue
        if (newest === null || entry.createdAt > newest) {
          newest = entry.createdAt
        }
      }
      return newest
    },

    /** Delete one aged-out entry, and the commit directory it emptied. */
    remove(entry) {
      const path = entry?.path
      if (typeof path !== "string" || !path.startsWith(`${root}${sep}`)) {
        throw new CliError(
          "EVIDENCE_DIRECTORY",
          `refusing to delete ${describeValue(path)}: the retention sweep may only remove paths under ${root}`
        )
      }
      rmSync(path, { recursive: true, force: true })
      const parent = dirname(path)
      if (parent !== root) {
        try {
          rmdirSync(parent)
        } catch {
          // Still holds another run of the same commit. Nothing to do.
        }
      }
    },
  })
}

function makeLaneLogOpener(runDir) {
  return (name) => {
    const path = join(runDir, name)
    writeFileSync(path, "", { mode: 0o600 })
    return {
      path,
      write(chunk) {
        appendFileSync(path, chunk)
      },
      close() {},
    }
  }
}

function writeLaneResults({ runDir, outcome, contract }) {
  for (const lane of outcome.laneResults) {
    writeFileSync(
      join(runDir, `${lane.laneId}.lane-result.json`),
      `${JSON.stringify(lane, null, 2)}\n`,
      { mode: 0o600 }
    )
  }
  writeFileSync(
    join(runDir, "lane-result.json"),
    `${JSON.stringify(
      {
        ...outcome.record,
        schema: contract.evidence.resultSchema,
        logParts: outcome.laneResults.flatMap((lane) => lane.logParts),
        lanes: outcome.laneResults,
      },
      null,
      2
    )}\n`,
    { mode: 0o600 }
  )
}

/**
 * How often the nightly proof is produced.
 *
 * Daily, because `nightlyProof.maxAgeHours` is 36: one cadence plus a 12-hour
 * recovery window, so a single missed night warns without paging and two
 * consecutive misses fail. The two numbers are one design, and
 * `nightlyCadence` refuses a contract in which they stop agreeing.
 */
export const NIGHTLY_CADENCE_HOURS = 24

/**
 * How often the agent asks whether a nightly is due.
 *
 * Short relative to the cadence on purpose: this is the mechanism that turns a
 * missed window into a late run rather than a skipped one. A Mac asleep,
 * logged out or powered off at the scheduled hour comes back, is asked again
 * within the quarter hour, sees the last run is older than the cadence, and
 * produces the proof then. A launchd `StartCalendarInterval` cannot do that -
 * it replays a window missed during sleep, but a window missed while the
 * machine was off is gone.
 */
export const NIGHTLY_CHECK_INTERVAL_MS = 15 * 60_000

const HOUR_MS = 3_600_000

/** The nightly cadence and the freshness window it has to fit inside. Pure. */
export function nightlyCadence(contract) {
  const maxAgeHours = contract?.nightlyProof?.maxAgeHours
  if (
    typeof maxAgeHours !== "number" ||
    !Number.isFinite(maxAgeHours) ||
    maxAgeHours <= NIGHTLY_CADENCE_HOURS
  ) {
    throw new CliError(
      "INVALID_CONTRACT",
      `contract.nightlyProof.maxAgeHours must be a number greater than the ${NIGHTLY_CADENCE_HOURS}-hour nightly cadence, or one missed run fails the freshness monitor with no recovery window (received ${describeValue(maxAgeHours)})`
    )
  }
  return Object.freeze({
    cadenceHours: NIGHTLY_CADENCE_HOURS,
    maxAgeHours,
    recoveryHours: maxAgeHours - NIGHTLY_CADENCE_HOURS,
  })
}

/**
 * Whether a nightly proof is due. Pure.
 *
 * The question is asked of the local evidence rather than of GitHub, because
 * the evidence directory is written before the run starts: an attempt that
 * crashed still moved the clock forward, so a hard failure retries on the next
 * cadence instead of every quarter hour, and the freshness monitor is the
 * thing that notices a plane which cannot finish a run at all.
 */
export function nightlyRunIsDue({ lastRunAt, now, contract }) {
  const cadence = nightlyCadence(contract)
  if (lastRunAt === null || lastRunAt === undefined) {
    return Object.freeze({
      due: true,
      ageHours: null,
      reason: "no nightly run is on record on this host",
    })
  }
  const ageHours =
    (toEpochMs(now, "now") - toEpochMs(lastRunAt, "the last nightly run")) /
    HOUR_MS
  if (ageHours >= cadence.cadenceHours) {
    return Object.freeze({
      due: true,
      ageHours,
      reason: `the last nightly run was ${ageHours.toFixed(1)}h ago, at or past the ${cadence.cadenceHours}h cadence; the freshness monitor fails at ${cadence.maxAgeHours}h`,
    })
  }
  return Object.freeze({
    due: false,
    ageHours,
    reason: `the last nightly run was ${ageHours.toFixed(1)}h ago; the next is due in ${(cadence.cadenceHours - ageHours).toFixed(1)}h`,
  })
}

/**
 * One at a time, in the order they asked.
 *
 * The poll loop and the nightly schedule are two dispatchers inside one
 * process, and `agent.maxConcurrentJobs` is 1: two profiles running at once
 * would exceed the VM's whole CPU and memory budget and produce two sets of
 * results nobody can compare. A gate rather than a refusal because the loop
 * treats a throwing runner as a failed job, and a pull request must not be
 * failed for arriving while the nightly happened to be running.
 */
export function createSerialGate() {
  let tail = Promise.resolve()
  let depth = 0
  return Object.freeze({
    get waiting() {
      return depth
    },
    run(task) {
      depth += 1
      const started = tail.then(() => task())
      tail = started.then(
        () => {},
        () => {}
      )
      return started.finally(() => {
        depth -= 1
      })
    },
  })
}

/* -------------------------------------------------------------------- main */

/**
 * What `dispatchRun` needs from the runtime, under the names it has always
 * called them by. Every step goes through the runtime the contract selected,
 * so there is one door and one set of checks per runtime.
 */
export function runtimeDispatchDependencies(runtime) {
  const missing = () => {
    throw new CliError(
      "RUNTIME_NOT_CONFIGURED",
      "dispatchRun needs the host runtime the contract selects; no job is dispatched without one"
    )
  }
  return {
    assertInstalledExecutionCurrent,
    assertVmIsolationLive: () =>
      runtime === null ? missing() : runtime.assertIsolationLive(),
    reconcileOwnedResources: ({ contract }) =>
      runtime === null
        ? missing()
        : reconcileOwnedResources({ contract, runtime }),
    buildDependencies,
    makeEnvFileWriter: ({ headSha, signal }) =>
      runtime === null ? missing() : runtime.envFileWriter({ headSha, signal }),
    releaseWorkspace: ({ headSha }) =>
      runtime === null ? missing() : runtime.releaseWorkspace({ headSha }),
  }
}

/** One line for the log that says what the verdict actually checked. */
function describeIsolation(isolation) {
  if (isolation?.runtime !== "docker-desktop")
    return "no host mounts, no forwarded agent, no host home, no Rosetta"
  return `engine ${isolation.engine.serverVersion} (${isolation.engine.cpus} CPU, ${isolation.engine.memoryGb} GiB), file sharing limited to ${isolation.fileSharing.shared.length} path(s), canary unreachable on ${isolation.canary.unreachable.join(", ")}`
}

/**
 * Whether the runtime can take a job now. The poll loop and the nightly
 * schedule ask before claiming anything, so a stopped engine or a failed
 * isolation check leaves work queued instead of failing a check per commit.
 */
export function runtimeHealth(runtime) {
  return async () => {
    try {
      await runtime.assertIsolationLive()
      return Object.freeze({ healthy: true })
    } catch (error) {
      return Object.freeze({
        healthy: false,
        code: error?.code ?? "VM_UNVERIFIABLE",
        reason: error?.message ?? String(error),
      })
    }
  }
}

async function buildDependencies({
  contract,
  config,
  logger,
  headSha,
  runDir,
  signal,
  runtime,
  evidence = null,
}) {
  const containerRuntime = createContainerRuntime({
    contract,
    logger,
    imageCachePin: config.imageCachePin,
    ...runtime.containerRuntimeOptions(),
  })
  const resolveRuntimeEnv = createRuntimeEnvResolver({
    contract,
    exec: (command) =>
      execHost(["/bin/sh", "-c", command], {
        timeoutMs: 120_000,
        cwd: REPO_ROOT,
        signal,
      }),
    randomBytes,
  })
  const workspaceHostPath = await runtime.prepareWorkspace({ headSha, signal })
  const runner = createRunner({
    contract,
    containerRuntime,
    resolveRuntimeEnv,
    openLaneLog: makeLaneLogOpener(runDir),
    hostEnv: process.env,
    arch: processArch,
    image: config.jobImage,
    daemonImage: config.daemonImage,
    workspaceHostPath,
    prepareLaneWorkspace: (lane, options) =>
      runtime.prepareLaneWorkspace(lane, {
        ...options,
        workspace: workspaceHostPath,
        headSha,
      }),
    hostedOnlyRequirements: runtime.hostedOnlyRequirements,
    laneScriptPrelude: runtime.laneScriptPrelude,
    externalMemoryGb: () => runtime.externalMemoryGb(),
    // Longest first, from this host's own lane-result records only.
    expectedSeconds: (lane) =>
      expectedLaneSeconds(lane, evidence?.laneDurations?.(lane.id) ?? []),
    logger,
  })
  return { runner, containerRuntime }
}

function hostGitHubClient({ contract, config, logger }) {
  return createGitHubClient({
    contract,
    appId: config.appId,
    installationId: config.installationId,
    privateKey: config.privateKey,
    logger,
    maxAttempts: 1,
    fetch: (url, options) =>
      fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      }),
  })
}

/** Load a profile, refusing one that could rewrite a pixel baseline. */
function loadProfileChecked(name, contract) {
  const profile = loadProfile(name, contract, (path) =>
    readFileSync(join(REPO_ROOT, path), "utf8")
  )
  const violations = snapshotGuardViolations(profile, contract)
  if (violations.length > 0) {
    throw new CliError(
      "SNAPSHOT_GUARD_VIOLATION",
      `profile ${name} would let a local ARM64 run touch a pixel baseline:\n  ${violations.join("\n  ")}`
    )
  }
  return profile
}

/** Durable one-shot/nightly dispatch; watcher PR/main uses the same journal. */
export async function executeDurableRun({
  journal,
  profile,
  ref,
  headSha,
  dispatch,
  publish = null,
  now = () => Date.now(),
  signal = null,
}) {
  const scope = `${publish ? "commit" : "local-only"}${profile.profile === "nightly" ? `:${new Date(now()).toISOString().slice(0, 10)}` : ""}`
  const job = {
    profile: profile.profile,
    ref,
    sha: headSha,
    scope,
    publish: publish !== null,
  }
  const matching = () =>
    journal.entries.filter(
      (entry) =>
        entry.profile === job.profile &&
        entry.ref === ref &&
        entry.sha === headSha &&
        (entry.scope ?? "commit") === scope
    )
  for (const attempt of matching()) {
    if (
      attempt.status !== "running" &&
      !attempt.published &&
      attempt.publish !== false &&
      publish
    ) {
      await publishAttempt(journal, attempt.id, publish)
    }
  }
  if (!journal.eligible(job)) {
    const previous = matching().at(-1)
    if (previous?.record)
      return {
        record: previous.record,
        startedAt: previous.startedAt,
        completedAt: previous.completedAt,
      }
    throw new Error(
      "Durable local CI attempt is not eligible; retry backoff or limit applies"
    )
  }
  const id = journal.begin(job)
  let outcome
  try {
    outcome = await dispatch({ profile, ref, headSha, signal })
    if (signal?.aborted)
      outcome = {
        ...outcome,
        record: { ...outcome.record, conclusion: "cancelled" },
      }
    journal.finish(id, outcome.record.conclusion, outcome.record)
  } catch (error) {
    journal.finish(id, signal?.aborted ? "cancelled" : "incomplete")
    // Preserve the execution error; an unavailable publisher remains in the
    // durable outbox for the next controller rather than replacing its cause.
    if (publish) await publishAttempt(journal, id, publish).catch(() => {})
    throw error
  }
  if (publish) {
    await publishAttempt(journal, id, publish)
  }
  return outcome
}

function durablePublisher({ github, contract, journal }) {
  return async (attempt) => {
    const output = attempt.record
      ? renderCheckSummary(attempt.record, contract)
      : {
          title: `${attempt.profile} — interrupted`,
          summary:
            "The controller recovered an incomplete attempt. No successful local test evidence exists for this attempt.",
        }
    await publishDurableCheck({
      github,
      contract,
      journal,
      attempt,
      payload: {
        status: "completed",
        conclusion: attempt.record?.conclusion ?? "failure",
        startedAt: attempt.startedAt,
        completedAt: attempt.completedAt,
        output,
      },
    })
  }
}

/**
 * Run one profile against one commit, and leave the evidence behind.
 *
 * Every dispatch on this host goes through here - the poll loop's, the nightly
 * schedule's and a hand-run one-shot's - because the first thing it does has
 * to be true for all three: the live VM is re-asserted before any commit is
 * materialised inside it. Asserting only at startup would let an instance that
 * gained a host mount, a forwarded agent or Rosetta at 10am still receive
 * pull-request code at 11am, and an instance installed with `--skip-vm-check`
 * would never have been asserted at all.
 */
export async function dispatchRun(
  {
    contract,
    config,
    logger,
    evidence,
    profile,
    ref,
    headSha,
    signal = null,
    runtime = null,
    onLaneComplete = null,
  },
  dependencies = runtimeDispatchDependencies(runtime)
) {
  signal?.throwIfAborted()
  const installedRevision = await dependencies.assertInstalledExecutionCurrent({
    contract,
    logger,
  })
  signal?.throwIfAborted()
  const isolation = await dependencies.assertVmIsolationLive({
    config,
    contract,
  })
  signal?.throwIfAborted()
  await dependencies.reconcileOwnedResources?.({ config, contract })
  signal?.throwIfAborted()
  logger.info(
    runtime === null
      ? `instance ${config.vm} re-asserted: no host mounts, no forwarded agent, no host home, no Rosetta`
      : `${runtime.description} re-asserted before dispatch: ${describeIsolation(isolation)}`
  )
  const run = evidence.open({ headSha, profile: profile.profile })
  try {
    writeFileSync(
      join(run.path, "installed-revision.json"),
      `${JSON.stringify(installedRevision, null, 2)}\n`,
      { mode: 0o600 }
    )
    const { runner } = await dependencies.buildDependencies({
      contract,
      config,
      logger,
      headSha,
      runDir: run.path,
      signal,
      runtime,
      evidence,
    })
    signal?.throwIfAborted()
    const outcome = await runner.runProfile({
      profile,
      ref,
      headSha,
      signal,
      writeEnvFile: dependencies.makeEnvFileWriter({ config, headSha, signal }),
      onLaneComplete,
    })
    writeLaneResults({ runDir: run.path, outcome, contract })
    logger.info(
      `evidence in ${run.path} (log digest ${outcome.record.logDigest})`
    )
    return outcome
  } finally {
    try {
      await dependencies.releaseWorkspace({ config, headSha })
    } finally {
      run.close()
    }
  }
}

/**
 * Decide whether a nightly proof is due and, if it is, produce one.
 *
 * Shared by `--nightly` and the schedule the watch agent runs, so the two
 * cannot drift into disagreeing about what "due" means.
 */
export async function nightlyTick({
  contract,
  logger,
  github,
  evidence,
  loadProfileFor,
  dispatch,
  publish = null,
  attempts = null,
  publishPending = null,
  ref = DEFAULT_MAIN_REF,
  now = () => Date.now(),
  runtimeHealth = null,
}) {
  for (const attempt of attempts?.entries ?? []) {
    if (
      attempt.profile === contract.nightlyProof.profile &&
      attempt.status !== "running" &&
      !attempt.published &&
      attempt.publish !== false &&
      publishPending
    ) {
      await publishAttempt(attempts, attempt.id, publishPending)
    }
  }
  let verdict = nightlyRunIsDue({
    lastRunAt: evidence.lastRunAt(contract.nightlyProof.profile),
    now: now(),
    contract,
  })
  const latest = attempts?.entries
    .filter((entry) => entry.profile === contract.nightlyProof.profile)
    .at(-1)
  if (latest && attempts.eligible(latest))
    verdict = {
      due: true,
      reason: "an interrupted nightly attempt is eligible for a bounded retry",
    }
  if (!verdict.due) {
    return Object.freeze({
      ...verdict,
      ran: false,
      headSha: null,
      conclusion: null,
    })
  }
  // Due, but a runtime that cannot take the job gets no job: the nightly
  // stays due and is asked about again on the next interval, and nothing is
  // published for a run that could not have happened.
  const health = runtimeHealth === null ? null : await runtimeHealth()
  if (health !== null && health.healthy !== true) {
    return Object.freeze({
      ...verdict,
      due: true,
      ran: false,
      headSha: null,
      conclusion: null,
      reason: `a nightly proof is due but the runtime cannot take it: ${health.reason ?? "no answer"}`,
    })
  }
  const head = await github.getRef(ref)
  const headSha = String(head.sha).toLowerCase()
  logger.info(
    `nightly proof is due (${verdict.reason}); running the ${contract.nightlyProof.profile} profile for ${headSha}`
  )
  const profile = loadProfileFor(contract.nightlyProof.profile)
  const outcome = await dispatch({ profile, ref: head.ref ?? ref, headSha })
  if (publish) {
    try {
      await publish({ profile, headSha, outcome })
    } catch (error) {
      // A publish failure must not look like a missed run: the lanes ran and
      // the evidence is on disk, so this is loud and the freshness monitor is
      // what escalates if it keeps happening.
      logger.error(
        `the nightly proof for ${headSha} ran but could not be published: ${error.message}`
      )
    }
  }
  return Object.freeze({
    ...verdict,
    ran: true,
    headSha,
    conclusion: outcome.record.conclusion,
  })
}

/**
 * The nightly schedule, running inside the watch agent.
 *
 * Deliberately not a second launchd job: a `StartCalendarInterval` agent skips
 * a window the machine was powered off for, silently, which is precisely the
 * failure the freshness monitor exists to catch. Asking a cheap local question
 * every quarter hour turns every kind of missed window - asleep, logged out,
 * powered off, agent restarted - into a late run instead.
 */
export function createNightlyScheduler({
  logger,
  tick,
  intervalMs = NIGHTLY_CHECK_INTERVAL_MS,
  sleep = null,
}) {
  let stopping = false
  let timer = null
  let notifyStop = null
  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") logger[level](message)
  }
  return Object.freeze({
    async start() {
      stopping = false
      const stopped = new Promise((resolve) => {
        notifyStop = resolve
      })
      const wait =
        sleep ??
        ((ms) =>
          new Promise((resolve) => {
            timer = setTimeout(resolve, ms)
          }))
      log(
        "info",
        `checking every ${Math.round(intervalMs / 60_000)}m whether a nightly proof is due`
      )
      while (!stopping) {
        try {
          const result = await tick()
          if (result.ran) {
            log(
              "info",
              `nightly proof for ${result.headSha}: ${result.conclusion}`
            )
          }
        } catch (error) {
          log("error", `the nightly check failed: ${error.message}`)
        }
        if (stopping) break
        await Promise.race([wait(intervalMs), stopped])
      }
    },
    stop() {
      stopping = true
      if (timer) clearTimeout(timer)
      notifyStop?.()
      notifyStop = null
    },
  })
}

/** Report the VM verdict without deciding on it. Used where a refusal would
 * be worse than a warning: a dry-run preflight an operator runs before the VM
 * exists, and agent startup, where exiting would only make launchd restart
 * into a crash loop. Every real dispatch still refuses. */
async function reportVmIsolation({ runtime, logger }) {
  try {
    const isolation = await runtime.assertIsolationLive()
    logger.info(
      `${runtime.description} is running and still isolated: ${describeIsolation(isolation)}`
    )
    return true
  } catch (error) {
    logger.error(
      `${error.code ?? "VM_UNVERIFIABLE"}: ${error.message}. No job will be dispatched until this is fixed.`
    )
    return false
  }
}

async function runOnce({ contract, config, options, logger }) {
  const headSha = options.sha.toLowerCase()
  const profile = loadProfileChecked(options.profile, contract)
  const runtime = createHostRuntime({ contract, config, logger })
  if (options.dryRun) {
    logger.info(
      `dry run: profile ${profile.profile}, ${profile.lanes.length} lanes, host arch ${processArch}, sha ${headSha}, runtime ${runtime.kind}`
    )
    await reportVmIsolation({ runtime, logger })
    return 0
  }

  const github = hostGitHubClient({ contract, config, logger })
  const evidence = createRunEvidenceStore({ stateRoot: config.stateRoot })
  const journal = createAttemptJournal({
    path: join(config.stateRoot, "attempts.json"),
  })
  const outcome = await executeDurableRun({
    journal,
    profile,
    ref: options.ref,
    headSha,
    dispatch: (args) =>
      dispatchRun({ contract, config, logger, evidence, runtime, ...args }),
    publish: options.publish
      ? durablePublisher({ github, contract, journal })
      : null,
  })
  const summary = renderCheckSummary(outcome.record, contract)
  logger.info(summary.title)
  return outcome.record.conclusion === "success" ? 0 : 1
}

async function runNightlyOnce({ contract, config, options, logger }) {
  const evidence = createRunEvidenceStore({ stateRoot: config.stateRoot })
  const runtime = createHostRuntime({ contract, config, logger })
  if (options.dryRun) {
    const verdict = nightlyRunIsDue({
      lastRunAt: evidence.lastRunAt(contract.nightlyProof.profile),
      now: Date.now(),
      contract,
    })
    logger.info(
      `dry run: a nightly proof is ${verdict.due ? "due" : "not due"} - ${verdict.reason}`
    )
    await reportVmIsolation({ runtime, logger })
    return 0
  }
  const github = hostGitHubClient({ contract, config, logger })
  const journal = createAttemptJournal({
    path: join(config.stateRoot, "attempts.json"),
  })
  const result = await nightlyTick({
    attempts: journal,
    publishPending: options.publish
      ? durablePublisher({ github, contract, journal })
      : null,
    contract,
    logger,
    github,
    evidence,
    ref: options.ref,
    loadProfileFor: (name) => loadProfileChecked(name, contract),
    runtimeHealth: runtimeHealth(runtime),
    dispatch: (args) =>
      executeDurableRun({
        journal,
        ...args,
        dispatch: (request) =>
          dispatchRun({
            contract,
            config,
            logger,
            evidence,
            runtime,
            ...request,
          }),
        publish: options.publish
          ? durablePublisher({ github, contract, journal })
          : null,
      }),
  })
  if (!result.ran) {
    logger.info(`no nightly run: ${result.reason}`)
    return 0
  }
  return result.conclusion === "success" ? 0 : 1
}

async function watch({ contract, config, logger }) {
  const github = hostGitHubClient({ contract, config, logger })
  const pollingGithub = createGitHubClient({
    contract,
    appId: config.appId,
    installationId: config.installationId,
    privateKey: config.privateKey,
    logger,
    maxAttempts: 1,
    fetch: (url, options) =>
      fetch(url, {
        ...options,
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      }),
  })
  const heartbeat =
    contract.agentLiveness?.provider === "github-check"
      ? createGitHubHeartbeat({
          github: createGitHubClient({
            contract,
            appId: config.appId,
            installationId: config.installationId,
            privateKey: config.privateKey,
            logger,
            maxAttempts: 1,
            fetch: (url, options) =>
              fetch(url, {
                ...options,
                redirect: "error",
                signal: AbortSignal.timeout(5_000),
              }),
          }),
          contract,
          logger,
        })
      : createHeartbeat({ url: config.heartbeatUrl, contract, logger })
  if (!heartbeat.enabled) {
    logger.warn(
      "no monitoring heartbeat URL on this host; an agent that stops polling will not raise an alarm (runbook §2.5 step 3)"
    )
  }
  const sleepAssertion = createSleepAssertion({ logger })
  // A second assertion for the nightly rather than sharing the loop's.
  // `release` is unconditional, and the loop acquires *before* it reaches the
  // gate below: one dispatcher releasing the other's assertion would leave a
  // job running with nothing keeping the Mac awake.
  const nightlyAssertion = createSleepAssertion({ logger })
  const nightlyAbort = new AbortController()
  const evidence = createRunEvidenceStore({ stateRoot: config.stateRoot })
  const attempts = createAttemptJournal({
    path: join(config.stateRoot, "attempts.json"),
  })
  const gate = createSerialGate()
  const runtime = createHostRuntime({ contract, config, logger })
  const health = runtimeHealth(runtime)
  const dispatch = (args) =>
    gate.run(() =>
      dispatchRun({ contract, config, logger, evidence, runtime, ...args })
    )
  const nightlyDispatch = (args) =>
    gate.run(async () => {
      nightlyAssertion.acquire()
      try {
        return await executeDurableRun({
          journal: attempts,
          ...args,
          signal: nightlyAbort.signal,
          dispatch: (request) =>
            dispatchRun({
              contract,
              config,
              logger,
              evidence,
              runtime,
              ...request,
            }),
          publish: durablePublisher({ github, contract, journal: attempts }),
        })
      } finally {
        nightlyAssertion.release()
      }
    })

  logger.info(
    `runtime ${runtime.kind}, job image ${config.jobImage} (from ${config.jobImageSource})`
  )
  await reportVmIsolation({ runtime, logger })

  const loop = createLoop({
    attempts,
    contract,
    github: {
      ...github,
      getRef: pollingGithub.getRef,
      listOpenPullRequests: pollingGithub.listOpenPullRequests,
    },
    loadProfile: (name) => loadProfileChecked(name, contract),
    heartbeat,
    sleepAssertion,
    // The retention sweep the contract promises. Without a store the loop's
    // sweep returns 0 on every tick and `agent.logRetentionDays` is a number
    // no code reads, so lane logs accumulate until the disk fills.
    logStore: evidence,
    logger,
    // Built per job: the runner needs a workspace materialised for that head
    // SHA, and there is no useful long-lived runner to hold open between them.
    runner: { runProfile: dispatch },
    // Asked before a queued job is claimed: an unhealthy runtime claims and
    // publishes nothing, and the work starts once it is healthy again.
    runtimeHealth: health,
  })

  const nightly = createNightlyScheduler({
    logger,
    tick: () =>
      nightlyTick({
        attempts,
        publishPending: durablePublisher({
          github,
          contract,
          journal: attempts,
        }),
        contract,
        logger,
        github: { ...github, getRef: pollingGithub.getRef },
        evidence,
        dispatch: nightlyDispatch,
        loadProfileFor: (name) => loadProfileChecked(name, contract),
        runtimeHealth: health,
      }),
  })

  const stop = () => {
    logger.info("stopping after the current tick")
    loop.stop()
    nightlyAbort.abort(new Error("the agent is stopping"))
    nightly.stop()
    nightlyAssertion.release()
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  await Promise.all([loop.start(), nightly.start()])
  return 0
}

export async function main(argv = process.argv.slice(2), env = process.env) {
  const logger = createLogger()
  let options
  try {
    options = parseArgs(argv)
  } catch (error) {
    process.stderr.write(`${error.message}\n\n${USAGE}`)
    return 2
  }
  if (options.help) {
    process.stdout.write(USAGE)
    return 0
  }

  try {
    const contract = loadContract((path) =>
      readFileSync(join(REPO_ROOT, path), "utf8")
    )
    const config = resolveHostConfig({ env, contract, home: homedir() })
    logger.info(
      `contract ${contract.schema}, cutover step ${contract.cutoverStep}, stage ${contract.stage}`
    )
    const lease = options.dryRun
      ? null
      : acquireControllerLease({
          path: join(config.stateRoot, "controller.lock"),
        })
    try {
      if (options.watch) return await watch({ contract, config, logger })
      if (options.nightly) {
        return await runNightlyOnce({ contract, config, options, logger })
      }
      return await runOnce({ contract, config, options, logger })
    } finally {
      lease?.release()
    }
  } catch (error) {
    if (error instanceof LocalCiError) {
      logger.error(`${error.code}: ${error.message}`)
    } else {
      logger.error(error.stack ?? String(error))
    }
    return 1
  }
}

// `pathToFileURL` rather than a `file://` + path concatenation: the install
// root and this repository both contain characters that percent-encode in a
// URL (the checkout lives under ".../LapenInns Project/..."), so the naive
// form never matches and the CLI silently exits 0 without running.
function invokedDirectly() {
  try {
    // Node resolves the entry module through the installer's `current` link.
    return (
      typeof process.argv[1] === "string" &&
      import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href
    )
  } catch {
    return false
  }
}

if (invokedDirectly()) {
  main().then(
    (code) => {
      process.exitCode = code
    },
    (error) => {
      process.stderr.write(`${error.stack ?? String(error)}\n`)
      process.exitCode = 1
    }
  )
}
