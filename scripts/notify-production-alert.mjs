import { createHmac, randomUUID as createRandomUUID } from "node:crypto"
import { pathToFileURL } from "node:url"

const ALERT_SCHEMA = "nabaperks.production-alert.v1"
const MAX_ATTEMPTS = 3
const REQUEST_TIMEOUT_MS = 10_000
const ALERT_KINDS = {
  readiness: {
    dedupKey: "nabaperks-production-readiness",
    summary: "Nabaperks production liveness or readiness probe failed",
  },
  "availability-slo": {
    dedupKey: "nabaperks-production-availability-slo",
    summary: "Nabaperks production availability SLO is breached",
  },
  "release-canary": {
    dedupKey: "nabaperks-production-release-canary",
    summary: "Nabaperks production alert receiver release canary",
  },
}

function invariant(condition, message) {
  if (!condition) throw new Error(message)
}

export function resolveProductionAlertConfig(env = process.env) {
  const endpoint = trustedAlertEndpoint(env.PRODUCTION_ALERT_WEBHOOK_URL)
  invariant(endpoint, "PRODUCTION_ALERT_WEBHOOK_URL must be a public HTTPS URL")

  const secret = env.PRODUCTION_ALERT_WEBHOOK_SECRET?.trim() ?? ""
  invariant(
    secret.length >= 32 && secret.length <= 512,
    "PRODUCTION_ALERT_WEBHOOK_SECRET must contain 32 to 512 characters"
  )

  const repository = env.GITHUB_REPOSITORY?.trim() ?? ""
  invariant(
    repository === "lapeninns/nabaperks",
    "GITHUB_REPOSITORY must be lapeninns/nabaperks"
  )

  const serverUrl = env.GITHUB_SERVER_URL?.trim() ?? ""
  invariant(serverUrl === "https://github.com", "unexpected GitHub server URL")

  const runId = env.GITHUB_RUN_ID?.trim() ?? ""
  invariant(/^\d+$/.test(runId), "GITHUB_RUN_ID must be numeric")

  const revision = env.EXPECTED_REVISION?.trim() ?? ""
  invariant(
    revision === "" || /^(?:[a-f0-9]{12}|[a-f0-9]{40})$/.test(revision),
    "EXPECTED_REVISION must be empty or a 12/40-character Git SHA"
  )

  return {
    endpoint,
    repository,
    revision: revision ? revision.slice(0, 12) : null,
    runUrl: `${serverUrl}/${repository}/actions/runs/${runId}`,
    secret,
  }
}

export function trustedAlertEndpoint(rawValue) {
  try {
    const url = new URL(rawValue?.trim() ?? "")
    const hostname = url.hostname.toLowerCase()
    const privateIpv4 =
      /^127\./.test(hostname) ||
      /^10\./.test(hostname) ||
      /^192\.168\./.test(hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\./.test(hostname)
    const localHostname =
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local")

    if (
      url.protocol !== "https:" ||
      !hostname ||
      localHostname ||
      privateIpv4 ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash
    ) {
      return null
    }

    return url.href
  } catch {
    return null
  }
}

export function buildSignedAlert({
  action,
  config,
  deliveryId,
  kind = "readiness",
  occurredAt,
}) {
  invariant(
    action === "trigger" || action === "resolve",
    "alert action must be trigger or resolve"
  )
  const alertKind = ALERT_KINDS[kind]
  invariant(alertKind, "alert kind is not supported")

  const payload = {
    schema: ALERT_SCHEMA,
    action,
    kind,
    dedupKey: alertKind.dedupKey,
    deliveryId,
    severity: "critical",
    service: "nabaperks",
    environment: "production",
    summary: alertKind.summary,
    revision: config.revision,
    runUrl: config.runUrl,
    occurredAt,
  }
  const body = JSON.stringify(payload)
  const timestamp = String(Math.floor(new Date(occurredAt).getTime() / 1_000))
  const signature = createHmac("sha256", config.secret)
    .update(`${timestamp}.${body}`)
    .digest("hex")

  return {
    body,
    headers: {
      "content-type": "application/json",
      "user-agent": "nabaperks-production-monitor/1.0",
      "x-nabaperks-delivery": deliveryId,
      "x-nabaperks-signature": `v1=${signature}`,
      "x-nabaperks-timestamp": timestamp,
    },
  }
}

export async function sendProductionAlert({
  action,
  kind = "readiness",
  env = process.env,
  fetcher = fetch,
  now = () => new Date(),
  randomUUID = createRandomUUID,
  sleeper = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
  attempts = MAX_ATTEMPTS,
} = {}) {
  invariant(
    Number.isInteger(attempts) && attempts >= 1 && attempts <= 5,
    "invalid attempt count"
  )
  const config = resolveProductionAlertConfig(env)
  const signedAlert = buildSignedAlert({
    action,
    config,
    deliveryId: randomUUID(),
    kind,
    occurredAt: now().toISOString(),
  })

  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetcher(config.endpoint, {
        method: "POST",
        headers: signedAlert.headers,
        body: signedAlert.body,
        redirect: "error",
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
      if (response.ok) return { attempt, status: response.status }

      const retryable = response.status === 429 || response.status >= 500
      if (!retryable) {
        throw new Error(
          `alert receiver rejected delivery with HTTP ${response.status}`
        )
      }
      lastError = new Error(`alert receiver returned HTTP ${response.status}`)
    } catch (error) {
      lastError =
        error instanceof Error ? error : new Error("alert delivery failed")
      if (/rejected delivery/.test(lastError.message)) throw lastError
    }

    if (attempt < attempts) await sleeper(2 ** (attempt - 1) * 1_000)
  }

  throw new Error(
    `external production alert failed after ${attempts} attempts`,
    {
      cause: lastError,
    }
  )
}

async function main() {
  const action = process.argv[2]
  const kind = process.argv[3] ?? "readiness"
  const result = await sendProductionAlert({ action, kind })
  console.log(
    `External production alert acknowledged with HTTP ${result.status}.`
  )
}

const isMainModule =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href

if (isMainModule) {
  main().catch((error) => {
    console.error(
      error instanceof Error ? error.message : "alert delivery failed"
    )
    process.exitCode = 1
  })
}
