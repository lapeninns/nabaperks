import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

const SENTRY_API_ORIGIN = "https://sentry.io"
const REQUEST_TIMEOUT_MS = 10_000
const MAX_ATTEMPTS = 6

function required(env, name) {
  const value = env[name]?.trim() ?? ""
  assert.ok(value, `${name} is required`)
  return value
}

function sentrySlug(env, name) {
  const value = required(env, name)
  assert.match(
    value,
    /^[a-z0-9][a-z0-9_-]{0,63}$/,
    `${name} must be a Sentry slug`
  )
  return value
}

function immutableDeploymentUrl(rawValue) {
  const url = new URL(rawValue)
  assert.equal(url.protocol, "https:", "Sentry deploy URL must use HTTPS")
  assert.match(
    url.hostname,
    /^[a-z0-9-]+\.vercel\.app$/,
    "Sentry deploy URL must be an immutable Vercel deployment"
  )
  assert.equal(
    url.username,
    "",
    "Sentry deploy URL must not contain credentials"
  )
  assert.equal(
    url.password,
    "",
    "Sentry deploy URL must not contain credentials"
  )
  assert.equal(url.port, "", "Sentry deploy URL must not use a custom port")
  assert.equal(url.search, "", "Sentry deploy URL must not contain a query")
  assert.equal(url.hash, "", "Sentry deploy URL must not contain a fragment")
  return url.href
}

export function resolveSentryReleaseConfig(env = process.env) {
  const revision = required(env, "SENTRY_RELEASE")
  assert.match(
    revision,
    /^[a-f0-9]{40}$/,
    "SENTRY_RELEASE must be a full lowercase Git SHA"
  )

  const authToken = required(env, "SENTRY_AUTH_TOKEN")
  assert.ok(
    authToken.length >= 20 && authToken.length <= 2_048,
    "SENTRY_AUTH_TOKEN has an invalid length"
  )

  return {
    authToken,
    deploymentUrl: env.SENTRY_DEPLOYMENT_URL?.trim()
      ? immutableDeploymentUrl(env.SENTRY_DEPLOYMENT_URL.trim())
      : null,
    organization: sentrySlug(env, "SENTRY_ORG"),
    project: sentrySlug(env, "SENTRY_PROJECT"),
    revision,
  }
}

function releaseUrl(config) {
  const path = [
    "api",
    "0",
    "organizations",
    encodeURIComponent(config.organization),
    "releases",
    encodeURIComponent(config.revision),
    "",
  ].join("/")
  const url = new URL(path, `${SENTRY_API_ORIGIN}/`)
  url.searchParams.set("project", config.project)
  return url
}

function deploysUrl(config) {
  return new URL(
    [
      "api",
      "0",
      "organizations",
      encodeURIComponent(config.organization),
      "releases",
      encodeURIComponent(config.revision),
      "deploys",
      "",
    ].join("/"),
    `${SENTRY_API_ORIGIN}/`
  )
}

async function sentryJson(config, url, init = {}, fetcher = fetch) {
  const response = await fetcher(url, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${config.authToken}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
    },
    redirect: "error",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })

  if (!response.ok) {
    const error = new Error(`Sentry API returned HTTP ${response.status}`)
    error.retryable =
      response.status === 404 ||
      response.status === 429 ||
      response.status >= 500
    throw error
  }

  return response.json()
}

function validateRelease(document, config, requireProductionDeploy = false) {
  assert.equal(
    document?.version,
    config.revision,
    "Sentry release does not match the promoted Git SHA"
  )
  assert.ok(
    document.projects?.some(({ slug }) => slug === config.project),
    "Sentry release is not associated with the configured project"
  )
  assert.ok(
    Number.isFinite(Date.parse(document.dateCreated)),
    "Sentry release has no valid creation time"
  )

  if (requireProductionDeploy) {
    assert.equal(
      document.lastDeploy?.environment,
      "production",
      "Sentry did not read back the production deploy"
    )
    assert.equal(
      document.lastDeploy?.url,
      config.deploymentUrl,
      "Sentry deploy does not identify the promoted Vercel deployment"
    )
  }

  return document
}

export async function verifySentryRelease({
  config = resolveSentryReleaseConfig(),
  fetcher = fetch,
  attempts = MAX_ATTEMPTS,
  requireProductionDeploy = false,
  sleeper = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
} = {}) {
  assert.ok(
    Number.isInteger(attempts) && attempts >= 1 && attempts <= MAX_ATTEMPTS,
    "invalid Sentry verification attempt count"
  )

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const document = await sentryJson(config, releaseUrl(config), {}, fetcher)
      validateRelease(document, config, requireProductionDeploy)
      return {
        attempt,
        createdAt: document.dateCreated,
        project: config.project,
        revision: config.revision,
        schema: "nabaperks.sentry-release.v1",
      }
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("Sentry verification failed")
      if (!lastError.retryable || attempt === attempts) throw lastError
      await sleeper(2 ** (attempt - 1) * 1_000)
    }
  }

  throw lastError
}

export async function recordSentryProductionDeploy({
  config = resolveSentryReleaseConfig(),
  fetcher = fetch,
  now = () => new Date(),
  sleeper,
} = {}) {
  assert.ok(
    config.deploymentUrl,
    "SENTRY_DEPLOYMENT_URL is required to record a deploy"
  )
  await verifySentryRelease({ config, fetcher, sleeper })

  const deploy = await sentryJson(
    config,
    deploysUrl(config),
    {
      method: "POST",
      body: JSON.stringify({
        dateFinished: now().toISOString(),
        environment: "production",
        name: "Nabaperks production",
        projects: [config.project],
        url: config.deploymentUrl,
      }),
    },
    fetcher
  )
  assert.equal(
    deploy?.environment,
    "production",
    "Sentry rejected the production deploy environment"
  )
  assert.equal(
    deploy?.url,
    config.deploymentUrl,
    "Sentry rejected the production deployment URL"
  )

  return verifySentryRelease({
    config,
    fetcher,
    requireProductionDeploy: true,
    sleeper,
  })
}

async function main() {
  const action = process.argv[2] ?? "verify"
  assert.ok(
    action === "verify" || action === "record-deploy",
    "Sentry action must be verify or record-deploy"
  )
  const result =
    action === "record-deploy"
      ? await recordSentryProductionDeploy()
      : await verifySentryRelease()
  console.log(JSON.stringify(result))
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Sentry release proof failed"
    )
    process.exitCode = 1
  })
}
