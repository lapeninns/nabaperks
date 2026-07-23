import assert from "node:assert/strict"
import { test } from "node:test"

import {
  recordSentryProductionDeploy,
  resolveSentryReleaseConfig,
  verifySentryRelease,
} from "../../scripts/check-sentry-release.mjs"

const REVISION = "abcdef1234567890abcdef1234567890abcdef12"
const DEPLOYMENT_URL = "https://nabaperks-abcdef.vercel.app/"
const ENV = {
  SENTRY_AUTH_TOKEN: "sntrys_test_token_with_sufficient_length",
  SENTRY_DEPLOYMENT_URL: DEPLOYMENT_URL,
  SENTRY_ORG: "lapen-inns",
  SENTRY_PROJECT: "nabaperks",
  SENTRY_RELEASE: REVISION,
}

function release(overrides = {}) {
  return {
    dateCreated: "2026-07-23T12:00:00.000Z",
    lastDeploy: null,
    projects: [{ slug: "nabaperks" }],
    version: REVISION,
    ...overrides,
  }
}

test("Sentry release config accepts only immutable release and deployment identities", () => {
  assert.deepEqual(resolveSentryReleaseConfig(ENV), {
    authToken: ENV.SENTRY_AUTH_TOKEN,
    deploymentUrl: DEPLOYMENT_URL,
    organization: "lapen-inns",
    project: "nabaperks",
    revision: REVISION,
  })

  for (const invalid of [
    { SENTRY_RELEASE: REVISION.slice(0, 12) },
    { SENTRY_ORG: "https://attacker.invalid" },
    { SENTRY_PROJECT: "../other-project" },
    { SENTRY_DEPLOYMENT_URL: "https://nabaperks.com/" },
    {
      SENTRY_DEPLOYMENT_URL:
        "https://nabaperks-abcdef.vercel.app/?token=secret",
    },
  ]) {
    assert.throws(() => resolveSentryReleaseConfig({ ...ENV, ...invalid }))
  }
})

test("exact Sentry release proof is project-bound and never sends the token in the URL", async () => {
  const config = resolveSentryReleaseConfig(ENV)
  let request
  const result = await verifySentryRelease({
    config,
    fetcher: async (url, init) => {
      request = { init, url: String(url) }
      return Response.json(release())
    },
  })

  assert.equal(result.schema, "nabaperks.sentry-release.v1")
  assert.equal(result.revision, REVISION)
  assert.equal(result.project, "nabaperks")
  assert.match(
    request.url,
    new RegExp(`/releases/${REVISION}/\\?project=nabaperks$`)
  )
  assert.doesNotMatch(request.url, /sntrys_/)
  assert.equal(
    request.init.headers.authorization,
    `Bearer ${ENV.SENTRY_AUTH_TOKEN}`
  )
})

test("Sentry release proof retries eventual-consistency responses and rejects drift", async () => {
  let calls = 0
  const result = await verifySentryRelease({
    config: resolveSentryReleaseConfig(ENV),
    sleeper: async () => {},
    fetcher: async () => {
      calls += 1
      return calls === 1
        ? new Response(null, { status: 404 })
        : Response.json(release())
    },
  })
  assert.equal(result.attempt, 2)

  await assert.rejects(
    verifySentryRelease({
      config: resolveSentryReleaseConfig(ENV),
      fetcher: async () =>
        Response.json(release({ projects: [{ slug: "other-project" }] })),
    }),
    /configured project/
  )
  await assert.rejects(
    verifySentryRelease({
      config: resolveSentryReleaseConfig(ENV),
      fetcher: async () => Response.json(release({ version: "wrong" })),
    }),
    /promoted Git SHA/
  )
})

test("production deploy recording verifies the release before and after the mutation", async () => {
  const requests = []
  const responses = [
    Response.json(release()),
    Response.json({
      environment: "production",
      url: DEPLOYMENT_URL,
    }),
    Response.json(
      release({
        lastDeploy: {
          environment: "production",
          url: DEPLOYMENT_URL,
        },
      })
    ),
  ]

  const result = await recordSentryProductionDeploy({
    config: resolveSentryReleaseConfig(ENV),
    now: () => new Date("2026-07-23T13:00:00.000Z"),
    sleeper: async () => {},
    fetcher: async (url, init) => {
      requests.push({ init, url: String(url) })
      return responses.shift()
    },
  })

  assert.equal(requests.length, 3)
  assert.equal(requests[1].init.method, "POST")
  assert.deepEqual(JSON.parse(requests[1].init.body), {
    dateFinished: "2026-07-23T13:00:00.000Z",
    environment: "production",
    name: "Nabaperks production",
    projects: ["nabaperks"],
    url: DEPLOYMENT_URL,
  })
  assert.equal(result.revision, REVISION)
})
