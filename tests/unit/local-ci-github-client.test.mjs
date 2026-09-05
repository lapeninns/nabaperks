import assert from "node:assert/strict"
import { createVerify, generateKeyPairSync } from "node:crypto"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  GITHUB_API_VERSION,
  GitHubApiError,
  JWT_LIFETIME_SECONDS,
  buildAppJwtClaims,
  clampCheckOutput,
  createGitHubClient,
  isRetryableStatus,
  normalisePullRequest,
  parseRateLimit,
  redactSecrets,
  retryDelayMs,
  signAppJwt,
} from "../../ops/local-ci/agent/github.mjs"

/**
 * local CI — the GitHub client, driven offline.
 *
 * `fetch`, `now` and `sleep` are injected, so the retry policy, the token
 * cache and the rate-limit handling are exercised here deterministically and
 * without a network. Two properties are the reason this file exists: the
 * installation token is minted once and never logged or returned, and every
 * error message passes through the redactor before anyone can paste it into an
 * issue.
 */

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  fileURLToPath(new URL("../../config/local-ci-contract.json", import.meta.url))
)

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
})

const APP_ID = 1234567
const INSTALLATION_ID = 89012345
const NOW = Date.parse("2026-09-04T09:00:00.000Z")
const HEAD_SHA = "1".repeat(40)

const json = (status, body, headers = {}) => ({
  status,
  headers: new Headers(headers),
  text: async () => (body === undefined ? "" : JSON.stringify(body)),
})

const TOKEN_BODY = {
  token: `ghs_${"A1b2C3d4E5f6G7h8I9j0".repeat(2)}`,
  expires_at: new Date(NOW + 3_600_000).toISOString(),
}

/**
 * A fetch over an in-memory table. `routes` is matched by `method path`
 * substring; every call is recorded so a test can count them.
 */
const stubFetch = (routes) => {
  const calls = []
  const fetch = async (url, init) => {
    const path = url.replace("https://api.github.com", "")
    const key = `${init.method} ${path}`
    calls.push({
      key,
      path,
      method: init.method,
      headers: init.headers,
      body: init.body,
    })
    const match = Object.keys(routes).find((route) => key.startsWith(route))
    if (!match) throw new Error(`unrouted request: ${key}`)
    const response = routes[match]
    return typeof response === "function" ? response(calls.length) : response
  }
  fetch.calls = calls
  return fetch
}

const client = (routes, overrides = {}) =>
  createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch: stubFetch(routes),
    now: () => NOW,
    sleep: async () => {},
    ...overrides,
  })

test("the App JWT carries an RS256 header and GitHub's claim set, signed by the App key", () => {
  const token = signAppJwt({ appId: APP_ID, privateKey, now: NOW })
  const [header, payload, signature] = token.split(".")
  assert.equal(token.split(".").length, 3)

  const decode = (part) => JSON.parse(Buffer.from(part, "base64url").toString())
  assert.deepEqual(decode(header), { alg: "RS256", typ: "JWT" })

  const claims = decode(payload)
  assert.deepEqual(claims, buildAppJwtClaims({ appId: APP_ID, now: NOW }))
  assert.equal(claims.iss, String(APP_ID))
  assert.equal(
    claims.iat,
    Math.floor(NOW / 1000) - 60,
    "iat is backdated for clock skew"
  )
  assert.equal(claims.exp - claims.iat, JWT_LIFETIME_SECONDS)
  assert.ok(
    claims.exp - Math.floor(NOW / 1000) <= 600,
    "GitHub rejects a longer-lived JWT"
  )

  // base64url, no padding.
  assert.equal(/[+/=]/.test(token), false)

  assert.ok(
    createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(publicKey, Buffer.from(signature, "base64url"))
  )
})

test("a key that cannot sign an App JWT is refused without echoing the key", () => {
  const ed25519 = generateKeyPairSync("ed25519").privateKey
  assert.throws(
    () => signAppJwt({ appId: APP_ID, privateKey: ed25519, now: NOW }),
    (error) => {
      assert.ok(error instanceof GitHubApiError)
      assert.equal(error.code, "INVALID_PRIVATE_KEY")
      return true
    }
  )

  const malformed = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "bm90LWEta2V5",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n")
  assert.throws(
    () => signAppJwt({ appId: APP_ID, privateKey: malformed, now: NOW }),
    (error) => {
      assert.equal(error.code, "INVALID_PRIVATE_KEY")
      assert.equal(error.message.includes("bm90LWEta2V5"), false)
      assert.equal(error.message.includes("BEGIN RSA PRIVATE KEY"), false)
      return true
    }
  )
  assert.throws(
    () => signAppJwt({ appId: null, privateKey, now: NOW }),
    (error) => error.code === "MISSING_APP_IDENTITY"
  )
})

test("the installation token is cached across calls and never returned to a caller", async () => {
  const fetch = stubFetch({
    "POST /app/installations": json(201, TOKEN_BODY),
    "GET /repos/lapeninns/nabaperks/pulls": json(200, []),
  })
  const github = createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch,
    now: () => NOW,
    sleep: async () => {},
  })

  await github.listOpenPullRequests()
  await github.listOpenPullRequests()
  await github.listOpenPullRequests()

  const mints = fetch.calls.filter((call) =>
    call.key.startsWith("POST /app/installations")
  )
  assert.equal(
    mints.length,
    1,
    "the token is minted once, not once per request"
  )
  assert.equal(fetch.calls.length, 4)

  // The token is used, but no caller can read it back out of the client.
  const authorised = fetch.calls.at(-1)
  assert.equal(authorised.headers.authorization, `Bearer ${TOKEN_BODY.token}`)
  assert.equal(authorised.headers["x-github-api-version"], GITHUB_API_VERSION)
  assert.equal(Object.values(github).includes(TOKEN_BODY.token), false)
  assert.equal(JSON.stringify(github).includes("ghs_"), false)

  github.invalidateToken()
  await github.listOpenPullRequests()
  assert.equal(
    fetch.calls.filter((call) => call.key.startsWith("POST /app/installations"))
      .length,
    2
  )
})

test("a non-2xx status is surfaced precisely rather than as a generic failure", async () => {
  const github = client(
    {
      "POST /app/installations": json(201, TOKEN_BODY),
      "GET /repos/lapeninns/nabaperks/commits": json(
        422,
        {
          message: "Validation Failed",
          documentation_url: "https://docs.github.com/rest",
        },
        { "x-github-request-id": "ABCD:1234" }
      ),
    },
    {}
  )

  await assert.rejects(
    () => github.getCheckRunsForRef(HEAD_SHA),
    (error) => {
      assert.ok(error instanceof GitHubApiError)
      assert.equal(error.code, "GITHUB_API_ERROR")
      assert.equal(error.status, 422)
      assert.equal(error.apiMessage, "Validation Failed")
      assert.equal(error.method, "GET")
      assert.equal(error.requestId, "ABCD:1234")
      assert.match(error.message, /HTTP 422/)
      assert.match(error.message, /Validation Failed/)
      return true
    }
  )
})

test("a rate limit is named as one, with the quota reset in the message", async () => {
  const reset = Math.floor(NOW / 1000) + 900
  const github = client(
    {
      "POST /app/installations": json(201, TOKEN_BODY),
      "GET /repos/lapeninns/nabaperks/pulls": json(
        403,
        { message: "API rate limit exceeded" },
        {
          "x-ratelimit-limit": "5000",
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": String(reset),
        }
      ),
    },
    { maxAttempts: 1 }
  )

  await assert.rejects(
    () => github.listOpenPullRequests(),
    (error) => {
      assert.equal(error.code, "GITHUB_RATE_LIMITED")
      assert.equal(error.status, 403)
      assert.equal(error.rateLimit.remaining, 0)
      assert.match(error.message, /quota resets at/)
      return true
    }
  )

  // A 403 without an exhausted quota is a permission failure, and retrying it
  // just burns what is left.
  assert.equal(isRetryableStatus(403, { remaining: 0 }), true)
  assert.equal(isRetryableStatus(403, { remaining: 4999 }), false)
  assert.equal(isRetryableStatus(500, null), true)
  assert.equal(isRetryableStatus(404, null), false)
})

test("a retryable status is retried, and the wait honours retry-after", async () => {
  const slept = []
  const fetch = stubFetch({
    "POST /app/installations": json(201, TOKEN_BODY),
    "GET /repos/lapeninns/nabaperks/pulls": (callNumber) =>
      callNumber === 2
        ? json(503, { message: "Service Unavailable" }, { "retry-after": "7" })
        : json(200, []),
  })
  const github = createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch,
    now: () => NOW,
    sleep: async (ms) => {
      slept.push(ms)
    },
  })

  assert.deepEqual(await github.listOpenPullRequests(), [])
  assert.equal(fetch.calls.length, 3, "mint, failed attempt, successful retry")
  assert.deepEqual(slept, [7000])

  assert.equal(retryDelayMs(1, { retryAfterSeconds: 7 }, NOW), 7000)
  assert.equal(retryDelayMs(1, null, NOW), 1000)
  assert.equal(retryDelayMs(3, null, NOW), 4000)
  assert.equal(
    retryDelayMs(1, { remaining: 0, resetEpochSeconds: NOW / 1000 + 30 }, NOW),
    31_000
  )
})

test("error messages are redacted before anyone can paste one into an issue", () => {
  const token = `ghs_${"A1b2C3d4E5f6G7h8I9j0".repeat(2)}`
  const jwt = [
    "eyJhbGciOiJSUzI1NiJ9",
    "eyJpc3MiOiIxMjM0NTY3In0",
    "c2lnbmF0dXJl",
  ].join(".")
  const pem = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEowIBAAKCAQEAsecretkeymaterial",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n")

  const redacted = redactSecrets(
    `failed with ${token}, jwt ${jwt}, header Authorization: Bearer ${token}\n${pem}`
  )
  assert.equal(redacted.includes(token), false)
  assert.equal(redacted.includes(jwt), false)
  assert.equal(redacted.includes("MIIEowIBAAKCAQEAsecretkeymaterial"), false)
  assert.match(redacted, /Bearer \[redacted\]/)
})

test("an unreachable API is reported as such, with the failing method and path", async () => {
  const github = createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch: async () => {
      throw new Error("getaddrinfo ENOTFOUND api.github.com")
    },
    now: () => NOW,
    sleep: async () => {},
    maxAttempts: 2,
  })
  await assert.rejects(
    () => github.getRef("heads/main"),
    (error) => {
      assert.equal(error.code, "GITHUB_UNREACHABLE")
      assert.match(error.message, /POST \/app\/installations/)
      return true
    }
  )
})

test("the only Actions write with a call site is the one the contract authorises", async () => {
  const fetch = stubFetch({
    "POST /app/installations": json(201, TOKEN_BODY),
    "POST /repos/lapeninns/nabaperks/actions/runs/909/rerun-failed-jobs": json(
      201,
      {}
    ),
  })
  const github = createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch,
    now: () => NOW,
    sleep: async () => {},
  })

  assert.deepEqual(await github.rerunWorkflowJob({ runId: 909 }), {
    runId: 909,
    operation: "rerun-failed-jobs",
  })
  assert.ok(
    fetch.calls.some((call) =>
      call.key.endsWith("/actions/runs/909/rerun-failed-jobs")
    )
  )

  for (const operation of ["cancel", "delete-artifact", "workflow-dispatch"]) {
    await assert.rejects(
      () => github.rerunWorkflowJob({ runId: 909, operation }),
      (error) => error.code === "ACTIONS_WRITE_REFUSED"
    )
  }
  assert.equal(
    fetch.calls.filter((call) => call.key.includes("/actions/")).length,
    1
  )
})

test("a check run is published with the fields the Checks API expects", async () => {
  const fetch = stubFetch({
    "POST /app/installations": json(201, TOKEN_BODY),
    "POST /repos/lapeninns/nabaperks/check-runs": json(201, { id: 4242 }),
    "PATCH /repos/lapeninns/nabaperks/check-runs/4242": json(200, { id: 4242 }),
  })
  const github = createGitHubClient({
    contract,
    appId: APP_ID,
    installationId: INSTALLATION_ID,
    privateKey,
    fetch,
    now: () => NOW,
    sleep: async () => {},
  })

  const created = await github.createCheckRun({
    name: contract.checkName,
    headSha: HEAD_SHA,
    status: "in_progress",
    startedAt: new Date(NOW).toISOString(),
    output: { title: "pr — running", summary: "claimed the head SHA" },
  })
  assert.equal(created.id, 4242)

  const body = JSON.parse(fetch.calls.at(-1).body)
  assert.equal(body.name, contract.checkName)
  assert.equal(body.head_sha, HEAD_SHA)
  assert.equal(body.status, "in_progress")
  assert.equal(body.conclusion, undefined)

  await github.updateCheckRun(4242, {
    status: "completed",
    conclusion: "success",
  })
  assert.equal(JSON.parse(fetch.calls.at(-1).body).conclusion, "success")
  await assert.rejects(
    () => github.updateCheckRun(null, { status: "completed" }),
    (error) => error.code === "INVALID_INPUT"
  )
})

test("an oversized check output is clamped with the truncation announced", () => {
  const clamped = clampCheckOutput({
    title: "ok",
    summary: "ok",
    text: "x".repeat(70_000),
  })
  assert.ok(clamped.text.length <= 65535)
  assert.match(
    clamped.text,
    /text truncated at 65535 characters by the agent\./
  )
  assert.equal(clamped.title, "ok")
})

test("pull requests normalise into the shape the allowlist classifies", () => {
  const forked = normalisePullRequest({
    number: 41,
    title: "Add a thing",
    draft: false,
    head: {
      ref: "feature",
      sha: HEAD_SHA,
      repo: { full_name: "contributor/nabaperks", id: 55 },
    },
    base: { ref: "main", repo: { full_name: "lapeninns/nabaperks", id: 7 } },
  })
  assert.equal(forked.event, "pull_request")
  assert.equal(forked.ref, "refs/pull/41/head")
  assert.equal(forked.headRepository, "contributor/nabaperks")
  assert.equal(forked.baseRepository, "lapeninns/nabaperks")

  // GitHub returns head.repo: null when the fork has been deleted. That has to
  // classify as "no head repository" rather than crash the poll.
  const deleted = normalisePullRequest({
    number: 42,
    head: { ref: "gone", sha: HEAD_SHA, repo: null },
    base: { ref: "main", repo: { full_name: "lapeninns/nabaperks" } },
  })
  assert.equal(deleted.headRepository, null)
  assert.throws(
    () => normalisePullRequest(null),
    (error) => error.code === "INVALID_RESPONSE"
  )
})

test("rate-limit headers are read from either a Headers object or a plain record", () => {
  const headers = new Headers({
    "x-ratelimit-limit": "5000",
    "x-ratelimit-remaining": "17",
    "x-ratelimit-reset": "1788000000",
    "x-ratelimit-resource": "core",
  })
  assert.deepEqual(parseRateLimit(headers), {
    limit: 5000,
    remaining: 17,
    resetEpochSeconds: 1788000000,
    resource: "core",
    retryAfterSeconds: null,
  })
  assert.equal(parseRateLimit({ "x-ratelimit-remaining": "0" }).remaining, 0)
  assert.equal(parseRateLimit(null).limit, null)
})

test("the client refuses to exist without the identity it needs", () => {
  // appId and installationId are null sentinels in the contract until the App
  // has been created and installed by hand.
  assert.throws(
    () => createGitHubClient({ contract, privateKey, fetch: async () => {} }),
    (error) => error.code === "MISSING_APP_IDENTITY"
  )
  assert.throws(
    () =>
      createGitHubClient({
        contract,
        appId: APP_ID,
        installationId: INSTALLATION_ID,
        fetch: async () => {},
      }),
    (error) => error.code === "INVALID_PRIVATE_KEY"
  )
})
