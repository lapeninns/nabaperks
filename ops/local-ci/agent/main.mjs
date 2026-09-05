#!/usr/bin/env node
/**
 * The agent's command-line entry point, and the only file in this package that
 * reads `process.env`, touches the filesystem or exits the process.
 *
 * Everything below is composition: it resolves the host's credentials, checks
 * their permissions, builds the injected dependencies, and hands them to the
 * pure core and the runtime modules. Keeping that in one file is what lets the
 * rest of the package be unit-tested with no environment at all - and it is
 * what makes "which code can see the GitHub App private key?" a question with
 * a one-file answer.
 *
 * Usage:
 *
 *   local-ci-agent --watch
 *   local-ci-agent --profile pr --ref refs/pull/12/head --sha <40 hex>
 *   local-ci-agent --profile main --ref refs/heads/main --sha <40 hex> --dry-run
 *
 * Exit status is 0 only when the requested work completed and, for a one-shot
 * run, concluded successfully.
 */

import { spawn } from "node:child_process"
import { randomBytes } from "node:crypto"
import {
  closeSync,
  fstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
  appendFileSync,
} from "node:fs"
import { homedir } from "node:os"
import { dirname, join, resolve as resolvePath } from "node:path"
import { arch as processArch } from "node:process"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  LocalCiError,
  describeValue,
  loadContract,
  quoteForMessage,
} from "../core/contract.mjs"
import { loadProfile, snapshotGuardViolations } from "../core/profiles.mjs"
import { isCommitSha } from "../core/queue.mjs"
import { renderCheckSummary } from "../core/summary.mjs"
import { createContainerRuntime } from "./container.mjs"
import { createGitHubClient } from "./github.mjs"
import { createHeartbeat } from "./heartbeat.mjs"
import { createLoop, createSleepAssertion } from "./loop.mjs"
import { createRunner, createRuntimeEnvResolver } from "./runner.mjs"

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
  --profile <name>        one-shot: pr | main | nightly
  --ref <ref>             one-shot: the git ref, e.g. refs/heads/main
  --sha <sha>             one-shot: the 40-character head commit SHA
  --dry-run               resolve everything and print the plan, run nothing
  --no-publish            run locally but publish no check run
  --help                  this text

Host configuration (environment first, then a file under the state root):

  LOCAL_CI_GITHUB_APP_ID              GitHub App id
  LOCAL_CI_GITHUB_INSTALLATION_ID     installation id
  LOCAL_CI_GITHUB_APP_PRIVATE_KEY     PEM contents (a path is used otherwise)
  LOCAL_CI_HEARTBEAT_URL              monitoring heartbeat URL
  LOCAL_CI_JOB_IMAGE                  the pinned job image tag
  LOCAL_CI_DIND_IMAGE                 the pinned sidecar daemon image tag
  NABAPERKS_LOCAL_CI_HOME             state root (default ~/.nabaperks-local-ci)
  NABAPERKS_LOCAL_CI_VM               Lima instance (default from the contract)
`

/** Parse argv into an options record. Pure. */
export function parseArgs(argv) {
  const options = {
    watch: false,
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
  if (options.watch && options.profile) {
    throw new CliError(
      "INVALID_ARGUMENTS",
      "--watch and --profile are different modes; pass one or the other"
    )
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

  const jobImage = env.LOCAL_CI_JOB_IMAGE ?? null
  if (jobImage === null) {
    throw new CliError(
      "MISSING_JOB_IMAGE",
      "LOCAL_CI_JOB_IMAGE is unset. It is the pinned tag of the image built from a verified main commit inside the VM (ops/local-ci/host/README.md §3), e.g. nabaperks-ci-job:<commit sha>."
    )
  }

  return Object.freeze({
    stateRoot,
    privateKey,
    privateKeyPath,
    heartbeatUrl,
    appId,
    installationId,
    jobImage,
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
 * `git`, `docker` and `curl` are documented tools of this plane but are absent
 * here on purpose: they run *inside* the VM, as words in a script that
 * `/bin/sh` or `limactl shell` interprets, and `container.mjs` owns the
 * `docker` argv it spawns. Nothing in this file ever names them as a host
 * executable, so admitting them here would widen the allowlist past its only
 * two real call sites.
 *
 * Entries are matched whole. A basename match would accept `/tmp/x/limactl`,
 * which is the attack this exists to stop.
 */
export const PERMITTED_HOST_EXECUTABLES = Object.freeze(["/bin/sh", "limactl"])

/**
 * Check one argv and return the *allowlist's own* string for its executable.
 *
 * Returning the matched constant rather than `argv[0]` is the point: what
 * reaches `spawn` is then one of the two literals above by construction, not a
 * caller-supplied value that merely compared equal to one.
 */
export function permittedExecutable(argv) {
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
  const executable = PERMITTED_HOST_EXECUTABLES.find((name) => name === argv[0])
  if (executable === undefined) {
    throw new CliError(
      "EXECUTABLE_NOT_PERMITTED",
      `this agent may not run ${JSON.stringify(argv[0])} on the host; the permitted executables are ${PERMITTED_HOST_EXECUTABLES.join(", ")}`
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
  { input = null, timeoutMs = 600_000, cwd = undefined } = {}
) {
  const executable = permittedExecutable(argv)
  return new Promise((resolveExec, rejectExec) => {
    const child = spawn(executable, argv.slice(1), {
      cwd,
      stdio: [input === null ? "ignore" : "pipe", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs)
    timer.unref?.()
    child.stdout?.on("data", (chunk) => {
      stdout += chunk.toString("utf8")
    })
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString("utf8")
    })
    child.once("error", (error) => {
      clearTimeout(timer)
      rejectExec(error)
    })
    child.once("close", (code) => {
      clearTimeout(timer)
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
      child.stdin.end(input)
    }
  })
}

/**
 * Quote one value for POSIX `sh`.
 *
 * The scripts below are assembled as text and handed to `/bin/sh -c`, so every
 * interpolated value is shell syntax until it is quoted. The inputs are not
 * arbitrary - a head SHA is validated as 40 hex, a lane id comes from a
 * reviewed profile - but "currently well-formed" is not a security boundary:
 * this agent exists to run pull-request code, and the remote URL, the
 * workspace root and the VM name all reach here from a contract file or the
 * environment. Quoting at the seam means a future caller cannot turn a value
 * into a command by accident.
 *
 * Single quotes are literal in `sh` for every character except the single
 * quote itself, which is closed, escaped and reopened.
 */
export function shQuote(value) {
  const text = String(value)
  if (text === "") return "''"
  return `'${text.replace(/'/g, `'\\''`)}'`
}

const vmShell = (vm, script) =>
  vm === null
    ? ["/bin/sh", "-c", script]
    : ["limactl", "shell", vm, "--", "/bin/sh", "-c", script]

/**
 * Materialise the commit inside the VM as a detached worktree.
 *
 * `agent.gitFetchDepth` is 0 - a full clone - because the quality lane's
 * `docs:check` ends in `git diff --exit-code`, which a shallow tree cannot
 * answer. The clone lives in the VM, which has no mounts back to the Mac.
 */
async function prepareWorkspace({ config, contract, headSha, logger }) {
  const root = config.vmWorkspaceRoot
  const mirror = `${root}/repo`
  const worktree = `${root}/runs/${headSha}`
  logger.info(`preparing ${worktree} inside the VM`)
  const script = [
    "set -eu",
    `mkdir -p ${shQuote(`${root}/runs`)}`,
    `if [ ! -d ${shQuote(`${mirror}/.git`)} ]; then git clone ${shQuote(contract.remoteUrl)} ${shQuote(mirror)}; fi`,
    `cd ${shQuote(mirror)}`,
    `git remote set-url origin ${shQuote(contract.remoteUrl)}`,
    "git fetch --prune --tags origin",
    `git worktree remove --force ${shQuote(worktree)} 2>/dev/null || true`,
    `rm -rf ${shQuote(worktree)}`,
    `git worktree add --force --detach ${shQuote(worktree)} ${shQuote(headSha)}`,
  ].join("\n")
  await execHost(vmShell(config.vm, script))
  return worktree
}

async function releaseWorkspace({ config, headSha }) {
  const root = config.vmWorkspaceRoot
  const script = [
    `cd ${shQuote(`${root}/repo`)} 2>/dev/null || exit 0`,
    `git worktree remove --force ${shQuote(`${root}/runs/${headSha}`)} 2>/dev/null || true`,
    `rm -rf ${shQuote(`${root}/runs/${headSha}`)}`,
  ].join("\n")
  await execHost(vmShell(config.vm, script)).catch(() => {})
}

/** Per-run evidence directory on the Mac, mode 0700. */
function openRunDirectory({ config, headSha }) {
  const dir = join(config.stateRoot, "runs", headSha)
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  return dir
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

/**
 * Write a lane's environment to a file inside the VM at mode 0600.
 *
 * A file rather than `--env NAME=VALUE`: process arguments are readable by
 * every process on the VM through `ps`, and the runtime fixtures a lane needs
 * are not worth publishing that way even though none of them is a host secret.
 */
function makeEnvFileWriter({ config, headSha }) {
  return async (lane, env) => {
    const path = `${config.vmWorkspaceRoot}/runs/${headSha}/.env.${lane.id}`
    const body = Object.entries(env)
      .map(([name, value]) => `${name}=${value}`)
      .join("\n")
    await execHost(vmShell(config.vm, `umask 077; cat > ${shQuote(path)}`), {
      input: `${body}\n`,
    })
    return path
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

/* -------------------------------------------------------------------- main */

async function buildDependencies({ contract, config, logger, headSha }) {
  const github = createGitHubClient({
    contract,
    appId: config.appId,
    installationId: config.installationId,
    privateKey: config.privateKey,
    logger,
  })
  const containerRuntime = createContainerRuntime({
    contract,
    vm: config.vm,
    logger,
  })
  const resolveRuntimeEnv = createRuntimeEnvResolver({
    contract,
    exec: (command) =>
      execHost(["/bin/sh", "-c", command], {
        timeoutMs: 120_000,
        cwd: REPO_ROOT,
      }),
    randomBytes,
  })
  const workspaceHostPath = await prepareWorkspace({
    config,
    contract,
    headSha,
    logger,
  })
  const runner = createRunner({
    contract,
    containerRuntime,
    resolveRuntimeEnv,
    openLaneLog: makeLaneLogOpener(openRunDirectory({ config, headSha })),
    hostEnv: process.env,
    arch: processArch,
    image: config.jobImage,
    daemonImage: config.daemonImage,
    workspaceHostPath,
    logger,
  })
  return { github, runner, containerRuntime }
}

async function runOnce({ contract, config, options, logger }) {
  const headSha = options.sha.toLowerCase()
  const profile = loadProfile(options.profile, contract, (path) =>
    readFileSync(join(REPO_ROOT, path), "utf8")
  )
  const violations = snapshotGuardViolations(profile, contract)
  if (violations.length > 0) {
    throw new CliError(
      "SNAPSHOT_GUARD_VIOLATION",
      `profile ${options.profile} would let a local ARM64 run touch a pixel baseline:\n  ${violations.join("\n  ")}`
    )
  }
  if (options.dryRun) {
    logger.info(
      `dry run: profile ${profile.profile}, ${profile.lanes.length} lanes, host arch ${processArch}, sha ${headSha}`
    )
    return 0
  }

  const runDir = openRunDirectory({ config, headSha })
  const { github, runner } = await buildDependencies({
    contract,
    config,
    logger,
    headSha,
  })
  try {
    const outcome = await runner.runProfile({
      profile,
      ref: options.ref,
      headSha,
      writeEnvFile: makeEnvFileWriter({ config, headSha }),
    })
    writeLaneResults({ runDir, outcome, contract })
    const summary = renderCheckSummary(outcome.record, contract)
    logger.info(summary.title)
    if (options.publish) {
      await github.createCheckRun({
        name:
          profile.profile === "nightly"
            ? contract.nightlyCheckName
            : contract.checkName,
        headSha,
        status: "completed",
        conclusion: outcome.record.conclusion,
        startedAt: outcome.startedAt,
        completedAt: outcome.completedAt,
        output: summary,
      })
    }
    logger.info(
      `evidence in ${runDir} (log digest ${outcome.record.logDigest})`
    )
    return outcome.record.conclusion === "success" ? 0 : 1
  } finally {
    await releaseWorkspace({ config, headSha })
  }
}

async function watch({ contract, config, logger }) {
  const github = createGitHubClient({
    contract,
    appId: config.appId,
    installationId: config.installationId,
    privateKey: config.privateKey,
    logger,
  })
  const heartbeat = createHeartbeat({
    url: config.heartbeatUrl,
    contract,
    logger,
  })
  if (!heartbeat.enabled) {
    logger.warn(
      "no monitoring heartbeat URL on this host; an agent that stops polling will not raise an alarm (runbook §2.5 step 3)"
    )
  }
  const sleepAssertion = createSleepAssertion({ logger })

  const loop = createLoop({
    contract,
    github,
    loadProfile: (name) =>
      loadProfile(name, contract, (path) =>
        readFileSync(join(REPO_ROOT, path), "utf8")
      ),
    heartbeat,
    sleepAssertion,
    logger,
    // Built per job: the runner needs a workspace materialised for that head
    // SHA, and there is no useful long-lived runner to hold open between them.
    runner: {
      async runProfile({ profile, ref, headSha }) {
        const runDir = openRunDirectory({ config, headSha })
        const { runner } = await buildDependencies({
          contract,
          config,
          logger,
          headSha,
        })
        try {
          const outcome = await runner.runProfile({
            profile,
            ref,
            headSha,
            writeEnvFile: makeEnvFileWriter({ config, headSha }),
          })
          writeLaneResults({ runDir, outcome, contract })
          return outcome
        } finally {
          await releaseWorkspace({ config, headSha })
        }
      },
    },
  })

  const stop = () => {
    logger.info("stopping after the current tick")
    loop.stop()
  }
  process.once("SIGINT", stop)
  process.once("SIGTERM", stop)
  await loop.start()
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
    return options.watch
      ? await watch({ contract, config, logger })
      : await runOnce({ contract, config, options, logger })
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
const invokedDirectly =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(process.argv[1]).href

if (invokedDirectly) {
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
