/**
 * The secret-isolation boundary.
 *
 * A job container runs code that arrived in a pull request. The host it runs
 * on holds a GitHub App private key that can write check runs and re-run
 * workflows. Nothing in `contract.hostSecrets` may cross into the container,
 * and "nothing" has to mean the names, the values, and anything shaped like a
 * credential that got there by another route.
 *
 * The layering, lowest precedence first:
 *
 *   1. A small passthrough allowlist over `hostEnv`. An allowlist, not a
 *      denylist: a denylist over the ambient environment leaks whatever it has
 *      not heard of yet, and the ambient environment of a long-lived agent
 *      grows without anyone reviewing it.
 *   2. `profile.baselineEnv` - the workflow-level env block, declared and
 *      reviewed in the repository.
 *   3. `runtimeEnv` - values that only exist at run time. The local Supabase
 *      stack's service-role key is a JWT and legitimately belongs here, which
 *      is why the credential-shape filter applies to `hostEnv` only: the
 *      profile declares its fixtures on purpose, and the host environment is
 *      the leak vector.
 *   4. `lane.env` - the lane's own literal env, which wins.
 *
 * Then a final assertion pass over the built object, because the layering
 * above is an argument and the assertion is a proof.
 */

import {
  LocalCiError,
  deepFreeze,
  describeValue,
  hostSecretNames,
} from "./contract.mjs"

export class JobEnvError extends LocalCiError {}

/**
 * The only names forwarded from the agent's own environment. Everything a lane
 * needs beyond this is declared in the profile, so adding a variable to the
 * agent's shell cannot silently change what a job sees.
 */
export const HOST_ENV_PASSTHROUGH = Object.freeze([
  "DOCKER_HOST",
  "HOME",
  "HOSTNAME",
  "LANG",
  "LC_ALL",
  "PATH",
  "PLAYWRIGHT_BROWSERS_PATH",
  "SHELL",
  "TERM",
  "TMPDIR",
  "TZ",
  "USER",
])

/**
 * Credential shapes refused out of `hostEnv`. Deliberately anchored on
 * issuer-specific prefixes and a minimum length, so the profiles' short CI
 * fixtures (`sk_test_ci`, `re_ci`) are not caught: those are declared, are not
 * credentials, and a lane needs them to run at all.
 *
 * The body of each pattern accepts the issuer's own `_` separator. Stripe
 * writes `sk_live_<random>` and Resend writes `re_<id>_<random>`, so a class
 * of `[A-Za-z0-9]` stops at the second underscore and leaves only the four
 * characters of `live` to satisfy the length anchor - which no real key ever
 * did, meaning the pattern matched every shape except the one it was written
 * for. The length anchor is what excludes the fixtures, and it still does:
 * `sk_test_ci` carries seven characters after the prefix and `re_ci` two.
 */
export const CREDENTIAL_PATTERNS = Object.freeze([
  Object.freeze({
    name: "pem-private-key",
    pattern: /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/,
  }),
  Object.freeze({
    name: "stripe-secret-key",
    pattern: /\bsk_[A-Za-z0-9_]{16,}/,
  }),
  Object.freeze({
    name: "stripe-webhook-secret",
    pattern: /\bwhsec_[A-Za-z0-9_+/=]{16,}/,
  }),
  Object.freeze({ name: "resend-api-key", pattern: /\bre_[A-Za-z0-9_]{16,}/ }),
  Object.freeze({
    name: "github-token",
    pattern: /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  }),
  Object.freeze({
    name: "github-fine-grained-token",
    pattern: /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  }),
])

/**
 * The PEM check, kept separate because it is the one shape that is never a
 * legitimate job environment value under any circumstances - unlike a JWT,
 * which the local Supabase stack mints for every run.
 */
export const PEM_PRIVATE_KEY = /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/

/**
 * Shortest host-secret value the value-level leak check will search for. Below
 * this a "secret" is short enough to appear inside unrelated values by chance,
 * and the check would report noise instead of a leak.
 */
export const MINIMUM_SECRET_LENGTH = 8

/** The name of the first credential shape `value` matches, or null. */
export function credentialShapeOf(value) {
  if (typeof value !== "string") return null
  for (const entry of CREDENTIAL_PATTERNS) {
    if (entry.pattern.test(value)) return entry.name
  }
  return null
}

/** True when `value` looks like a credential rather than a fixture. */
export function isCredentialShaped(value) {
  return credentialShapeOf(value) !== null
}

/**
 * Replace every credential-shaped run in `text` with `[redacted]`. Used by
 * summary.mjs before anything is published to a check run.
 */
export function redactCredentials(text, replacement = "[redacted]") {
  if (typeof text !== "string") return text
  let redacted = text
  for (const entry of CREDENTIAL_PATTERNS) {
    redacted = redacted.replace(
      new RegExp(entry.pattern.source, "g"),
      replacement
    )
  }
  return redacted
}

function requireObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new JobEnvError(
      "INVALID_INPUT",
      `${label} must be an object (received ${describeValue(value)})`
    )
  }
  return value
}

function requireStringMap(value, label) {
  requireObject(value, label)
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== "string") {
      throw new JobEnvError(
        "INVALID_INPUT",
        `${label}.${key} must be a string (received ${describeValue(entry)})`
      )
    }
  }
  return value
}

function runtimeEnvSourcesFor(profile, lane, contract) {
  const ids = [
    ...(profile.baselineRuntimeEnv ?? []),
    ...(lane.runtimeEnv ?? []),
  ]
  const sources = contract.runtimeEnv?.sources ?? []
  return ids.map((id) => {
    const source = sources.find((entry) => entry.id === id)
    if (!source) {
      throw new JobEnvError(
        "UNKNOWN_RUNTIME_ENV_SOURCE",
        `lane ${JSON.stringify(lane.id)} references runtimeEnv source ${JSON.stringify(id)}, which the contract does not declare`
      )
    }
    return source
  })
}

/**
 * Assert that a built environment carries nothing from the host's secret set.
 *
 * Three independent checks, because each catches a different mistake:
 *
 *   - no `hostSecrets` name appears as a key (the denylist, restated over the
 *     finished object rather than over the inputs);
 *   - no `hostSecrets` *value* taken from `hostEnv` appears as any value, which
 *     is what catches a secret smuggled in under a different name;
 *   - no value contains a PEM private key block.
 *
 * Throws on the first violation. Exported so the runtime self-check can run it
 * against an environment it did not build itself.
 */
export function assertNoHostSecrets(env, contract, hostEnv = {}) {
  requireObject(env, "env")
  const denied = hostSecretNames(contract)
  const ambient = requireObject(hostEnv, "hostEnv")

  for (const name of denied) {
    if (Object.hasOwn(env, name)) {
      throw new JobEnvError(
        "HOST_SECRET_LEAKED",
        `job environment carries ${JSON.stringify(name)}, which contract.hostSecrets forbids from ever entering a container`
      )
    }
  }

  // Only substantial values are searched for. A one- or two-character host
  // secret would otherwise match inside half the legitimate values in the map
  // and turn this proof into noise.
  const secretValues = new Set()
  for (const name of denied) {
    const value = ambient[name]
    if (typeof value === "string" && value.length >= MINIMUM_SECRET_LENGTH) {
      secretValues.add(value)
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (typeof value !== "string") continue
    for (const secret of secretValues) {
      if (value.includes(secret)) {
        throw new JobEnvError(
          "HOST_SECRET_LEAKED",
          `job environment value ${JSON.stringify(key)} contains the value of a host secret; host secrets never enter a container, under any name`
        )
      }
    }
    if (PEM_PRIVATE_KEY.test(value)) {
      throw new JobEnvError(
        "HOST_SECRET_LEAKED",
        `job environment value ${JSON.stringify(key)} contains a PEM private key block`
      )
    }
  }

  return env
}

/**
 * Build the environment for one lane's job container.
 *
 * `runtimeEnv` is a flat map of already-resolved names to values - what
 * `supabase status -o env` and the generated fixtures produce, after the
 * contract's `map` has been applied. It is accepted without any of its names
 * or values needing to be contract literals, which is the whole point: those
 * values only exist at run time and must never be committed.
 *
 * Throws when any name a declared runtime-env source promises to provide is
 * missing or empty, rather than letting an empty string reach a lane that will
 * then fail somewhere far from the cause.
 *
 * Returns a frozen plain object.
 */
export function buildJobEnv({
  profile,
  lane,
  runtimeEnv = {},
  hostEnv = {},
  contract,
  passthrough = HOST_ENV_PASSTHROUGH,
} = {}) {
  requireObject(contract, "contract")
  requireObject(profile, "profile")
  requireObject(lane, "lane")
  requireStringMap(profile.baselineEnv ?? {}, "profile.baselineEnv")
  requireStringMap(lane.env ?? {}, "lane.env")
  requireStringMap(runtimeEnv, "runtimeEnv")
  requireObject(hostEnv, "hostEnv")
  if (!Array.isArray(passthrough)) {
    throw new JobEnvError(
      "INVALID_INPUT",
      `passthrough must be an array of environment variable names (received ${describeValue(passthrough)})`
    )
  }

  const denied = new Set(hostSecretNames(contract))
  const env = {}

  // 1. Host passthrough, allowlisted, then screened again for good measure.
  for (const name of passthrough) {
    if (denied.has(name)) {
      throw new JobEnvError(
        "PASSTHROUGH_DENIED",
        `passthrough lists ${JSON.stringify(name)}, which contract.hostSecrets forbids from entering a container`
      )
    }
    const value = hostEnv[name]
    if (typeof value !== "string" || value === "") continue
    const shape = credentialShapeOf(value)
    if (shape !== null) {
      // Not a refusal: the agent's own shell is allowed to contain a
      // credential. It simply does not travel into the job.
      continue
    }
    env[name] = value
  }

  // 2. The profile's baseline env block.
  for (const [name, value] of Object.entries(profile.baselineEnv ?? {})) {
    env[name] = value
  }

  // 3. Runtime-resolved values, checked against what their sources promised.
  const sources = runtimeEnvSourcesFor(profile, lane, contract)
  const promised = new Set()
  for (const source of sources) {
    for (const name of source.provides ?? []) promised.add(name)
  }
  for (const name of promised) {
    const value = runtimeEnv[name]
    if (typeof value !== "string" || value === "") {
      throw new JobEnvError(
        "UNRESOLVED_RUNTIME_ENV",
        `lane ${JSON.stringify(lane.id)} needs ${JSON.stringify(name)} from its declared runtimeEnv sources, but the resolved map has ${describeValue(value)}; refusing to pass an empty value through`
      )
    }
    env[name] = value
  }
  // A resolver may hand back more than the sources promised (a dotenv file
  // usually does). Those are layered too, because contract.runtimeEnv
  // .precedence puts runtimeEnv above baselineEnv for every value it carries,
  // not only for the ones a source happened to name in `provides` - a run-time
  // value that lost to a committed placeholder would be the precedence rule
  // silently inverted. An empty extra is dropped rather than allowed to blank
  // out a declared value, which is the same rule the promised names get above.
  for (const [name, value] of Object.entries(runtimeEnv)) {
    if (promised.has(name)) continue
    if (typeof value !== "string" || value === "") continue
    env[name] = value
  }

  // 4. The lane's own literal env wins, per contract.runtimeEnv.precedence.
  for (const [name, value] of Object.entries(lane.env ?? {})) {
    env[name] = value
  }

  // The denylist, applied over the finished map before the proof pass. Nothing
  // above can add one of these names, and this is what makes that testable.
  for (const name of denied) delete env[name]

  assertNoHostSecrets(env, contract, hostEnv)
  return deepFreeze(env)
}
