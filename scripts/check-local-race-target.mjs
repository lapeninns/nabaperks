import assert from "node:assert/strict"
import { pathToFileURL } from "node:url"

const PROBE_TIMEOUT_MS = 3_000

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try {
    await checkLocalRaceTarget(process.env)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}

export async function checkLocalRaceTarget(env) {
  const stampUrl = requireLoopbackUrl(env.STAMP_RACE_URL, "STAMP_RACE_URL")
  const redeemUrl = requireLoopbackUrl(env.REDEEM_RACE_URL, "REDEEM_RACE_URL")
  const authToken = required(env.STAMP_RACE_AUTH_TOKEN, "STAMP_RACE_AUTH_TOKEN")

  requireJsonObject(env.STAMP_RACE_BODY, "STAMP_RACE_BODY")
  requireJsonObject(env.REDEEM_RACE_BODY, "REDEEM_RACE_BODY")

  await Promise.all([
    probeAuthenticatedTarget(stampUrl, authToken, "STAMP_RACE_URL"),
    probeAuthenticatedTarget(redeemUrl, authToken, "REDEEM_RACE_URL"),
  ])

  console.log("Authenticated loopback race targets are reachable.")
}

function requireLoopbackUrl(value, name) {
  const raw = required(value, name)
  let url
  try {
    url = new URL(raw)
  } catch {
    assert.fail(`${name} must be an absolute URL.`)
  }

  assert.equal(
    url.protocol,
    "http:",
    `${name} must use an IPv4 loopback origin.`
  )
  assert.equal(
    url.hostname,
    "127.0.0.1",
    `${name} must use an IPv4 loopback origin.`
  )
  assert.equal(url.username, "", `${name} must not contain credentials.`)
  assert.equal(url.password, "", `${name} must not contain credentials.`)
  assert.equal(url.hash, "", `${name} must not contain a fragment.`)
  return url
}

function requireJsonObject(value, name) {
  const raw = required(value, name)
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    assert.fail(`${name} must be valid JSON.`)
  }

  assert.ok(
    parsed !== null && typeof parsed === "object" && !Array.isArray(parsed),
    `${name} must be a JSON object.`
  )
  assert.ok(Object.keys(parsed).length > 0, `${name} must not be empty.`)
}

async function probeAuthenticatedTarget(url, authToken, name) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${authToken}` },
    method: "HEAD",
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  })
  assert.ok(response, `${name} did not return an HTTP response.`)
}

function required(value, name) {
  const normalized = value?.trim() ?? ""
  assert.ok(normalized, `${name} is required.`)
  return normalized
}
