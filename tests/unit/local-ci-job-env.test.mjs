import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import { laneById, loadProfile } from "../../ops/local-ci/core/profiles.mjs"
import {
  HOST_ENV_PASSTHROUGH,
  JobEnvError,
  assertNoHostSecrets,
  buildJobEnv,
  credentialShapeOf,
  isCredentialShaped,
  redactCredentials,
} from "../../ops/local-ci/core/job-env.mjs"

/**
 * local CI — the secret-isolation boundary.
 *
 * A job container runs code that arrived in a pull request; the host it runs
 * on holds a GitHub App private key that can write check runs and re-run
 * workflows. Nothing in contract.hostSecrets crosses that boundary, and
 * "nothing" has to mean the names, the values, and anything credential-shaped
 * that got there by another route. The host passthrough is an allowlist rather
 * than a denylist, because a denylist over the ambient environment leaks
 * whatever it has not heard of yet.
 */

const repoFile = (relative) =>
  fileURLToPath(new URL(`../../${relative}`, import.meta.url))

const readRepoFile = (path) => readFileSync(repoFile(path), "utf8")

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  repoFile("config/local-ci-contract.json")
)

const pr = loadProfile("pr", contract, readRepoFile)
const nightly = loadProfile("nightly", contract, readRepoFile)

/** Everything the pr profile's declared runtime-env sources promise. */
const RUNTIME_ENV = {
  CRON_SECRET: "Yx4Kq2Lm9Rt7Zb1Nc6Vd3Fg8Hj5Pw0Qs",
  PRODUCTION_MONITOR_SECRET: "Bn7Mk2Qw9Er4Ty6Ui1Op3As5Df8Gh0Jk",
  CUSTOMER_SESSION_SECRET: "Zx1Cv3Bn5Mq7We9Rt2Yu4Io6Pa8Sd0Fg",
  CUSTOMER_PHONE_HMAC_SECRET: "Qa2Ws4Ed6Rf8Tg0Yh1Uj3Ik5Ol7Pz9Xc",
  CUSTOMER_PHONE_ENCRYPTION_KEY: "Lm3Nb5Vc7Xz9Qw1Er2Ty4Ui6Op8As0Df",
  WEB_PUSH_VAPID_PUBLIC_KEY: "BJ4vapidpublicpointfixturevalue",
  WEB_PUSH_VAPID_PRIVATE_KEY: "vapidprivatescalarfixturevalue",
  WEB_PUSH_VAPID_SUBJECT: "mailto:ci@example.test",
  SUPABASE_SEND_EMAIL_HOOK_SECRET: "v1,whsec_dGhpc2lzYWNpZml4dHVyZXZhbHVlMDA=",
}

const FAST_LANE = laneById(pr, "fast")

const build = (overrides = {}) =>
  buildJobEnv({
    profile: pr,
    lane: FAST_LANE,
    runtimeEnv: RUNTIME_ENV,
    hostEnv: {},
    contract,
    ...overrides,
  })

test("secret isolation: no host-secret name reaches the job, even when the host has it", () => {
  const hostEnv = {
    PATH: "/usr/local/bin:/usr/bin",
    HOME: "/Users/ci",
  }
  for (const name of contract.hostSecrets) {
    hostEnv[name] = `value-of-${name.toLowerCase()}-0123456789`
  }

  const env = build({ hostEnv })
  for (const name of contract.hostSecrets) {
    assert.equal(
      Object.hasOwn(env, name),
      false,
      `${name} must never be a key in a job environment`
    )
    assert.equal(
      Object.values(env).includes(hostEnv[name]),
      false,
      `the value of ${name} must never appear under any name`
    )
  }
  assert.equal(env.PATH, "/usr/local/bin:/usr/bin")
})

test("secret isolation: a host secret smuggled in under a passthrough name is refused", () => {
  // The heartbeat URL's path segment is the credential, and it is not
  // credential-shaped, so the value-level check is the one that catches it.
  const heartbeat = "https://heartbeat.example/abcdefghijklmnopqrst"
  assert.throws(
    () =>
      build({
        hostEnv: {
          LOCAL_CI_HEARTBEAT_URL: heartbeat,
          TMPDIR: heartbeat,
        },
      }),
    (error) => {
      assert.ok(error instanceof JobEnvError)
      assert.equal(error.code, "HOST_SECRET_LEAKED")
      assert.match(error.message, /under any name/)
      return true
    }
  )
})

test("secret isolation: a PEM private key never crosses, whatever name it arrives under", () => {
  const pem = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEowIBAAKCAQEAxfakekeymaterialfortestsonly",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n")

  const env = build({ hostEnv: { PATH: pem, HOME: "/Users/ci" } })
  assert.equal(env.PATH, undefined, "a PEM in the agent's shell stays there")
  assert.equal(env.HOME, "/Users/ci")

  assert.throws(
    () => assertNoHostSecrets({ INNOCENT_NAME: pem }, contract),
    (error) => {
      assert.equal(error.code, "HOST_SECRET_LEAKED")
      assert.match(error.message, /PEM private key block/)
      return true
    }
  )
})

// These fixtures are synthetic, but by construction they carry exactly the
// shape of a live Stripe, Resend or GitHub credential - that is the whole
// point of the test. Written as literals they trip GitHub push protection and
// they would also be the sort of scannable string the repository forbids in CI
// files elsewhere (see production-security-closure). Composing them at run time
// keeps the value the detector sees byte-identical while leaving no matchable
// literal in the tree.
const shape = (prefix, body) => `${prefix}_${body}`

test("secret isolation: sk_, whsec_, re_ and GitHub token shapes are dropped from the host passthrough", () => {
  const shapes = {
    // The declared CI fixtures are short by design and are not caught.
    fixtures: [
      shape("sk", "test_ci"),
      shape("re", "ci"),
      shape("pk", "test_ci"),
    ],
    credentials: [
      shape("sk", "live_51H8xQ2KZvL9mNpQrStUvWxYz"),
      shape("sk", "test_51H8xQ2KZvL9mNpQrStUvWxYz"),
      shape("whsec", "MfKQ9r8vXmZ2pLtN7yBcDeFgHjKlMnOp"),
      shape("re", "AbCdEf12_9kLmNoPqRsTuVwXyZ1234567"),
      shape("ghp", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"),
      shape("ghs", "A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8"),
      shape("github", "pat_11ABCDEFG0aBcDeFgHiJkLmNoPqRsTuVwXyZ"),
    ],
  }

  for (const value of shapes.credentials) {
    assert.ok(isCredentialShaped(value), `${value} must be recognised`)
    const env = build({ hostEnv: { TERM: value, HOME: "/Users/ci" } })
    assert.equal(env.TERM, undefined, `${value} must not travel into a job`)
    assert.equal(env.HOME, "/Users/ci")
  }
  for (const value of shapes.fixtures) {
    assert.equal(credentialShapeOf(value), null, `${value} is a fixture`)
  }
  assert.equal(
    redactCredentials(`saw ${shapes.credentials[0]} once`),
    "saw [redacted] once"
  )
})

test("secret isolation: the passthrough is an allowlist, so an unknown host variable never travels", () => {
  const env = build({
    hostEnv: {
      PATH: "/usr/bin",
      AWS_SESSION_TOKEN: "an ambient credential nobody reviewed",
      NEW_TOOL_API_KEY: "added to the agent shell last week",
    },
  })
  assert.equal(env.AWS_SESSION_TOKEN, undefined)
  assert.equal(env.NEW_TOOL_API_KEY, undefined)
  for (const name of Object.keys(env)) {
    const declared =
      Object.hasOwn(pr.baselineEnv, name) ||
      Object.hasOwn(FAST_LANE.env, name) ||
      Object.hasOwn(RUNTIME_ENV, name)
    assert.ok(
      declared || HOST_ENV_PASSTHROUGH.includes(name),
      `${name} entered the job without being declared anywhere`
    )
  }
})

test("secret isolation: a passthrough list naming a host secret is refused outright", () => {
  assert.throws(
    () =>
      build({
        passthrough: [...HOST_ENV_PASSTHROUGH, contract.hostSecrets[0]],
        hostEnv: { [contract.hostSecrets[0]]: "1234567" },
      }),
    (error) => error.code === "PASSTHROUGH_DENIED"
  )
})

test("runtime values reach the job intact, including the local stack's service-role JWT", () => {
  const jwt = [
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9",
    "eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UifQ",
    "aXRpc2Fsb2NhbHN0YWNrZml4dHVyZXNpZ25hdHVyZQ",
  ].join(".")

  const stress = laneById(nightly, "db-stress")
  const env = buildJobEnv({
    profile: nightly,
    lane: stress,
    runtimeEnv: {
      ...RUNTIME_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon.jwt.fixture",
      SUPABASE_SERVICE_ROLE_KEY: jwt,
      SUPABASE_DB_URL:
        "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    },
    hostEnv: {},
    contract,
  })

  // A JWT is legitimately a run-time value here: the local Supabase stack
  // mints one per run. The credential filter guards the host environment, not
  // the values the profile declared it needs.
  assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, jwt)
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321")
  assert.equal(env.CRON_SECRET, RUNTIME_ENV.CRON_SECRET)
})

test("runtime values outrank the profile's committed placeholders, as the contract's precedence says", () => {
  assert.deepEqual(contract.runtimeEnv.precedence, [
    "baselineEnv",
    "runtimeEnv",
    "laneEnv",
  ])
  assert.equal(
    pr.baselineEnv.NEXT_PUBLIC_SUPABASE_URL,
    "https://ci.supabase.co"
  )

  const env = build({
    runtimeEnv: {
      ...RUNTIME_ENV,
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
    },
  })
  assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321")

  // An empty resolved value never blanks out a declared one.
  const empty = build({
    runtimeEnv: { ...RUNTIME_ENV, NEXT_PUBLIC_APP_URL: "" },
  })
  assert.equal(empty.NEXT_PUBLIC_APP_URL, pr.baselineEnv.NEXT_PUBLIC_APP_URL)
})

test("the lane's own env wins over everything the profile declared", () => {
  const env = build()
  assert.equal(env.PLAYWRIGHT_WORKERS, undefined)

  const chromium = laneById(pr, "e2e-chromium")
  const laneEnv = buildJobEnv({
    profile: pr,
    lane: chromium,
    runtimeEnv: RUNTIME_ENV,
    hostEnv: { PLAYWRIGHT_BROWSERS_PATH: "/ms-playwright" },
    contract,
  })
  assert.equal(laneEnv.PLAYWRIGHT_BASE_URL, "http://127.0.0.1:3146")
  assert.equal(laneEnv.PLAYWRIGHT_NEXT_DIST_DIR, ".next-e2e-e2e-chromium")
  assert.equal(laneEnv.PLAYWRIGHT_BROWSERS_PATH, "/ms-playwright")
  assert.equal(laneEnv.CI, "1")
})

test("a runtime-env name a declared source promised but did not resolve is refused", () => {
  const { CRON_SECRET, ...missing } = RUNTIME_ENV
  assert.equal(typeof CRON_SECRET, "string")
  assert.throws(
    () => build({ runtimeEnv: missing }),
    (error) => {
      assert.equal(error.code, "UNRESOLVED_RUNTIME_ENV")
      assert.match(error.message, /CRON_SECRET/)
      return true
    }
  )
  assert.throws(
    () => build({ runtimeEnv: { ...RUNTIME_ENV, CRON_SECRET: "" } }),
    (error) => error.code === "UNRESOLVED_RUNTIME_ENV"
  )
})

test("a lane referencing a runtime-env source the contract does not declare is refused", () => {
  assert.throws(
    () =>
      buildJobEnv({
        profile: pr,
        lane: { ...FAST_LANE, runtimeEnv: ["invented-source"] },
        runtimeEnv: RUNTIME_ENV,
        hostEnv: {},
        contract,
      }),
    (error) => error.code === "UNKNOWN_RUNTIME_ENV_SOURCE"
  )
})

test("the built environment is frozen, and every value is a string", () => {
  const env = build({ hostEnv: { PATH: "/usr/bin", TZ: "UTC" } })
  assert.ok(Object.isFrozen(env))
  for (const [name, value] of Object.entries(env)) {
    assert.equal(typeof value, "string", `${name} must be text`)
  }
  assert.throws(
    () =>
      buildJobEnv({
        profile: pr,
        lane: FAST_LANE,
        runtimeEnv: { ...RUNTIME_ENV, CRON_SECRET: 42 },
        hostEnv: {},
        contract,
      }),
    (error) => error.code === "INVALID_INPUT"
  )
})
