/**
 * config/local-ci-contract.json is the single source of truth shared by the
 * local CI agent, the advisory bridge job in ci.yml, the nightly verifier and
 * the contract tests. Every module under ops/local-ci/core reads it through
 * this file so a malformed contract fails once, loudly, at the boundary -
 * rather than surfacing as an `undefined` halfway through a run that has
 * already claimed a head SHA and started burning wall clock.
 *
 * Nothing here touches the filesystem, the network, the clock or the process
 * environment. `loadContract` takes an injected reader so the runtime and the
 * offline unit tests exercise exactly the same code path.
 */

export const CONTRACT_SCHEMA = "nabaperks.local-ci.v1"
export const CONTRACT_PATH = "config/local-ci-contract.json"

export const ENFORCEMENT_VALUES = Object.freeze(["advisory", "blocking"])

/**
 * Base class for every refusal raised inside ops/local-ci/core. Callers can
 * branch on `instanceof LocalCiError` for "this plane refused" and on `.code`
 * for the specific reason, which is what the agent logs and what the unit
 * tests assert against.
 */
export class LocalCiError extends Error {
  constructor(code, message) {
    super(message)
    this.name = this.constructor.name
    this.code = code
  }
}

export class ContractError extends LocalCiError {}

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Recursively freeze a JSON-shaped value in place. Used on every value this
 * package hands back so a downstream bug cannot quietly rewrite the contract,
 * a profile or a queue state that another caller is still holding.
 */
export function deepFreeze(value) {
  if (Array.isArray(value)) {
    for (const entry of value) deepFreeze(entry)
    return Object.freeze(value)
  }
  if (isPlainObject(value)) {
    for (const entry of Object.values(value)) deepFreeze(entry)
    return Object.freeze(value)
  }
  return value
}

/**
 * Structural copy of a JSON-shaped value. Validation freezes what it returns,
 * so it clones first: freezing the caller's own object would be a side effect
 * on an argument, and these modules promise not to have any.
 */
export function deepClone(value) {
  if (Array.isArray(value)) return value.map((entry) => deepClone(entry))
  if (isPlainObject(value)) {
    const copy = {}
    for (const [key, entry] of Object.entries(value)) {
      copy[key] = deepClone(entry)
    }
    return copy
  }
  return value
}

/**
 * Normalise a caller-supplied instant to epoch milliseconds. Decision logic in
 * this package never reads the clock itself; every timestamp arrives as an
 * argument and passes through here so an ISO string, an epoch number and a
 * Date all behave identically in tests and in production.
 */
export function toEpochMs(value, label = "timestamp") {
  if (value instanceof Date) {
    const time = value.getTime()
    if (Number.isNaN(time)) {
      throw new LocalCiError(
        "INVALID_TIMESTAMP",
        `${label} must be a valid Date (received an Invalid Date)`
      )
    }
    return time
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new LocalCiError(
        "INVALID_TIMESTAMP",
        `${label} must be a finite epoch-millisecond number (received ${value})`
      )
    }
    return value
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
      throw new LocalCiError(
        "INVALID_TIMESTAMP",
        `${label} must be an ISO-8601 timestamp (received ${quoteForMessage(value)})`
      )
    }
    return parsed
  }
  throw new LocalCiError(
    "INVALID_TIMESTAMP",
    `${label} must be a Date, an ISO-8601 string or an epoch-millisecond number (received ${describeValue(value)})`
  )
}

/** Normalise a caller-supplied instant to an ISO-8601 string. */
export function toIsoTimestamp(value, label = "timestamp") {
  return new Date(toEpochMs(value, label)).toISOString()
}

/** Longest description `describeValue` returns before it truncates. */
export const DESCRIBE_VALUE_MAX_LENGTH = 120

function boundDescription(text) {
  if (text.length <= DESCRIBE_VALUE_MAX_LENGTH) return text
  return `${text.slice(0, DESCRIBE_VALUE_MAX_LENGTH)}... (${text.length} characters)`
}

/**
 * Quote a string for a refusal message without using `JSON.stringify`.
 *
 * `JSON.stringify` looks like the obvious choice and is the wrong one here. It
 * is a JSON serialiser, not an escaper for the places these messages travel:
 * it leaves U+2028 and U+2029 unescaped even though both terminate a line in
 * JavaScript source, and it passes every other unassigned control character
 * through as a raw code unit. These strings end up in check summaries, in
 * evidence JSON and in logs that get embedded elsewhere, so a value carrying
 * a line separator can break the document that quotes it.
 *
 * Escaping the delimiter and the backslash first, then every C0 control, DEL
 * and the two Unicode line terminators, gives one representation that is safe
 * in all of those places and still reads like the original.
 */
export function quoteForMessage(value) {
  const escaped = String(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, (character) => {
      const code = character.codePointAt(0)
      if (character === "\n") return "\\n"
      if (character === "\r") return "\\r"
      if (character === "\t") return "\\t"
      return `\\u${code.toString(16).padStart(4, "0")}`
    })
  return `"${escaped}"`
}

/**
 * A function's identity without its body.
 *
 * `String(fn)` is the function's entire source. Interpolating that into a
 * refusal pastes arbitrary code - and whatever a closure's source happens to
 * name - where a type name belongs, which makes the message unreadable and
 * puts caller code into logs and published check summaries. The name and the
 * arity are what a reader actually needs to spot the wrong callback.
 *
 * The reads are guarded because a Proxy can throw from `name` or `length`, and
 * describeValue only ever runs on a path that is already refusing: a second
 * failure there would replace the real reason with a TypeError.
 */
function describeFunction(value) {
  try {
    const name =
      typeof value.name === "string" && value.name !== ""
        ? value.name
        : "(anonymous)"
    const arity = Number.isInteger(value.length) ? value.length : "?"
    return boundDescription(`function ${name}/${arity}`)
  } catch {
    return "function (unreadable)"
  }
}

/**
 * An object's shape without its contents.
 *
 * `String(obj)` runs a caller-supplied `toString`, and even the default one
 * says nothing. The key count is the useful bounded fact; the values are never
 * touched, because job-env.mjs builds the host-secret isolation boundary on
 * top of this module and a refusal must not be able to print what it carries.
 * `Object.keys` reads no getters, so describing a value stays side-effect free.
 */
function describeObject(value) {
  try {
    const count = Object.keys(value).length
    return `an object with ${count} key${count === 1 ? "" : "s"}`
  } catch {
    return "an object"
  }
}

/**
 * Human-readable type description used in every refusal message.
 *
 * Only bounded facts about a value ever leave here - a type, and at most a
 * name, an arity, a length or a key count. Nothing that could be arbitrarily
 * long or arbitrarily sensitive is stringified, so a refusal stays readable
 * and a pathological value cannot flood a log through an error message.
 *
 * It also never throws. Every call site is already on its way to raising a
 * refusal, and a hostile value - a revoked Proxy, a throwing getter - must not
 * be able to replace that refusal's real reason with a TypeError thrown while
 * composing the message.
 */
export function describeValue(value) {
  try {
    if (value === null) return "null"
    if (Array.isArray(value)) return `an array of length ${value.length}`
    if (typeof value === "string") {
      return boundDescription(`the string ${quoteForMessage(value)}`)
    }
    if (typeof value === "function") return describeFunction(value)
    if (typeof value === "object") return describeObject(value)
    return boundDescription(`${typeof value} ${String(value)}`)
  } catch {
    return "a value that cannot be described"
  }
}

function fail(code, message) {
  throw new ContractError(code, `local-ci contract: ${message}`)
}

function requireObject(value, path) {
  if (!isPlainObject(value)) {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

function requireNonEmptyString(value, path) {
  if (typeof value !== "string" || value.trim() === "") {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be a non-empty string (received ${describeValue(value)})`
    )
  }
  return value
}

function requireArray(value, path) {
  if (!Array.isArray(value)) {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be an array (received ${describeValue(value)})`
    )
  }
  return value
}

function requireBoolean(value, path) {
  if (typeof value !== "boolean") {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be a boolean (received ${describeValue(value)})`
    )
  }
  return value
}

function requirePositiveNumber(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be a positive finite number (received ${describeValue(value)})`
    )
  }
  return value
}

function requirePositiveInteger(value, path) {
  requirePositiveNumber(value, path)
  if (!Number.isInteger(value)) {
    fail("CONTRACT_SHAPE", `${path} must be an integer (received ${value})`)
  }
  return value
}

function requireOneOf(value, allowed, path) {
  if (!allowed.includes(value)) {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be one of ${allowed.map((entry) => JSON.stringify(entry)).join(", ")} (received ${describeValue(value)})`
    )
  }
  return value
}

const OWNER_REPO = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

function requireOwnerRepo(value, path) {
  requireNonEmptyString(value, path)
  if (!OWNER_REPO.test(value)) {
    fail(
      "CONTRACT_SHAPE",
      `${path} must be an exact "owner/repo" full name with no extra path segments (received ${quoteForMessage(value)})`
    )
  }
  return value
}

function requireNullableId(value, path) {
  if (value === null) return value
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value
  }
  if (typeof value === "string" && value.trim() !== "") return value
  fail(
    "CONTRACT_SHAPE",
    `${path} must be null (the pre-provisioning sentinel), a positive integer or a non-empty string (received ${describeValue(value)})`
  )
  return value
}

function validateGithubApp(app) {
  requireObject(app, "githubApp")
  requireNonEmptyString(app.name, "githubApp.name")
  requireNullableId(app.appId, "githubApp.appId")
  requireNullableId(app.installationId, "githubApp.installationId")
  requireNullableId(app.repositoryId, "githubApp.repositoryId")
  requireObject(app.permissions, "githubApp.permissions")
  requireArray(
    app.allowedActionsWriteOperations,
    "githubApp.allowedActionsWriteOperations"
  )
  for (const [
    index,
    operation,
  ] of app.allowedActionsWriteOperations.entries()) {
    requireNonEmptyString(
      operation,
      `githubApp.allowedActionsWriteOperations[${index}]`
    )
  }
}

function validateBridge(bridge, app) {
  requireObject(bridge, "bridge")
  requireNonEmptyString(bridge.job, "bridge.job")
  requireNonEmptyString(bridge.checkName, "bridge.checkName")
  requirePositiveNumber(bridge.timeoutMinutes, "bridge.timeoutMinutes")
  requirePositiveNumber(
    bridge.pollIntervalSeconds,
    "bridge.pollIntervalSeconds"
  )
  requireOneOf(bridge.enforcement, ENFORCEMENT_VALUES, "bridge.enforcement")
  requireArray(bridge.dependents, "bridge.dependents")

  // The cutover-step-1 invariant, encoded rather than trusted. An advisory
  // bridge that something already depends on is a merge-blocking surface that
  // nobody reviewed, which is the exact failure this plane exists to avoid.
  if (bridge.enforcement === "advisory" && bridge.dependents.length > 0) {
    fail(
      "ADVISORY_WITH_DEPENDENTS",
      `bridge.enforcement is "advisory" but bridge.dependents lists ${bridge.dependents.length} job(s) (${bridge.dependents.join(", ")}); an advisory bridge must have no dependents`
    )
  }

  // The contract's own note: no proof lane may be promoted to blocking while
  // the App identity is still a null sentinel, because nothing can verify who
  // published the check that would then gate a merge.
  if (bridge.enforcement === "blocking") {
    const unset = ["appId", "installationId", "repositoryId"].filter(
      (key) => app[key] === null
    )
    if (unset.length > 0) {
      fail(
        "BLOCKING_WITHOUT_APP_IDENTITY",
        `bridge.enforcement is "blocking" but githubApp.${unset.join(", githubApp.")} ${unset.length === 1 ? "is" : "are"} still null; the App must be created and installed before a proof lane can block a merge`
      )
    }
  }
}

function validateAgent(agent) {
  requireObject(agent, "agent")
  requirePositiveNumber(agent.pollIntervalSeconds, "agent.pollIntervalSeconds")
  requirePositiveInteger(agent.maxConcurrentJobs, "agent.maxConcurrentJobs")
  requirePositiveInteger(agent.maxConcurrentLanes, "agent.maxConcurrentLanes")
  requirePositiveInteger(agent.logRetentionDays, "agent.logRetentionDays")
  requirePositiveInteger(agent.queueDepthLimit, "agent.queueDepthLimit")
  requireNonEmptyString(agent.stateRoot, "agent.stateRoot")
  requireNonEmptyString(agent.installRoot, "agent.installRoot")
}

function validateHostSecrets(contract) {
  const names = requireArray(contract.hostSecrets, "hostSecrets")
  if (names.length === 0) {
    fail(
      "CONTRACT_SHAPE",
      "hostSecrets must list at least one name; an empty denylist would make the secret-isolation boundary vacuous"
    )
  }
  const seen = new Set()
  for (const [index, name] of names.entries()) {
    requireNonEmptyString(name, `hostSecrets[${index}]`)
    if (seen.has(name)) {
      fail(
        "CONTRACT_SHAPE",
        `hostSecrets[${index}] repeats ${quoteForMessage(name)}`
      )
    }
    seen.add(name)
  }
  const policy = requireObject(contract.hostSecretsPolicy, "hostSecretsPolicy")
  requireNonEmptyString(policy.storageRoot, "hostSecretsPolicy.storageRoot")
  requireBoolean(
    policy.neverEnterContainer,
    "hostSecretsPolicy.neverEnterContainer"
  )
  if (policy.neverEnterContainer !== true) {
    fail(
      "HOST_SECRETS_MAY_ENTER_CONTAINER",
      "hostSecretsPolicy.neverEnterContainer must be true; job containers never receive a host secret"
    )
  }
}

function validateRuntimeEnv(runtimeEnv) {
  requireObject(runtimeEnv, "runtimeEnv")
  requireNonEmptyString(runtimeEnv.schema, "runtimeEnv.schema")
  const sources = requireArray(runtimeEnv.sources, "runtimeEnv.sources")
  const seen = new Set()
  for (const [index, source] of sources.entries()) {
    const path = `runtimeEnv.sources[${index}]`
    requireObject(source, path)
    requireNonEmptyString(source.id, `${path}.id`)
    if (seen.has(source.id)) {
      fail("CONTRACT_SHAPE", `${path}.id repeats ${quoteForMessage(source.id)}`)
    }
    seen.add(source.id)
    requireNonEmptyString(source.kind, `${path}.kind`)
    const provides = requireArray(source.provides, `${path}.provides`)
    if (provides.length === 0) {
      fail(
        "CONTRACT_SHAPE",
        `${path}.provides must name at least one environment variable; a source that provides nothing cannot be depended on`
      )
    }
    for (const [nameIndex, name] of provides.entries()) {
      requireNonEmptyString(name, `${path}.provides[${nameIndex}]`)
    }
  }
}

function validateProfilesMap(contract) {
  const profiles = requireObject(contract.profiles, "profiles")
  const names = Object.keys(profiles)
  if (names.length === 0) {
    fail("CONTRACT_SHAPE", "profiles must name at least one profile")
  }
  for (const name of names) {
    requireNonEmptyString(profiles[name], `profiles.${name}`)
  }
  requireNonEmptyString(contract.profileSchema, "profileSchema")
}

function validateArchValues(contract) {
  const values = requireArray(contract.archValues, "archValues")
  if (!values.includes("any")) {
    fail(
      "CONTRACT_SHAPE",
      'archValues must include "any"; every lane defaults to it via laneDefaults.arch'
    )
  }
  for (const [index, value] of values.entries()) {
    requireNonEmptyString(value, `archValues[${index}]`)
  }
}

/**
 * Validate a parsed contract document and hand back a deep-frozen copy.
 *
 * The argument is never mutated: what comes back is a clone, so a caller that
 * keeps its own mutable copy is unaffected and the frozen copy cannot drift
 * underneath the modules that read it.
 */
export function validateContract(contract) {
  requireObject(contract, "document")
  if (contract.schema !== CONTRACT_SCHEMA) {
    fail(
      "CONTRACT_SCHEMA",
      `schema must be ${JSON.stringify(CONTRACT_SCHEMA)} (received ${describeValue(contract.schema)})`
    )
  }

  requireNonEmptyString(contract.checkName, "checkName")
  requireNonEmptyString(contract.nightlyCheckName, "nightlyCheckName")
  requireOwnerRepo(contract.repository, "repository")
  requireNonEmptyString(contract.remoteUrl, "remoteUrl")
  requireOwnerRepo(contract.allowedHeadRepository, "allowedHeadRepository")
  requirePositiveInteger(contract.cutoverStep, "cutoverStep")
  requireNonEmptyString(contract.stage, "stage")

  validateGithubApp(contract.githubApp)
  validateBridge(contract.bridge, contract.githubApp)
  validateAgent(contract.agent)

  const nightly = requireObject(contract.nightlyProof, "nightlyProof")
  requirePositiveNumber(nightly.maxAgeHours, "nightlyProof.maxAgeHours")
  requireNonEmptyString(nightly.checkName, "nightlyProof.checkName")

  const shadow = requireObject(contract.shadowMode, "shadowMode")
  requireBoolean(shadow.enabled, "shadowMode.enabled")
  requirePositiveInteger(
    shadow.requiredConsecutiveEquivalent,
    "shadowMode.requiredConsecutiveEquivalent"
  )

  const container = requireObject(contract.container, "container")
  requirePositiveNumber(container.timeoutMinutes, "container.timeoutMinutes")
  requireBoolean(
    container.mountHostDockerSocket,
    "container.mountHostDockerSocket"
  )
  if (container.mountHostDockerSocket !== false) {
    fail(
      "HOST_DOCKER_SOCKET_MOUNTED",
      "container.mountHostDockerSocket must be false; the host Docker socket is a container escape"
    )
  }
  // The container ceiling has to sit inside the bridge ceiling, otherwise the
  // hosted job gives up before the local run can report why it failed.
  if (container.timeoutMinutes >= contract.bridge.timeoutMinutes) {
    fail(
      "CONTAINER_TIMEOUT_EXCEEDS_BRIDGE",
      `container.timeoutMinutes (${container.timeoutMinutes}) must be strictly less than bridge.timeoutMinutes (${contract.bridge.timeoutMinutes}) so the agent reports a killed run before the bridge times out`
    )
  }

  validateProfilesMap(contract)
  validateArchValues(contract)
  validateRuntimeEnv(contract.runtimeEnv)
  validateHostSecrets(contract)

  const laneDefaults = requireObject(contract.laneDefaults, "laneDefaults")
  requireBoolean(laneDefaults.continueOnError, "laneDefaults.continueOnError")
  requireOneOf(laneDefaults.arch, contract.archValues, "laneDefaults.arch")

  const evidence = requireObject(contract.evidence, "evidence")
  requireNonEmptyString(evidence.resultSchema, "evidence.resultSchema")
  requireNonEmptyString(evidence.artifactRoot, "evidence.artifactRoot")
  requirePositiveInteger(evidence.retentionDays, "evidence.retentionDays")

  requireObject(contract.snapshotGuard, "snapshotGuard")
  requireBoolean(contract.snapshotGuard.enabled, "snapshotGuard.enabled")
  requireArray(
    contract.snapshotGuard.forbiddenCommandSubstrings,
    "snapshotGuard.forbiddenCommandSubstrings"
  )
  requireObject(contract.concurrencyGroups, "concurrencyGroups")

  return deepFreeze(deepClone(contract))
}

/**
 * Read, parse and validate the contract through an injected reader.
 *
 * `readFile` is `(path) => string`. The runtime passes a thin wrapper over
 * node:fs; the unit tests pass a function over an in-memory map, which is why
 * this package needs no fixture files on disk.
 */
export function loadContract(readFile, path = CONTRACT_PATH) {
  if (typeof readFile !== "function") {
    throw new ContractError(
      "INVALID_READER",
      `loadContract requires a (path) => string reader (received ${describeValue(readFile)})`
    )
  }
  let text
  try {
    text = readFile(path)
  } catch (error) {
    throw new ContractError(
      "CONTRACT_UNREADABLE",
      `local-ci contract: could not read ${path}: ${error.message}`
    )
  }
  if (typeof text !== "string") {
    throw new ContractError(
      "CONTRACT_UNREADABLE",
      `local-ci contract: reader for ${path} returned ${describeValue(text)}, expected a string`
    )
  }
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch (error) {
    throw new ContractError(
      "CONTRACT_UNPARSEABLE",
      `local-ci contract: ${path} is not valid JSON: ${error.message}`
    )
  }
  return validateContract(parsed)
}

/** The host-secret denylist, as a frozen copy the caller cannot edit. */
export function hostSecretNames(contract) {
  requireObject(contract, "contract")
  return Object.freeze([...requireArray(contract.hostSecrets, "hostSecrets")])
}

/** Repository-relative path of a named profile, or a refusal naming the set. */
export function profilePath(contract, name) {
  requireObject(contract, "contract")
  const profiles = requireObject(contract.profiles, "profiles")
  if (typeof name !== "string" || !Object.hasOwn(profiles, name)) {
    throw new ContractError(
      "UNKNOWN_PROFILE",
      `local-ci contract: unknown profile ${describeValue(name)}; known profiles are ${Object.keys(profiles).join(", ")}`
    )
  }
  return profiles[name]
}

/** Every runtime-env source id the contract declares, in declaration order. */
export function runtimeEnvSourceIds(contract) {
  requireObject(contract, "contract")
  const runtimeEnv = requireObject(contract.runtimeEnv, "runtimeEnv")
  return Object.freeze(runtimeEnv.sources.map((source) => source.id))
}

/** One runtime-env source by id, or a refusal naming the known ids. */
export function runtimeEnvSource(contract, id) {
  requireObject(contract, "contract")
  const runtimeEnv = requireObject(contract.runtimeEnv, "runtimeEnv")
  const source = runtimeEnv.sources.find((entry) => entry.id === id)
  if (!source) {
    throw new ContractError(
      "UNKNOWN_RUNTIME_ENV_SOURCE",
      `local-ci contract: unknown runtimeEnv source ${describeValue(id)}; known sources are ${runtimeEnv.sources.map((entry) => entry.id).join(", ")}`
    )
  }
  return source
}
