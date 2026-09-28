/**
 * Profile loading, validation and architecture routing.
 *
 * A profile (ops/local-ci/profiles/*.json) is the declarative transcription of
 * what ci.yml and nightly.yml run. Validating it here means a typo in a lane
 * id or an unknown runtime-env source is a refusal at load time, before the
 * agent claims a head SHA, rather than a lane that quietly resolves to an
 * empty command list and exits 0.
 *
 * The routing rule matters as much as the validation. A lane the local plane
 * cannot run is never dropped - it is returned in `hostedOnly` with a reason,
 * so the caller can prove the work still happens on the GitHub-hosted plane.
 * A silently missing lane and a passing run look identical from the outside,
 * and that is exactly the failure mode this plane must not have.
 */

import {
  LocalCiError,
  deepClone,
  deepFreeze,
  describeValue,
  profilePath,
  runtimeEnvSourceIds,
} from "./contract.mjs"
import { laneResources, lanesFit } from "./lane-scheduler.mjs"
import { assertBrowserMemoryBudget } from "./browser-budget.mjs"

/** Host architectures the agent can run on, as `process.arch` spells them. */
export const HOST_ARCHITECTURES = Object.freeze(["arm64", "x64"])

/** The lane `arch` value that pins a lane to x86-64 hardware. */
export const X64_ONLY = "x64-only"

/**
 * Capabilities a lane may `require` of the runtime. A runtime that lists one
 * in `contract.runtime.hostedOnlyRequirements` cannot provide it, and every
 * lane requiring it is routed to the hosted plane.
 */
export const LANE_REQUIREMENTS = Object.freeze(["privileged-daemon"])

/**
 * The halves an e2e project is split into. Each half runs the interleaved
 * shards of one denominator - odd numerators or even ones - so both halves
 * together run every shard exactly once and each shard keeps its own fresh
 * dev server and single worker.
 */
export const SPLIT_HALVES = Object.freeze(["odd", "even"])

/** A browser workload invocation's suite, project and shard. Pure. */
export function browserShardOf(command) {
  const match =
    /\b(test:e2e|test:a11y) --project="?([a-z0-9-]+)"?\s.*--shard="?(\d+)\/(\d+)"?/.exec(
      String(command)
    )
  if (!match) return null
  return {
    suite: match[1],
    project: match[2],
    index: Number(match[3]),
    total: Number(match[4]),
  }
}

/** The half a split lane id names, or null for an unsplit lane. Pure. */
export function splitHalfOf(laneId) {
  const match = /-(odd|even)$/.exec(String(laneId))
  return match ? match[1] : null
}

export class ProfileError extends LocalCiError {}

/** One-based validation boundary; an older unmarked lane proves no execution. */
export function workloadCommandIndex(lane) {
  if (lane.workloadCommand === undefined) return null
  if (
    !Number.isInteger(lane.workloadCommand) ||
    lane.workloadCommand < 1 ||
    lane.workloadCommand > lane.commands.length
  )
    fail(
      "INVALID_WORKLOAD_COMMAND",
      `lane ${JSON.stringify(lane.id)} workloadCommand must name an existing command (one-based)`
    )
  return lane.workloadCommand - 1
}

function fail(code, message) {
  throw new ProfileError(code, `local-ci profile: ${message}`)
}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireObject(value, path) {
  if (!isPlainObject(value)) {
    fail(
      "PROFILE_SHAPE",
      `${path} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

function requireNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(
      "PROFILE_SHAPE",
      `${path} must be a non-empty string (received ${describeValue(value)})`
    )
  }
  return value
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    fail(
      "PROFILE_SHAPE",
      `${path} must be an array (received ${describeValue(value)})`
    )
  }
  return value
}

function requireStringMap(value, path) {
  requireObject(value, path)
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      fail(
        "PROFILE_SHAPE",
        `${path}.${key} must be a string (received ${describeValue(entry)}); an env value is always text`
      )
    }
  }
  return value
}

function validateRuntimeEnvIds(ids, path, knownIds) {
  requireArray(ids, path)
  for (const [index, id] of ids.entries()) {
    requireNonEmptyString(id, `${path}[${index}]`)
    if (!knownIds.includes(id)) {
      fail(
        "UNKNOWN_RUNTIME_ENV_SOURCE",
        `${path}[${index}] names ${JSON.stringify(id)}, which is not a runtimeEnv source in the contract (known: ${knownIds.join(", ")})`
      )
    }
  }
  return ids
}

/**
 * A lane may declare `knownLocalGaps`: specs the hosted plane runs and this
 * lane provably does not. The field is optional, but when it is present every
 * entry has to name the spec, why the lane drops it, and where the coverage
 * still happens - because an undocumented gap and a silently missing test look
 * identical from the outside, which is the failure this plane must not have.
 */
function validateKnownLocalGap(gap, path) {
  requireObject(gap, path)
  requireNonEmptyString(gap.spec, `${path}.spec`)
  requireNonEmptyString(gap.reason, `${path}.reason`)
  requireNonEmptyString(gap.droppedBy, `${path}.droppedBy`)

  const covered = requireArray(gap.hostedCoverage, `${path}.hostedCoverage`)
  if (covered.length === 0) {
    fail(
      "UNCOVERED_LOCAL_GAP",
      `${path}.hostedCoverage names nowhere the spec still runs; a lane may only declare a gap another plane covers, and ${JSON.stringify(gap.spec)} would otherwise be a test this repository no longer runs anywhere`
    )
  }
  for (const [index, entry] of covered.entries()) {
    requireNonEmptyString(entry, `${path}.hostedCoverage[${index}]`)
  }

  if (gap.coverageLostOverall !== false) {
    fail(
      "UNCOVERED_LOCAL_GAP",
      `${path}.coverageLostOverall must be false (received ${describeValue(gap.coverageLostOverall)}); a declared gap is a lane-local absence with hosted cover, not a test that stopped running`
    )
  }

  if (gap.describeTags !== undefined) {
    const tags = requireArray(gap.describeTags, `${path}.describeTags`)
    for (const [index, tag] of tags.entries()) {
      requireNonEmptyString(tag, `${path}.describeTags[${index}]`)
    }
  }
}

function validateBackgroundService(service, path) {
  requireObject(service, path)
  requireNonEmptyString(service.id, `${path}.id`)
  requireNonEmptyString(service.command, `${path}.command`)
  const readiness = requireObject(service.readiness, `${path}.readiness`)
  requireNonEmptyString(readiness.url, `${path}.readiness.url`)
  if (!Number.isInteger(readiness.attempts) || readiness.attempts < 1) {
    fail(
      "PROFILE_SHAPE",
      `${path}.readiness.attempts must be a positive integer (received ${describeValue(readiness.attempts)})`
    )
  }
}

function validateRequirements(lane, path) {
  const requires =
    lane.requires === undefined
      ? []
      : requireArray(lane.requires, `${path}.requires`)
  for (const [index, requirement] of requires.entries()) {
    requireNonEmptyString(requirement, `${path}.requires[${index}]`)
    if (!LANE_REQUIREMENTS.includes(requirement)) {
      fail(
        "UNKNOWN_LANE_REQUIREMENT",
        `${path}.requires[${index}] names ${JSON.stringify(requirement)}, which is not a runtime capability this plane knows (known: ${LANE_REQUIREMENTS.join(", ")})`
      )
    }
  }
  // A lane that needs a Docker daemon needs the privileged sidecar that
  // provides one. Declaring the first without the second would let a runtime
  // without that privilege schedule the lane and fail it in seconds.
  if (lane.needsDaemon === true && !requires.includes("privileged-daemon")) {
    fail(
      "UNDECLARED_REQUIREMENT",
      `${path} (${lane.id}) needs a Docker daemon but does not require privileged-daemon`
    )
  }
}

/**
 * A lane that runs half of a project's shards must say which project, and
 * every browser command in it must run that project's shards of that half.
 * A copy-paste slip that pointed the even half of chromium at mobile-safari
 * would otherwise run mobile-safari twice and chromium's even shards never.
 */
function validateSplitLane(lane, path) {
  const half = splitHalfOf(lane.id)
  if (half === null && lane.project === undefined) return
  if (half === null) {
    fail(
      "SPLIT_LANE_SHAPE",
      `${path} (${lane.id}) declares project ${describeValue(lane.project)} but its id does not end in -odd or -even`
    )
  }
  const project = requireNonEmptyString(lane.project, `${path}.project`)
  const shards = lane.commands.map(browserShardOf).filter(Boolean)
  if (shards.length === 0) {
    fail(
      "SPLIT_LANE_SHAPE",
      `${path} (${lane.id}) is a split lane that runs no sharded browser workload`
    )
  }
  for (const shard of shards) {
    if (shard.project !== project) {
      fail(
        "SPLIT_LANE_PROJECT",
        `${path} (${lane.id}) declares project ${JSON.stringify(project)} but runs ${JSON.stringify(shard.project)} shard ${shard.index}/${shard.total}`
      )
    }
    if ((shard.index % 2 === 1 ? "odd" : "even") !== half) {
      fail(
        "SPLIT_LANE_SHARD",
        `${path} (${lane.id}) is the ${half} half but runs shard ${shard.index}/${shard.total}`
      )
    }
  }
}

/**
 * Every (suite, project) the profile shards must cover 1..N of one
 * denominator exactly once across all of its lanes. This is the parity
 * guarantee that lets a project run as two lanes: splitting may move a shard,
 * never drop, repeat or re-size one.
 */
function validateShardCoverage(lanes, name) {
  const coverage = new Map()
  for (const lane of lanes) {
    for (const shard of lane.commands.map(browserShardOf).filter(Boolean)) {
      const key = `${shard.suite} ${shard.project}`
      const entry = coverage.get(key) ?? { total: shard.total, seen: [] }
      if (entry.total !== shard.total) {
        fail(
          "SHARD_COVERAGE",
          `profile ${JSON.stringify(name)} runs ${key} with two denominators (${entry.total} and ${shard.total})`
        )
      }
      entry.seen.push(shard.index)
      coverage.set(key, entry)
    }
  }
  for (const [key, { total, seen }] of coverage) {
    const sorted = [...seen].sort((a, b) => a - b)
    const complete =
      sorted.length === total &&
      sorted.every((value, position) => value === position + 1)
    if (!complete) {
      fail(
        "SHARD_COVERAGE",
        `profile ${JSON.stringify(name)} must run every shard of ${key} exactly once (1..${total}); it runs ${sorted.join(", ")}`
      )
    }
  }
}

function validateLane(lane, index, contract, seenIds, knownSourceIds) {
  const path = `lanes[${index}]`
  requireObject(lane, path)
  const id = requireNonEmptyString(lane.id, `${path}.id`)
  if (seenIds.has(id)) {
    fail(
      "DUPLICATE_LANE_ID",
      `${path}.id repeats ${JSON.stringify(id)}; lane ids are the join key between the two planes and must be unique`
    )
  }
  seenIds.add(id)
  requireNonEmptyString(lane.title, `${path}.title`)

  if (!contract.archValues.includes(lane.arch)) {
    fail(
      "INVALID_LANE_ARCH",
      `${path} (${id}) declares arch ${describeValue(lane.arch)}, which is not one of ${contract.archValues.map((value) => JSON.stringify(value)).join(", ")}`
    )
  }

  const commands = requireArray(lane.commands, `${path}.commands`)
  if (commands.length === 0) {
    fail(
      "EMPTY_LANE_COMMANDS",
      `${path} (${id}) has no commands; a lane that runs nothing reports success and proves nothing`
    )
  }
  for (const [commandIndex, command] of commands.entries()) {
    requireNonEmptyString(command, `${path}.commands[${commandIndex}]`)
  }
  workloadCommandIndex(lane)

  const teardown = requireArray(
    lane.teardownCommands,
    `${path}.teardownCommands`
  )
  for (const [teardownIndex, command] of teardown.entries()) {
    requireNonEmptyString(command, `${path}.teardownCommands[${teardownIndex}]`)
  }

  const services = requireArray(
    lane.backgroundServices,
    `${path}.backgroundServices`
  )
  for (const [serviceIndex, service] of services.entries()) {
    validateBackgroundService(
      service,
      `${path}.backgroundServices[${serviceIndex}]`
    )
  }

  validateRuntimeEnvIds(lane.runtimeEnv, `${path}.runtimeEnv`, knownSourceIds)
  requireStringMap(lane.env, `${path}.env`)
  validateRequirements(lane, path)
  validateSplitLane(lane, path)
  assertBrowserMemoryBudget(lane, contract)
  if (lane.resources !== undefined) {
    requireObject(lane.resources, `${path}.resources`)
    laneResources(lane, contract)
    if (!lanesFit([lane], contract))
      fail("RESOURCE_OVERCOMMIT", `${path} cannot fit the VM budget`)
  }

  if (lane.knownLocalGaps !== undefined) {
    const gaps = requireArray(lane.knownLocalGaps, `${path}.knownLocalGaps`)
    for (const [gapIndex, gap] of gaps.entries()) {
      validateKnownLocalGap(gap, `${path}.knownLocalGaps[${gapIndex}]`)
    }
  }

  if (
    typeof lane.timeoutMinutes !== "number" ||
    !Number.isFinite(lane.timeoutMinutes) ||
    lane.timeoutMinutes <= 0
  ) {
    fail(
      "PROFILE_SHAPE",
      `${path}.timeoutMinutes must be a positive finite number (received ${describeValue(lane.timeoutMinutes)})`
    )
  }
  if (typeof lane.continueOnError !== "boolean") {
    fail(
      "PROFILE_SHAPE",
      `${path}.continueOnError must be a boolean (received ${describeValue(lane.continueOnError)})`
    )
  }

  if (lane.concurrencyGroup !== null) {
    requireNonEmptyString(lane.concurrencyGroup, `${path}.concurrencyGroup`)
    if (!Object.hasOwn(contract.concurrencyGroups, lane.concurrencyGroup)) {
      fail(
        "UNKNOWN_CONCURRENCY_GROUP",
        `${path}.concurrencyGroup names ${JSON.stringify(lane.concurrencyGroup)}, which the contract does not declare (known: ${Object.keys(contract.concurrencyGroups).join(", ")})`
      )
    }
  }

  // The objective half of the snapshot guard: the contract names substrings
  // that must not appear anywhere in a profile, and a lane carrying one could
  // rewrite the x86-64 pixel baselines from ARM64 hardware.
  if (contract.snapshotGuard?.enabled) {
    const forbidden = contract.snapshotGuard.forbiddenCommandSubstrings ?? []
    for (const command of [
      ...commands,
      ...teardown,
      ...services.map((service) => service.command),
    ]) {
      for (const substring of forbidden) {
        if (command.includes(substring)) {
          fail(
            "SNAPSHOT_GUARD_VIOLATION",
            `${path} (${id}) contains the forbidden substring ${JSON.stringify(substring)} in ${JSON.stringify(command)}; local lanes must never write or compare a pixel baseline`
          )
        }
      }
    }
  }
}

/**
 * Validate a parsed profile against the contract and hand back a deep-frozen
 * copy. The argument is not mutated.
 *
 * `expectedName` is optional; when supplied, the document's own `profile`
 * field must equal it, which is what catches a profiles map that points two
 * names at one file.
 */
export function validateProfile(profile, contract, expectedName = null) {
  requireObject(contract, "contract")
  requireObject(profile, "document")

  if (profile.schema !== contract.profileSchema) {
    fail(
      "PROFILE_SCHEMA",
      `schema must be ${JSON.stringify(contract.profileSchema)} (received ${describeValue(profile.schema)})`
    )
  }
  const name = requireNonEmptyString(profile.profile, "profile")
  if (expectedName !== null && name !== expectedName) {
    fail(
      "PROFILE_NAME_MISMATCH",
      `document declares profile ${JSON.stringify(name)} but was loaded as ${JSON.stringify(expectedName)}`
    )
  }
  if (!Object.hasOwn(contract.profiles, name)) {
    fail(
      "UNKNOWN_PROFILE",
      `${JSON.stringify(name)} is not a profile the contract declares (known: ${Object.keys(contract.profiles).join(", ")})`
    )
  }

  const knownSourceIds = [...runtimeEnvSourceIds(contract)]
  requireStringMap(profile.baselineEnv, "baselineEnv")
  validateRuntimeEnvIds(
    profile.baselineRuntimeEnv,
    "baselineRuntimeEnv",
    knownSourceIds
  )

  const lanes = requireArray(profile.lanes, "lanes")
  if (lanes.length === 0) {
    fail(
      "EMPTY_PROFILE",
      `profile ${JSON.stringify(name)} declares no lanes; an empty profile is a green run that proves nothing`
    )
  }

  const seenIds = new Set()
  for (const [index, lane] of lanes.entries()) {
    validateLane(lane, index, contract, seenIds, knownSourceIds)
  }
  validateShardCoverage(lanes, name)

  return deepFreeze(deepClone(profile))
}

/**
 * Read, parse and validate a named profile through an injected reader.
 *
 * `readFile` is `(path) => string`, resolved against whatever root the caller
 * uses. Injecting it is what lets the unit tests exercise this module with no
 * filesystem at all.
 */
export function loadProfile(name, contract, readFile) {
  requireObject(contract, "contract")
  if (typeof readFile !== "function") {
    fail(
      "INVALID_READER",
      `loadProfile requires a (path) => string reader (received ${describeValue(readFile)})`
    )
  }
  const path = profilePath(contract, name)

  let text
  try {
    text = readFile(path)
  } catch (error) {
    fail("PROFILE_UNREADABLE", `could not read ${path}: ${error.message}`)
  }
  if (typeof text !== "string") {
    fail(
      "PROFILE_UNREADABLE",
      `reader for ${path} returned ${describeValue(text)}, expected a string`
    )
  }

  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    fail("PROFILE_UNPARSEABLE", `${path} is not valid JSON: ${error.message}`)
  }
  return validateProfile(parsed, contract, name)
}

/** One lane by id, or a refusal naming the lanes the profile does declare. */
export function laneById(profile, laneId) {
  requireObject(profile, "profile")
  const lane = requireArray(profile.lanes, "profile.lanes").find(
    (entry) => entry.id === laneId
  )
  if (!lane) {
    fail(
      "UNKNOWN_LANE",
      `profile ${JSON.stringify(profile.profile)} has no lane ${describeValue(laneId)} (known: ${profile.lanes.map((entry) => entry.id).join(", ")})`
    )
  }
  return lane
}

/**
 * Split a profile's lanes into what this machine executes and what it must
 * leave to the GitHub-hosted plane.
 *
 * `arch` is the host architecture as `process.arch` spells it. A lane marked
 * `x64-only` is excluded from `local` on ARM64 hardware and reported in
 * `hostedOnly` with the reason, never dropped: the two lists always partition
 * the profile exactly, and that invariant is asserted before returning.
 *
 * `hostedOnlyRequirements` is the active runtime's
 * `contract.runtime.hostedOnlyRequirements`: capabilities it cannot provide.
 * A lane that `requires` one of them is routed to `hostedOnly` the same way
 * an x64-only lane is - reported with its reason, never dropped or failed.
 *
 * Returns `{ arch, local, hostedOnly, reasons }`.
 */
export function selectLanes(
  profile,
  { arch, hostedOnlyRequirements = [] } = {}
) {
  requireObject(profile, "profile")
  const lanes = requireArray(profile.lanes, "profile.lanes")
  if (!HOST_ARCHITECTURES.includes(arch)) {
    fail(
      "UNKNOWN_HOST_ARCH",
      `selectLanes needs a host architecture from ${HOST_ARCHITECTURES.join(", ")} (received ${describeValue(arch)})`
    )
  }
  requireArray(hostedOnlyRequirements, "hostedOnlyRequirements")

  const local = []
  const hostedOnly = []
  const reasons = {}

  for (const lane of lanes) {
    if (lane.arch === X64_ONLY && arch !== "x64") {
      hostedOnly.push(lane)
      reasons[lane.id] =
        `lane declares arch ${JSON.stringify(X64_ONLY)} and this host is ${JSON.stringify(arch)}; it stays on the GitHub-hosted x86-64 plane`
      continue
    }
    const missing = (lane.requires ?? []).filter((requirement) =>
      hostedOnlyRequirements.includes(requirement)
    )
    if (missing.length > 0) {
      hostedOnly.push(lane)
      reasons[lane.id] =
        `lane requires ${missing.map((entry) => JSON.stringify(entry)).join(", ")}, which this runtime does not provide on a shared Docker daemon; it stays on the GitHub-hosted plane, which remains authoritative for it`
      continue
    }
    local.push(lane)
  }

  if (local.length + hostedOnly.length !== lanes.length) {
    fail(
      "LANE_PARTITION_BROKEN",
      `routing dropped ${lanes.length - local.length - hostedOnly.length} lane(s) of profile ${JSON.stringify(profile.profile)}; every lane must appear in exactly one of local or hostedOnly`
    )
  }

  return Object.freeze({
    arch,
    local: Object.freeze(local),
    hostedOnly: Object.freeze(hostedOnly),
    reasons: Object.freeze(reasons),
  })
}

/**
 * Every gap a profile's lanes declare, flattened and tagged with the lane that
 * declared it.
 *
 * A lane that runs a filtered subset of what the hosted plane runs has to say
 * so in a form something other than a human can read, or the difference is
 * only ever discovered by the person who needed the missing test. Returns an
 * empty array for a profile whose lanes declare none.
 */
export function knownLocalGaps(profile) {
  requireObject(profile, "profile")
  const gaps = []
  for (const lane of requireArray(profile.lanes, "profile.lanes")) {
    for (const gap of lane.knownLocalGaps ?? []) {
      gaps.push(Object.freeze({ laneId: lane.id, ...gap }))
    }
  }
  return Object.freeze(gaps)
}

/**
 * Every way a profile's commands fall short of the contract's snapshot guard,
 * as human-readable strings. Non-throwing on purpose: the runtime self-check
 * wants the whole list, not the first one.
 *
 * `validateProfile` already refuses the forbidden substrings. This adds the
 * positive half - that every Playwright invocation carries the two flags that
 * stop it resolving the x86-64 baselines - which is reported rather than
 * thrown so the check can be run over a profile that is being edited.
 */
export function snapshotGuardViolations(profile, contract) {
  requireObject(profile, "profile")
  requireObject(contract, "contract")
  const guard = contract.snapshotGuard
  if (!guard || guard.enabled !== true) return Object.freeze([])

  const forbidden = guard.forbiddenCommandSubstrings ?? []
  const violations = []

  for (const lane of requireArray(profile.lanes, "profile.lanes")) {
    const commands = [
      ...lane.commands,
      ...(lane.teardownCommands ?? []),
      ...(lane.backgroundServices ?? []).map((service) => service.command),
    ]
    for (const command of commands) {
      for (const substring of forbidden) {
        if (command.includes(substring)) {
          violations.push(
            `${profile.profile}/${lane.id}: command contains forbidden substring ${JSON.stringify(substring)}: ${command}`
          )
        }
      }
    }
    for (const command of lane.commands) {
      if (!/playwright|test:e2e|test:a11y/.test(command)) continue
      if (!command.includes("--grep-invert @visual")) {
        violations.push(
          `${profile.profile}/${lane.id}: Playwright invocation is missing --grep-invert @visual: ${command}`
        )
      }
      if (!command.includes("--ignore-snapshots")) {
        violations.push(
          `${profile.profile}/${lane.id}: Playwright invocation is missing --ignore-snapshots: ${command}`
        )
      }
    }
  }

  return Object.freeze(violations)
}
