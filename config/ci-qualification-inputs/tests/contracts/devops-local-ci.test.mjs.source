import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

function read(path) {
  return readFileSync(path, "utf8")
}

function readJson(path) {
  return JSON.parse(read(path))
}

/**
 * `value` as a pattern that matches it literally.
 *
 * Every regular expression below is built by interpolating contract data, and
 * contract data is text: a `.` in a script path, a `(` in a check name, a `+`
 * in a version. Unescaped, those are operators - so the assertion either
 * throws on an invalid pattern or, worse, passes against text the contract
 * does not actually name. Escaping only the dot, which is what this file used
 * to do, covers exactly one of the metacharacters.
 */
function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

const CONTRACT_PATH = "config/local-ci-contract.json"
const CI_PATH = ".github/workflows/ci.yml"
const PROFILE_NAMES = ["pr", "main", "nightly"]
const PROFILE_PATHS = Object.freeze({
  pr: "ops/local-ci/profiles/pr.json",
  main: "ops/local-ci/profiles/main.json",
  nightly: "ops/local-ci/profiles/nightly.json",
})

/**
 * Every job id `.github/workflows/ci.yml` declared before the local CI plane
 * existed, in file order. The redesign preserves their workloads while moving
 * advisory observation into its own bounded workflow.
 */
const HOSTED_JOBS = Object.freeze([
  "selection",
  "documentation",
  "targeted-browser",
  "targeted-visual",
  "selection-comparison",
  "fast",
  "quality",
  "build",
  "build-gate",
  "e2e",
  "e2e-gate",
  "a11y",
  "a11y-gate",
  "visual",
  "visual-gate",
  "lighthouse",
  "lighthouse-gate",
  "zap-baseline",
  "db",
  "db-gate",
  "release-gate",
])

/**
 * The text of one job, bounded at both ends.
 *
 * `indexOf` alone is not safe here: it returns -1 for a job that was renamed
 * or deleted, and `slice(-1)` then yields the last character of the file, so a
 * "must not contain" assertion passes vacuously. It is also not enough to
 * slice only from the start, because cutover step 1 appends the bridge job
 * after `release-gate` — an unbounded slice would carry a foreign job body
 * (and its comments) into every assertion about the last real job.
 *
 * Job bodies are indented four spaces or more, so the first following line
 * indented exactly two spaces is the end of this job, whether that line is the
 * next job id or a comment introducing it.
 */
function jobSlice(text, jobId) {
  const anchor = `\n  ${jobId}:\n`
  const start = text.indexOf(anchor)
  assert.notEqual(start, -1, `${CI_PATH} must declare a "${jobId}" job`)
  const body = text.slice(start + anchor.length)
  const next = body.search(/\n {2}\S/)
  const end = next === -1 ? body.length : next
  assert.ok(end > 0, `the "${jobId}" job body must not be empty`)
  return anchor + body.slice(0, end)
}

/** Job ids declared under `jobs:`, in file order. */
function declaredJobIds(text) {
  const marker = "\njobs:\n"
  const start = text.indexOf(marker)
  assert.notEqual(start, -1, `${CI_PATH} must declare a jobs mapping`)
  const section = text.slice(start + marker.length - 1)
  return [...section.matchAll(/\n {2}([a-z][a-z0-9-]*):\n/g)].map(
    (match) => match[1]
  )
}

/** Every command string a lane executes, including teardown and services. */
function laneCommands(lane) {
  return [
    ...lane.commands,
    ...(lane.teardownCommands ?? []),
    ...(lane.backgroundServices ?? []).map((service) => service.command),
  ]
}

/** Every regular file under `root`, as repository-relative paths. */
function filesUnder(root) {
  return readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .sort()
}

/**
 * The VM layers the agent can dispatch into.
 *
 * `lima` is the dedicated `nabaperks-ci` VM with `mounts: []`. `docker-desktop`
 * is the operator's Docker Desktop engine, whose VM is shared with other
 * worktrees' containers. The owner accepted that weaker isolation on
 * 2026-09-28; the pins below are what the move keeps in exchange.
 */
const RUNTIME_KINDS = Object.freeze(["lima", "docker-desktop"])
const DOCKER_DESKTOP_ADAPTER = "ops/local-ci/agent/runtime-docker-desktop.mjs"
const DOCKER_DESKTOP_CONTEXT = "desktop-linux"

/**
 * Which runtime the contract selects.
 *
 * A contract without a `runtime` block predates the adapter, and the only VM
 * layer it can mean is Lima, so it gets every Lima pin. Once the Docker Desktop
 * adapter exists, that default would let a deleted block silently switch the
 * pins back, so from then on the choice must be spelled out.
 */
function runtimeKind(contract) {
  if (contract.runtime === undefined) {
    assert.ok(
      !existsSync(DOCKER_DESKTOP_ADAPTER),
      `${CONTRACT_PATH} must declare runtime.kind once ${DOCKER_DESKTOP_ADAPTER} exists`
    )
    return "lima"
  }
  assert.equal(typeof contract.runtime, "object")
  assert.notEqual(contract.runtime, null)
  assert.ok(
    RUNTIME_KINDS.includes(contract.runtime.kind),
    `runtime.kind must be one of ${RUNTIME_KINDS.join(", ")} (received ${JSON.stringify(contract.runtime.kind)})`
  )
  return contract.runtime.kind
}

/** Lanes whose commands drive Playwright, in profile order. */
function browserLanes(profile) {
  return profile.lanes.filter((lane) =>
    laneCommands(lane).some((command) =>
      /playwright|test:e2e|test:a11y/.test(command)
    )
  )
}

test("the local CI contract pins the numbers the whole plane is built around", () => {
  const contract = readJson(CONTRACT_PATH)

  assert.equal(contract.schema, "nabaperks.local-ci.v1")
  assert.equal(contract.checkName, "Nabaperks Local CI")
  assert.equal(contract.allowedHeadRepository, "lapeninns/nabaperks")
  assert.equal(contract.repository, "lapeninns/nabaperks")
  assert.equal(contract.cutoverStep, 1)
  assert.equal(contract.stage, "bridge-shadow")

  // Concurrency, cadence and retention live under `agent`. Asserting the
  // absence of top-level twins keeps a future "helpful" duplicate from
  // silently becoming the value some reader picks up.
  assert.equal(contract.agent.maxConcurrentJobs, 1)
  assert.equal(contract.agent.pollIntervalSeconds, 60)
  assert.equal(contract.agent.logRetentionDays, 30)
  assert.equal(contract.maxConcurrentJobs, undefined)
  assert.equal(contract.pollIntervalSeconds, undefined)
  assert.equal(contract.logRetentionDays, undefined)
  assert.ok(
    contract.agent.maxConcurrentLanes > contract.agent.maxConcurrentJobs,
    "lanes fan out inside one run; jobs do not"
  )
  assert.equal(contract.evidence.retentionDays, contract.agent.logRetentionDays)

  assert.equal(contract.bridge.timeoutMinutes, 120)
  assert.equal(contract.bridge.pollIntervalSeconds, 30)
  assert.equal(contract.nightlyProof.maxAgeHours, 36)

  assert.equal(contract.container.mountHostDockerSocket, false)
  // Docker-in-Docker needs a privileged sidecar. Inside the dedicated Lima VM
  // that privilege reaches nothing of the Mac's; on the shared Docker Desktop
  // VM it would hand candidate code that VM's kernel, its file shares and
  // other worktrees' containers, so that runtime has no daemon at all.
  assert.equal(
    contract.container.dockerInDocker,
    runtimeKind(contract) === "lima"
  )
  assert.ok(
    contract.container.timeoutMinutes < contract.bridge.timeoutMinutes,
    "the container ceiling must sit inside the bridge ceiling so a hang is reported rather than timed out"
  )

  assert.ok(Array.isArray(contract.hostSecrets))
  assert.ok(contract.hostSecrets.length > 0)
  for (const name of contract.hostSecrets) {
    assert.equal(typeof name, "string")
    assert.notEqual(name.trim(), "")
  }
  assert.ok(contract.hostSecrets.includes("LOCAL_CI_GITHUB_APP_PRIVATE_KEY"))
  assert.equal(contract.hostSecretsPolicy.neverEnterContainer, true)
  assert.equal(contract.hostSecretsPolicy.fileMode, "0600")

  // The App is scoped by data, and the sole non-GET Actions call is named.
  assert.deepEqual(Object.keys(contract.githubApp.permissions).sort(), [
    "actions",
    "checks",
    "contents",
    "metadata",
    "pull_requests",
  ])
  assert.equal(contract.githubApp.permissions.contents, "read")
  assert.equal(contract.githubApp.permissions.pull_requests, "read")
  assert.deepEqual(contract.githubApp.allowedActionsWriteOperations, [
    "rerun-failed-jobs",
  ])
})

test("hosted proof is complete and shadow observation cannot hold release open", () => {
  const contract = readJson(CONTRACT_PATH)
  const ci = read(CI_PATH)
  const shadow = read(contract.bridge.workflow)
  const bridgeJob = contract.bridge.job

  // 1. The contract itself says the bridge is inert.
  assert.equal(contract.bridge.enforcement, "advisory")
  assert.equal(contract.bridge.requiredCheck, false)
  assert.deepEqual(contract.bridge.dependents, [])
  assert.equal(contract.shadowMode.enabled, true)
  assert.equal(contract.shadowMode.flipsAtCutoverStep, 3)
  assert.equal(contract.nightlyProof.enforcement, "advisory")

  // The whole CI workflow contains only hosted proof; observation is separate.
  assert.deepEqual(declaredJobIds(ci), HOSTED_JOBS)
  assert.equal(
    contract.bridge.workflow,
    ".github/workflows/local-ci-shadow.yml"
  )
  assert.deepEqual(declaredJobIds(shadow), [bridgeJob])
  for (const job of HOSTED_JOBS) {
    assert.match(
      ci,
      new RegExp(`\\n {2}${escapeRegExp(job)}:\\n`),
      `${CI_PATH} must still declare the ${job} job`
    )
  }

  // All existing workload roots are required; no local observation is evidence.
  const releaseGate = jobSlice(ci, "release-gate")
  assert.match(releaseGate, /\n {4}name: Release gate\n/)
  const needsBlock = releaseGate.match(
    /\n {4}needs:\n((?: {6}- [a-z][a-z0-9-]*\n)+)/
  )
  assert.ok(needsBlock, "release-gate must declare a block-form needs list")
  assert.deepEqual(
    needsBlock[1]
      .trim()
      .split("\n")
      .map((line) => line.trim().replace(/^- /, "")),
    [
      "fast",
      "quality",
      "build",
      "e2e",
      "a11y",
      "visual",
      "lighthouse",
      "zap-baseline",
      "db",
      "selection",
      "documentation",
      "targeted-browser",
      "targeted-visual",
      "selection-comparison",
    ]
  )
  assert.match(releaseGate, /CI_REQUIRED_EVIDENCE: \$\{\{ toJSON\(needs\) \}\}/)
  assert.match(releaseGate, /node scripts\/ci\/verify-impact-evidence\.mjs/)
  assert.doesNotMatch(releaseGate, /continue-on-error/)
  for (const job of HOSTED_JOBS)
    assert.doesNotMatch(jobSlice(ci, job), /continue-on-error/)
  assert.doesNotMatch(releaseGate, new RegExp(escapeRegExp(bridgeJob)))

  // 4. No job anywhere lists the bridge in `needs:`. The positive control
  //    proves the two forms a dependency can take are the forms searched for.
  assert.match(ci, /\n {6}- fast\n/)
  assert.match(ci, /\n {4}needs: \[selection, fast\]\n/)
  assert.doesNotMatch(ci, new RegExp(`\\n {6}- ${escapeRegExp(bridgeJob)}\\n`))
  assert.doesNotMatch(
    ci,
    new RegExp(`needs: [^\\n]*${escapeRegExp(bridgeJob)}`)
  )
  assert.doesNotMatch(ci, new RegExp(`needs\\.${escapeRegExp(bridgeJob)}\\.`))

  // 5. The bridge job exists, is advisory in the workflow as well as in the
  //    contract, depends on nothing, and holds no write permission.
  const occurrences = shadow.split(`\n  ${bridgeJob}:\n`).length - 1
  assert.equal(occurrences, 1, `${bridgeJob} must be declared exactly once`)
  const bridge = jobSlice(shadow, bridgeJob)
  assert.match(
    bridge,
    new RegExp(`\\n {4}name: ${escapeRegExp(contract.bridge.checkName)}\\n`)
  )
  assert.match(bridge, /\n {4}continue-on-error: true\n/)
  assert.match(
    bridge,
    new RegExp(
      `\\n {4}timeout-minutes: ${escapeRegExp(contract.bridge.observationTimeoutMinutes)}\\n`
    )
  )
  assert.match(bridge, new RegExp(escapeRegExp(contract.bridge.script)))
  assert.match(bridge, /LOCAL_CI_OBSERVE_ONCE: "true"/)
  assert.equal(contract.bridge.observationTimeoutMinutes, 2)
  const database = read(".github/workflows/production-database.yml")
  assert.match(database, /workflows: \["CI"\]/)
  assert.match(database, /require_successful_workflow ci\.yml 1/)
  assert.match(database, /require_successful_workflow codeql\.yml 60/)
  assert.doesNotMatch(database, /local-ci-shadow|Local CI shadow observation/)
  assert.doesNotMatch(bridge, /\n {4}needs:/)
  assert.match(bridge, /\n {6}checks: read\n/)
  assert.match(bridge, /\n {6}contents: read\n/)
  assert.doesNotMatch(bridge, /: write\n/)
  // Fork pull requests never reach the local plane, and an unprovisioned
  // plane costs no runner minutes.
  assert.match(bridge, /head\.repo\.full_name == github\.repository/)
  assert.match(bridge, /vars\.LOCAL_CI_MODE/)
  // The head-SHA rule the contract describes is the expression actually wired.
  assert.match(bridge, /github\.event\.pull_request\.head\.sha/)
  assert.match(bridge, /github\.sha/)
  assert.match(contract.bridge.headShaRule, /pull_request/)
  assert.match(contract.bridge.headShaRule, /GITHUB_SHA/)

  // 6. The poller the job runs exists and is the file the contract names.
  const poller = read(contract.bridge.script)
  assert.match(poller, /decideBridgeAction/)
  assert.match(poller, /shadowMode/)
})

test("each execution profile declares an ordered, executable lane list", () => {
  const contract = readJson(CONTRACT_PATH)
  assert.deepEqual(contract.archValues, ["any", "x64-only"])

  for (const name of PROFILE_NAMES) {
    const path = PROFILE_PATHS[name]
    assert.equal(
      contract.profiles[name],
      path,
      `the contract must point ${name} at ${path}`
    )

    const profile = readJson(path)
    assert.equal(profile.schema, contract.profileSchema)
    assert.equal(profile.schema, "nabaperks.local-ci-profile.v1")
    assert.equal(profile.profile, name)
    assert.ok(Array.isArray(profile.lanes))
    assert.ok(
      profile.lanes.length > 0,
      `${name} must declare at least one lane`
    )

    const ids = profile.lanes.map((lane) => lane.id)
    assert.deepEqual(
      ids,
      [...new Set(ids)],
      `${name} lane ids must be unique and ordered`
    )

    for (const lane of profile.lanes) {
      const where = `${name}/${lane.id}`
      assert.equal(typeof lane.id, "string")
      assert.notEqual(lane.id.trim(), "", `${where} needs an id`)
      assert.ok(Array.isArray(lane.commands), `${where} needs commands`)
      assert.ok(lane.commands.length > 0, `${where} must run something`)
      for (const command of lane.commands) {
        assert.equal(typeof command, "string", `${where} command must be text`)
        assert.notEqual(command.trim(), "", `${where} has an empty command`)
      }
      assert.ok(
        contract.archValues.includes(lane.arch),
        `${where} arch must be one of ${contract.archValues.join(", ")} (received ${JSON.stringify(lane.arch)})`
      )
      assert.equal(typeof lane.timeoutMinutes, "number")
      assert.ok(lane.timeoutMinutes > 0, `${where} needs a positive timeout`)
      assert.equal(
        lane.continueOnError,
        false,
        `${where} must fail its run rather than warn`
      )
    }
  }

  // pr and main are deliberately the same suite: a commit that was green as a
  // pull request must not meet a different bar once it is on main.
  assert.deepEqual(
    readJson(PROFILE_PATHS.pr).lanes,
    readJson(PROFILE_PATHS.main).lanes
  )
})

test("visual regression stays hosted: no local lane can read or write a pixel baseline", () => {
  const contract = readJson(CONTRACT_PATH)
  const guard = contract.snapshotGuard

  assert.equal(guard.enabled, true)
  // The reason is recorded as data, not just as prose in a runbook: the whole
  // guard rests on Playwright's {platform} token carrying only
  // process.platform, so "-linux" is the same filename on x64 and ARM64.
  assert.match(guard.reason, /process\.platform/)
  assert.match(guard.reason, /ARM64/)
  assert.match(guard.reason, /-linux/)
  assert.ok(Array.isArray(guard.layers) && guard.layers.length > 0)
  assert.deepEqual(guard.forbiddenCommandSubstrings, [
    "-u ",
    "--update-snapshots",
    "test:visual",
  ])
  assert.equal(guard.mutationCheck.mustBeEmpty, true)
  assert.match(guard.mutationCheck.command, /git status --porcelain/)
  assert.match(guard.mutationCheck.command, /-snapshots/)

  let playwrightInvocations = 0
  for (const name of PROFILE_NAMES) {
    const profile = readJson(PROFILE_PATHS[name])
    for (const lane of profile.lanes) {
      for (const command of laneCommands(lane)) {
        const where = `${name}/${lane.id}: ${command}`
        for (const forbidden of guard.forbiddenCommandSubstrings) {
          assert.ok(
            !command.includes(forbidden),
            `${where} must not contain ${JSON.stringify(forbidden)}`
          )
        }
        if (!/playwright|test:e2e|test:a11y/.test(command)) continue
        playwrightInvocations += 1
        assert.ok(
          command.includes("--grep-invert @visual"),
          `${where} must carry --grep-invert @visual`
        )
        assert.ok(
          command.includes("--ignore-snapshots"),
          `${where} must carry --ignore-snapshots`
        )
      }
    }
  }
  // Positive control: the loop above passes vacuously if no profile invokes
  // Playwright at all. Every browser lane shards 1/8..8/8 across three
  // profiles, so the real number is comfortably into three figures.
  assert.ok(
    playwrightInvocations >= 100,
    `expected the profiles to invoke Playwright many times, saw ${playwrightInvocations}`
  )

  // The hosted tier that owns pixels is untouched by this pass.
  const ci = read(".github/workflows/ci.yml")
  const visual = jobSlice(ci, "visual")
  assert.match(visual, /pnpm test:visual/)
  assert.doesNotMatch(visual, /--ignore-snapshots/)
  assert.match(guard.notes, /untouched by cutover step 1/)
})

test("the nightly profile is a strict superset of main", () => {
  const mainIds = readJson(PROFILE_PATHS.main).lanes.map((lane) => lane.id)
  const nightly = readJson(PROFILE_PATHS.nightly)
  const nightlyIds = nightly.lanes.map((lane) => lane.id)

  for (const id of mainIds) {
    assert.ok(nightlyIds.includes(id), `nightly must still run the ${id} lane`)
  }
  assert.deepEqual(
    nightlyIds.filter((id) => !mainIds.includes(id)),
    ["mutation", "load", "db-stress", "zap-full"]
  )

  const lane = (id) => nightly.lanes.find((candidate) => candidate.id === id)
  assert.match(lane("mutation").commands.join("\n"), /mutation:check/)
  assert.match(lane("load").commands.join("\n"), /k6 run tests\/load\//)
  assert.match(lane("db-stress").commands.join("\n"), /db:reseed:stress/)
  assert.match(lane("db-stress").commands.join("\n"), /perf:stress/)
  assert.match(lane("zap-full").commands.join("\n"), /zap-full-scan\.py/)

  // ZAP's published image has no ARM64 build, so that one lane is the only
  // thing in the plan that cannot run on this VM.
  assert.equal(lane("zap-full").arch, "x64-only")
  for (const name of PROFILE_NAMES) {
    const profile = readJson(PROFILE_PATHS[name])
    assert.deepEqual(
      profile.lanes
        .filter((entry) => entry.arch === "x64-only")
        .map((e) => e.id),
      name === "nightly" ? ["zap-full"] : []
    )
  }
})

test("no local CI contract or profile file carries a credential-shaped literal", () => {
  const paths = [CONTRACT_PATH, ...PROFILE_NAMES.map((n) => PROFILE_PATHS[n])]
  const forbidden = [
    /whsec_/,
    /sk_live_/,
    /re_[A-Za-z0-9]{16,}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /github_pat_[A-Za-z0-9_]{20,}/,
  ]

  for (const path of paths) {
    const source = read(path)
    for (const pattern of forbidden) {
      assert.doesNotMatch(source, pattern, `${path} must carry no ${pattern}`)
    }
  }

  // Positive controls, so a renamed field cannot satisfy the negatives above
  // by simply removing the surface they guard.
  for (const name of PROFILE_NAMES) {
    const profile = readJson(PROFILE_PATHS[name])
    assert.match(
      profile.baselineEnv.STRIPE_SECRET_KEY,
      /^sk_test_/,
      `${name} must still set a Stripe key, and it must be test-mode`
    )
    assert.equal(typeof profile.baselineEnv.RESEND_API_KEY, "string")
    assert.notEqual(profile.baselineEnv.RESEND_API_KEY.trim(), "")
    for (const name_ of readJson(CONTRACT_PATH).hostSecrets) {
      assert.ok(
        !read(PROFILE_PATHS[name]).includes(name_),
        `${name} must not name the host secret ${name_}`
      )
    }
  }

  const contract = readJson(CONTRACT_PATH)
  const sources = contract.runtimeEnv.sources
  const hook = sources.find((source) => source.id === "auth-hook-fixture")
  assert.ok(hook, "the auth-hook fixture must be minted at run time")
  assert.equal(hook.kind, "generated")
  assert.equal(hook.generator, "standard-webhook-secret")
  assert.deepEqual(hook.provides, ["SUPABASE_SEND_EMAIL_HOOK_SECRET"])
  const strict = sources.find((source) => source.id === "strict-fixtures")
  assert.ok(strict, "the strict production-profile values must be minted too")
  assert.ok(strict.provides.includes("CUSTOMER_SESSION_SECRET"))
  // The private key is referenced by path and mode, never by content.
  assert.match(contract.githubApp.privateKeyPath, /^~\/\.nabaperks-local-ci\//)
  assert.equal(contract.githubApp.privateKeyMode, "0600")
})

test("no lane that needs a Docker daemon runs locally without a dedicated VM", () => {
  const contract = readJson(CONTRACT_PATH)
  const kind = runtimeKind(contract)
  const expected = { pr: ["db"], main: ["db"], nightly: ["db", "db-stress"] }

  for (const name of PROFILE_NAMES) {
    const profile = readJson(PROFILE_PATHS[name])
    const daemonLanes = profile.lanes.filter(
      (lane) => lane.needsDaemon === true && lane.arch !== "x64-only"
    )
    // Positive control: the lanes below are exactly the database lanes, so a
    // renamed flag cannot make the hosted-only rule pass by matching nothing.
    assert.deepEqual(
      daemonLanes.map((lane) => lane.id),
      expected[name]
    )
    if (kind === "lima") continue
    for (const lane of daemonLanes) {
      assert.ok(
        Array.isArray(lane.requires) &&
          lane.requires.includes("privileged-daemon"),
        `${name}/${lane.id} must require privileged-daemon so the Docker Desktop runtime reports it hosted-only`
      )
    }
  }
  if (kind === "lima") return

  // The requirement is routed to hostedOnly by the selector, the same way
  // x64-only is, so the lane is reported rather than dropped or failed. The
  // hosted db root stays authoritative for both lanes.
  assert.deepEqual(contract.runtime.hostedOnlyRequirements, [
    "privileged-daemon",
  ])
  assert.match(read("ops/local-ci/core/profiles.mjs"), /hostedOnlyRequirements/)
})

test("the runtime the agent dispatches into is isolated from the Mac by construction", () => {
  const contract = readJson(CONTRACT_PATH)
  if (runtimeKind(contract) === "lima") assertLimaIsolation(contract)
  else assertDockerDesktopIsolation(contract)
})

/**
 * Docker Desktop: no Mac directory, no privilege and no route to the Mac.
 *
 * The VM is shared, so the controls move to what each container is given. The
 * egress design is the one the 2026-09-28 spike proved: job lanes run on
 * `--internal` networks from a reserved pool, with no gateway and no
 * host.docker.internal, after an offline install. Only the trusted helper that
 * clones and fetches packages has egress, through an unprivileged allowlist
 * CONNECT proxy, because a plain bridge reaches Mac loopback services through
 * host.docker.internal. No privileged network guard is needed.
 */
function assertDockerDesktopIsolation(contract) {
  const runtime = contract.runtime
  assert.equal(runtime.kind, "docker-desktop")
  assert.equal(runtime.adapter, DOCKER_DESKTOP_ADAPTER)
  assert.equal(runtime.context, DOCKER_DESKTOP_CONTEXT)

  // The budget is what Docker Desktop is given, less a reserve for its own VM
  // and a floor for other worktrees' containers on the same daemon.
  assert.equal(runtime.cpus, 18)
  assert.equal(runtime.memoryGb, 50)
  for (const field of [
    "reserveCpus",
    "reserveMemoryGb",
    "externalMemoryFloorGb",
  ]) {
    assert.ok(
      Number.isInteger(runtime[field]) && runtime[field] > 0,
      `runtime.${field} must be a positive integer`
    )
  }
  assert.ok(contract.container.cpus + runtime.reserveCpus <= runtime.cpus)
  assert.ok(
    contract.container.memoryGb +
      runtime.reserveMemoryGb +
      runtime.externalMemoryFloorGb <=
      runtime.memoryGb
  )

  // No bind mount and no privileged container, stated as data and enforced
  // where the argv is built.
  assert.deepEqual(runtime.bindMounts, [])
  assert.deepEqual(runtime.privilegedContainers, [])
  assert.deepEqual(runtime.jobNetwork, {
    internal: true,
    subnetPool: "10.213.0.0/16",
  })
  assert.deepEqual(runtime.cleanup, {
    namePrefix: "nabaperks-ci-",
    labelPrefix: "com.nabaperks.local-ci.",
    prune: false,
  })

  const adapter = read(runtime.adapter)
  assert.doesNotMatch(adapter, /limactl/)
  assert.doesNotMatch(adapter, /--privileged/)
  assert.doesNotMatch(adapter, /docker\.sock/)
  assert.doesNotMatch(adapter, /--network[= ]host|"--network",\s*"host"/)
  // Host commands are an allowlist of its own; Lima's CLI is not in it.
  assert.match(
    adapter,
    /export const PERMITTED_HOST_EXECUTABLES = Object\.freeze\(\[\s*"\/bin\/sh",/
  )
  // The negative canary: a Mac 127.0.0.1 listener must be unreachable through
  // both Desktop routes to the host, and the probe must finish.
  assert.match(adapter, /host\.docker\.internal/)
  assert.match(adapter, /192\.168\.65\.254/)
  assert.match(adapter, /probe=ok/)

  const container = read("ops/local-ci/agent/container.mjs")
  assert.match(container, /"--context"/)
  assert.match(container, /"--internal"/)
  assert.match(container, /"--subnet"/)
  assert.match(container, /export function assertNoBindMounts\(/)
  assert.match(container, /assertNoBindMounts\(argv, "job container argv"\)/)

  // Stale volumes are swept too, by label and prefix, never by prune.
  assert.match(read("ops/local-ci/agent/recovery.mjs"), /volume/)

  // Docker Desktop's credential store and registry login are never used.
  assert.match(
    read("ops/local-ci/host/com.nabaperks.local-ci.plist"),
    /<key>DOCKER_CONFIG<\/key>/
  )
}

function assertLimaIsolation(contract) {
  const lima = read("ops/local-ci/host/lima-nabaperks-ci.yaml")

  assert.equal(
    contract.vm.definition,
    "ops/local-ci/host/lima-nabaperks-ci.yaml"
  )
  assert.deepEqual(contract.vm.mounts, [])
  assert.equal(contract.vm.cpus, 12)
  assert.equal(contract.vm.memoryGb, 40)
  assert.equal(contract.vm.diskGb, 150)
  assert.equal(contract.vm.forwardAgent, false)
  assert.equal(contract.vm.inboundConnections, "blocked")
  // A rollback has to fit the VM it rolls back to: the job container, its
  // Docker-in-Docker daemon and the VM reserve, or every local job fails
  // with RESOURCE_OVERCOMMIT after its check was opened.
  const { container } = contract
  assert.equal(container.dockerInDocker, true)
  assert.ok(
    container.cpus + container.daemon.cpus + contract.vm.reserveCpus <=
      contract.vm.cpus,
    "container, daemon and reserve CPUs must fit vm.cpus"
  )
  assert.ok(
    container.memoryGb +
      container.daemon.memoryGb +
      contract.vm.reserveMemoryGb <=
      contract.vm.memoryGb,
    "container, daemon and reserve memory must fit vm.memoryGb"
  )

  // No host directory is visible to the guest, in the only form Lima accepts.
  assert.match(lima, /\nmounts: \[\]\n/)
  assert.doesNotMatch(lima, /\nmounts:\n {2}-/)
  assert.match(lima, /\ncpus: 12\n/)
  assert.match(lima, /\nmemory: "40GiB"\n/)
  assert.match(lima, /\ndisk: "150GiB"\n/)

  // Inbound is closed three ways: no shared network, no published port, and a
  // default-deny firewall with the Docker bypass explicitly closed.
  assert.match(lima, /\nnetworks: \[\]\n/)
  assert.match(lima, /\nportForwards:\n/)
  assert.match(lima, /\n {4}ignore: true\n/)
  assert.match(lima, /ufw default deny incoming/)
  assert.match(lima, /iptables -I DOCKER-USER 1 [^\n]*ctstate NEW -j DROP/)

  // No host agent socket and no operator keys inside the guest.
  assert.match(lima, /\n {2}forwardAgent: false\n/)
  assert.match(lima, /\n {2}loadDotSSHPubKeys: false\n/)
  assert.match(lima, /\nrosetta:\n {2}enabled: false\n/)
}

test("runtime provisioning closes egress without conflicting firewall managers", () => {
  const contract = readJson(CONTRACT_PATH)
  if (runtimeKind(contract) === "lima") assertLimaProvisioning()
  else assertDockerDesktopProvisioning(contract)
})

/**
 * The trusted helper is the only container with egress, and it never runs
 * candidate code while it has it: no lifecycle scripts, no pnpmfile hooks, no
 * configDependencies, and a copied store so a job cannot write back through a
 * hard link. Jobs then install offline, where lifecycle scripts do run.
 */
function assertDockerDesktopProvisioning(contract) {
  const runtime = contract.runtime
  assert.deepEqual(runtime.helper.egress, {
    mode: "allowlist-proxy",
    hosts: ["github.com", "codeload.github.com", "registry.npmjs.org"],
    ports: [443],
    publicAddressesOnly: true,
  })
  const helperFlags = [
    "--frozen-lockfile",
    "--ignore-scripts",
    "--ignore-pnpmfile",
    "--config.package-import-method=copy",
  ]
  for (const flag of helperFlags)
    assert.ok(
      runtime.helper.installFlags.includes(flag),
      `helper needs ${flag}`
    )
  assert.equal(runtime.helper.refuseConfigDependencies, true)
  const jobFlags = ["--offline", "--frozen-lockfile"]
  for (const flag of jobFlags)
    assert.ok(runtime.jobInstallFlags.includes(flag), `jobs need ${flag}`)

  // The data above is enforced by agent code, not only declared.
  const agent = filesUnder("ops/local-ci/agent")
    .filter((path) => path.endsWith(".mjs"))
    .map(read)
    .join("\n")
  for (const word of [
    ...helperFlags,
    ...jobFlags,
    "configDependencies",
    ...runtime.helper.egress.hosts,
  ]) {
    assert.ok(agent.includes(word), `ops/local-ci/agent must apply ${word}`)
  }
}

function assertLimaProvisioning() {
  const lima = read("ops/local-ci/host/lima-nabaperks-ci.yaml")
  const install = lima.match(
    /apt-get install -y -qq --no-install-recommends \\\n([^\n]+)/
  )
  assert.ok(install, "the firewall package installation must be present")
  assert.match(install[1], /\bufw\b/)
  assert.doesNotMatch(install[1], /(?:iptables|netfilter)-persistent/)

  const probeStart = lima.indexOf("\nprobes:\n")
  assert.notEqual(probeStart, -1)
  const probe = lima.slice(probeStart)
  assert.match(probe, /sudo -n docker info/)
  assert.match(probe, /sudo -n ufw status/)
  assert.match(
    probe,
    /sudo -n systemctl is-active --quiet nabaperks-docker-inbound-deny\.service/
  )
  assert.match(
    probe,
    /sudo -n iptables -C DOCKER-USER [^\n]*ctstate NEW -j DROP/
  )
}

test("the job container never receives the host Docker daemon socket", () => {
  const contract = readJson(CONTRACT_PATH)
  const container = read("ops/local-ci/agent/container.mjs")
  const dockerfile = read("ops/local-ci/image/Dockerfile")

  assert.equal(contract.container.mountHostDockerSocket, false)

  // The absence is meaningful only alongside the guard that enforces it: the
  // builder refuses any argv naming the socket, and re-reads the contract flag
  // at the same point, so a contract edit alone cannot open the hole.
  assert.doesNotMatch(container, /\/var\/run\/docker\.sock/)
  assert.doesNotMatch(container, /docker\.sock/)
  assert.match(container, /export function assertNoDaemonSocket\(/)
  assert.match(container, /mountHostDockerSocket !== false/)
  assert.match(container, /assertNoDaemonSocket\(argv, "job container argv"\)/)
  assert.match(container, /assertUnprivileged\(argv, "job container argv"\)/)

  // The image reaches a daemon over TCP on a job-private network instead.
  assert.doesNotMatch(dockerfile, /docker\.sock/)
  assert.match(dockerfile, /\nENV DOCKER_HOST=tcp:\/\//)
})

test("a job environment carries no host secret and reaches the container only as an env file", () => {
  const contract = readJson(CONTRACT_PATH)
  const jobEnv = read("ops/local-ci/core/job-env.mjs")
  const container = read("ops/local-ci/agent/container.mjs")

  // Every environment the agent builds is checked before it is returned.
  const build = jobEnv.slice(jobEnv.indexOf("export function buildJobEnv("))
  assert.match(build, /^export function buildJobEnv\(/)
  assert.match(build, /\n {2}assertNoHostSecrets\(env, contract, hostEnv\)\n/)
  // Lane values travel in a file the client reads, not as `--env NAME=VALUE`
  // arguments visible through `ps`.
  assert.match(container, /argv\.push\("--env-file", /)

  if (runtimeKind(contract) === "lima") return
  // On Docker Desktop the file is written on the Mac and read by the docker
  // client there; nothing is mounted to deliver it.
  assert.deepEqual(contract.runtime.envFiles, {
    mode: "0600",
    passedAs: "--env-file",
    carriesHostSecrets: false,
  })
})

test("the Mac stays awake only while a job runs, through a scoped caffeinate", () => {
  // The persistent power-management CLI mutates global state that outlives
  // the agent. It must not appear anywhere under ops/.
  const opsFiles = filesUnder("ops")
  assert.ok(opsFiles.length > 0)
  for (const path of opsFiles)
    assert.doesNotMatch(read(path), /\bpmset\b/, `${path} must not use pmset`)

  const loop = read("ops/local-ci/agent/loop.mjs")
  assert.match(
    loop,
    /export const CAFFEINATE_PATH = "\/usr\/bin\/caffeinate"\n/
  )
  assert.match(
    loop,
    /export const CAFFEINATE_FLAGS = Object\.freeze\(\["-i", "-m", "-w"\]\)\n/
  )

  // The plist starts the agent itself, never wrapped in an assertion.
  const plist = read("ops/local-ci/host/com.nabaperks.local-ci.plist")
  const program = plist.match(
    /<key>ProgramArguments<\/key>\s*<array>([\s\S]*?)<\/array>/
  )
  assert.ok(program, "the plist must declare ProgramArguments")
  assert.match(program[1], /ops\/local-ci\/agent\/main\.mjs/)
  assert.doesNotMatch(program[1].replace(/<!--[\s\S]*?-->/g, ""), /caffeinate/)
})

test("the agent removes only its own Docker resources and never prunes", () => {
  // Other worktrees' stacks share a Docker Desktop daemon. A prune there
  // deletes their containers, networks or volumes; the sweep instead removes
  // inspected IDs that carry both the agent's labels and its name prefix.
  const prune =
    /\b(?:system|container|volume|network|image|builder)\s+prune\b|["']prune["']/
  for (const path of filesUnder("ops/local-ci"))
    assert.doesNotMatch(read(path), prune, `${path} must never prune`)

  const recovery = read("ops/local-ci/agent/recovery.mjs")
  assert.match(recovery, /com\.nabaperks\.local-ci\./)
  assert.match(recovery, /nabaperks-ci-/)
  assert.match(recovery, /head-sha/)
})

test("both local CI runbooks carry the App permission boundary and the no-PR-code rule", () => {
  const contract = readJson(CONTRACT_PATH)

  for (const path of [
    "docs/operations/local-ci.md",
    "docs/operations/local-ci-cutover.md",
  ]) {
    const doc = read(path)

    // The permission boundary: the granted set, where it is declared as data,
    // the narrowed Actions write, and the permissions that must be refused.
    assert.match(doc, /githubApp\.permissions/, `${path} must cite the data`)
    assert.match(doc, /rerun-failed-jobs/, `${path} must name the only write`)
    for (const permission of [
      "Checks",
      "Actions",
      "Contents",
      "Pull requests",
      "Metadata",
    ]) {
      assert.match(
        doc,
        new RegExp(escapeRegExp(permission)),
        `${path} must name the ${permission} permission`
      )
    }
    for (const refused of [
      "Contents: write",
      "Secrets",
      "Environments",
      "Administration",
      "Workflows: write",
    ]) {
      assert.match(
        doc,
        new RegExp(escapeRegExp(refused)),
        `${path} must name ${refused} as a permission that is never granted`
      )
    }

    // The rule the whole design rests on, plus the mechanism that enforces it.
    assert.match(
      doc,
      /The host agent is never updated from PR code/,
      `${path} must carry the no-PR-code rule as a heading`
    )
    assert.match(doc, /\/opt\/nabaperks-local-ci\/current/)
    assert.match(doc, /ops\/local-ci\/host\/install\.sh/)
  }

  // The runbook is the one that has to make the boundary auditable.
  const runbook = read("docs/operations/local-ci.md")
  assert.match(runbook, /grep -RIn "docker\\\.sock" ops\/local-ci\//)
  assert.equal(contract.cutoverStep, 1)
  assert.match(runbook, /local-ci-shadow\.yml/)
  assert.match(runbook, /LOCAL_CI_OBSERVE_ONCE=true/)
  assert.match(
    runbook,
    /Missing or pending proof is observational, not test success/
  )
  assert.match(runbook, /superseded/)

  if (runtimeKind(contract) === "lima") return
  // The shared VM is weaker isolation than Lima's. The security boundary
  // section must say so, and record who accepted it and when.
  const start = runbook.indexOf("\n## 7. The security boundary\n")
  assert.notEqual(start, -1, "the runbook must keep section 7")
  const next = runbook.indexOf("\n## ", start + 1)
  const boundary = runbook.slice(start, next === -1 ? runbook.length : next)
  assert.match(boundary, /Docker Desktop/)
  assert.match(boundary, /owner-accepted on 2026-09-28/)
})

test("browser lanes keep complete shard coverage, one worker and a private server each", () => {
  const contract = readJson(CONTRACT_PATH)
  const ports = contract.playwrightPorts
  assert.deepEqual(Object.keys(ports.reserved).sort(), ["3000", "3147"])
  const assigned = Object.fromEntries(
    Object.entries(ports).filter(
      ([key]) => !["reserved", "notes"].includes(key)
    )
  )
  const values = Object.values(assigned)
  assert.deepEqual(values, [...new Set(values)], "ports must be distinct")
  for (const [lane, port] of Object.entries(assigned)) {
    assert.ok(Number.isInteger(port) && port > 1024, `${lane} needs a port`)
    assert.ok(
      !Object.keys(ports.reserved).includes(String(port)),
      `${lane} must not take reserved port ${port}`
    )
  }

  for (const name of PROFILE_NAMES) {
    const lanes = browserLanes(readJson(PROFILE_PATHS[name]))
    assert.deepEqual(
      lanes.map((lane) => lane.id).sort(),
      Object.keys(assigned).sort(),
      `${name}: every browser lane, and only those, owns a Playwright port`
    )
    const distDirs = lanes.map((lane) => lane.env.PLAYWRIGHT_NEXT_DIST_DIR)
    assert.deepEqual(distDirs, [...new Set(distDirs)])

    // Splitting a project across lanes must not drop, repeat or re-size a
    // shard: each (script, project) covers 1..N of one denominator exactly
    // once, and end-to-end keeps the /32 that ended the 8-shard OOM kills.
    const shards = new Map()
    for (const lane of lanes) {
      assert.equal(lane.env.PLAYWRIGHT_WORKERS, "1", `${name}/${lane.id}`)
      assert.equal(
        lane.env.PLAYWRIGHT_BASE_URL,
        `http://127.0.0.1:${assigned[lane.id]}`,
        `${name}/${lane.id} must serve on its own port`
      )
      for (const command of laneCommands(lane)) {
        const match =
          /\b(test:e2e|test:a11y) --project="([a-z-]+)" .*--shard="(\d+)\/(\d+)"/.exec(
            command
          )
        if (!match) continue
        const key = `${match[1]} ${match[2]}`
        const entry = shards.get(key) ?? { total: Number(match[4]), seen: [] }
        assert.equal(entry.total, Number(match[4]), `${name} ${key}`)
        entry.seen.push(Number(match[3]))
        shards.set(key, entry)
      }
    }
    assert.ok(shards.size > 0, `${name} must shard its browser lanes`)
    for (const [key, { total, seen }] of shards) {
      if (key.startsWith("test:e2e ")) assert.equal(total, 32, `${name} ${key}`)
      assert.deepEqual(
        seen.sort((a, b) => a - b),
        Array.from({ length: total }, (_, index) => index + 1),
        `${name} ${key} must run every shard exactly once`
      )
    }
  }
})

test("non-baseline accessibility journeys stay in both planes' selections", () => {
  for (const spec of [
    "tests/e2e/customer-join-direct-live-db.spec.ts",
    "tests/e2e/merchant-id-verification-flow.ts",
  ]) {
    const source = read(spec)
    assert.match(source, /@a11y/)
    assert.doesNotMatch(source, /@visual|toHaveScreenshot/)
  }
  const hostedA11y = jobSlice(read(CI_PATH), "a11y")
  assert.match(
    hostedA11y,
    /node scripts\/ci\/browser-workload\.mjs hosted test:a11y --project=/
  )
  assert.doesNotMatch(hostedA11y, /--grep-invert @visual/)

  // Fewer hosted accessibility jobs must not mean fewer accessibility tests.
  // The shard list in the workflow is the manifest denominator spelled out,
  // so halving one without the other would either skip a quarter of the
  // suite or fail every job on an unqualified shard. Single-worker execution
  // is asserted here too: it is the property a "make it cheaper" edit reaches
  // for once the job count has already been cut.
  const a11yDefinition = readJson("config/ci-workloads.json").browsers[
    "test:a11y"
  ]
  assert.equal(a11yDefinition.hostedShards, 4)
  assert.equal(a11yDefinition.grep, "@a11y")
  assert.match(
    hostedA11y,
    new RegExp(
      `\\n {8}shard: \\[${Array.from(
        { length: a11yDefinition.hostedShards },
        (_, index) =>
          escapeRegExp(`${index + 1}/${a11yDefinition.hostedShards}`)
      ).join(", ")}\\]\\n`
    ),
    "the hosted a11y matrix must declare exactly the manifest's shards"
  )
  assert.match(hostedA11y, /\n {6}PLAYWRIGHT_WORKERS: "1"\n/)
  for (const name of PROFILE_NAMES) {
    const profile = readJson(PROFILE_PATHS[name])
    const lanes = profile.lanes.filter((lane) => lane.id.startsWith("a11y-"))
    assert.equal(lanes.length, 2)
    for (const lane of lanes) {
      assert.equal(lane.knownLocalGaps, undefined)
      for (const command of lane.commands.filter((entry) =>
        entry.includes("test:a11y")
      )) {
        assert.match(command, /--grep-invert @visual/)
        assert.match(command, /--ignore-snapshots/)
      }
    }
  }
})

test("the profile guide preserves complete hosted gating and retires field-only cutover", () => {
  const guide = read("ops/local-ci/profiles/README.md")
  assert.match(guide, /all nine hosted roots/)
  assert.match(guide, /field-flip procedure is superseded/)
  assert.match(guide, /trusted verifier independent of candidate code/)
  assert.doesNotMatch(guide, /needs exactly `\[fast, build\]`/)
})
