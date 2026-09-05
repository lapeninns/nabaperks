/**
 * The GitHub REST client the agent uses to see work and to publish proof.
 *
 * Four properties are load-bearing, and each one is a mechanism rather than a
 * convention:
 *
 *   1. **The App private key never leaves this module, and no derived
 *      credential is ever logged.** The key is turned into a KeyObject once at
 *      construction and is not retained as text. Every error path runs its
 *      message through `redactSecrets`, which removes JWTs, installation
 *      tokens and PEM blocks - because the single most likely way a private
 *      key escapes a machine is an exception message that someone pastes into
 *      an issue.
 *
 *   2. **`fetch` is injected.** The unit tests drive every branch of this file
 *      with a function over an in-memory table, so the retry policy, the token
 *      cache and the rate-limit handling are exercised offline and
 *      deterministically. `now` is injected for the same reason.
 *
 *   3. **Exactly one Actions write operation is reachable.** The contract lists
 *      `allowedActionsWriteOperations`, and `rerunWorkflowJob` refuses unless
 *      the operation it is about to perform is in that list. An App with
 *      Actions: write can cancel runs, delete artifacts and dispatch
 *      workflows; none of those has a call site here, and the guard is what
 *      keeps that true after the next edit.
 *
 *   4. **No value from the contract reaches a URL unchecked.** Repository
 *      names, commit SHAs, refs and ids are validated against the shapes
 *      GitHub actually uses before they are interpolated, and `resolveApiUrl`
 *      then re-parses the composed URL and asserts it still sits under the API
 *      root. A `..` or an absolute URL in a config file would otherwise send
 *      an installation token to a host nobody chose.
 *
 * Everything that can be a pure function is one. `signAppJwt`, `parseRateLimit`
 * and the response normalisers take their inputs as arguments and touch
 * nothing ambient, so the parts most likely to be wrong are the parts a test
 * can pin down.
 */

import { createPrivateKey, createSign } from "node:crypto"
import { setTimeout as delay } from "node:timers/promises"

import {
  LocalCiError,
  describeValue,
  quoteForMessage,
} from "../core/contract.mjs"
import { redactCredentials } from "../core/job-env.mjs"

export const GITHUB_API_BASE_URL = "https://api.github.com"
export const GITHUB_API_VERSION = "2022-11-28"
export const GITHUB_ACCEPT = "application/vnd.github+json"
export const USER_AGENT = "nabaperks-local-ci-agent"

/**
 * GitHub rejects an App JWT whose lifetime exceeds ten minutes. Nine minutes
 * leaves a minute of headroom for a slow request that was signed just before
 * the boundary.
 */
export const JWT_LIFETIME_SECONDS = 540

/** Backdated `iat`, because GitHub compares against its own clock. */
export const JWT_CLOCK_SKEW_SECONDS = 60

/** Renew an installation token this long before GitHub expires it. */
export const TOKEN_SAFETY_WINDOW_MS = 120_000

export const DEFAULT_MAX_ATTEMPTS = 3

/** Statuses worth another attempt. 403 is handled separately: it is a rate
 * limit only when the remaining-quota header says so, and a permission
 * failure otherwise, which retrying cannot fix. */
export const RETRYABLE_STATUSES = Object.freeze([429, 500, 502, 503, 504])

/** The only non-GET Actions call this plane is permitted to make. */
export const ACTIONS_WRITE_OPERATION = "rerun-failed-jobs"

export class GitHubApiError extends LocalCiError {
  constructor(code, message, details = {}) {
    super(code, message)
    this.status = details.status ?? null
    this.apiMessage = details.apiMessage ?? null
    this.documentationUrl = details.documentationUrl ?? null
    this.requestId = details.requestId ?? null
    this.rateLimit = details.rateLimit ?? null
    this.retryAfterSeconds = details.retryAfterSeconds ?? null
    this.method = details.method ?? null
    this.path = details.path ?? null
  }
}

const JWT_SHAPE =
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g
const INSTALLATION_TOKEN_SHAPE = /\bghs_[A-Za-z0-9]{16,}/g
const BEARER_HEADER = /\b(Bearer|token)\s+\S+/gi
const PEM_BLOCK =
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]*?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g

/**
 * Remove every credential shape this client can produce from a string before
 * it is logged or thrown. Pure.
 *
 * The three shapes here are the ones this module creates rather than consumes:
 * the App JWT it signs, the installation token GitHub returns for it, and the
 * PEM the JWT was signed with. `redactCredentials` covers the shapes the rest
 * of the plane knows about.
 */
export function redactSecrets(text) {
  if (typeof text !== "string") return text
  return redactCredentials(
    text
      .replace(PEM_BLOCK, "[redacted]")
      .replace(JWT_SHAPE, "[redacted]")
      .replace(INSTALLATION_TOKEN_SHAPE, "[redacted]")
      .replace(BEARER_HEADER, "$1 [redacted]")
  )
}

/** RFC 7515 base64url, no padding. Pure. */
export function base64UrlEncode(input) {
  const buffer =
    typeof input === "string" ? Buffer.from(input, "utf8") : Buffer.from(input)
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "")
}

function requirePositiveIdentifier(value, label) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value)
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value.trim())) {
    return value.trim()
  }
  throw new GitHubApiError(
    "MISSING_APP_IDENTITY",
    `${label} must be a positive integer identifier (received ${describeValue(value)}); the App has not been created and installed yet, or the value was not supplied to the agent`
  )
}

/**
 * The JWT claim set, as an object. Pure: `now` is epoch milliseconds supplied
 * by the caller, so a test pins the exact `iat`/`exp` pair rather than racing
 * the clock.
 */
export function buildAppJwtClaims({
  appId,
  now,
  lifetimeSeconds = JWT_LIFETIME_SECONDS,
  clockSkewSeconds = JWT_CLOCK_SKEW_SECONDS,
}) {
  const issuer = requirePositiveIdentifier(appId, "githubApp.appId")
  if (typeof now !== "number" || !Number.isFinite(now)) {
    throw new GitHubApiError(
      "INVALID_INPUT",
      `buildAppJwtClaims requires an epoch-millisecond \`now\` (received ${describeValue(now)})`
    )
  }
  if (lifetimeSeconds > 600) {
    throw new GitHubApiError(
      "INVALID_INPUT",
      `an App JWT may live at most 600 seconds; ${lifetimeSeconds} would be rejected by GitHub`
    )
  }
  const issuedAt = Math.floor(now / 1000) - clockSkewSeconds
  return Object.freeze({
    iat: issuedAt,
    exp: issuedAt + lifetimeSeconds,
    iss: issuer,
  })
}

/**
 * Sign an RS256 App JWT with node:crypto. Deterministic given its arguments and
 * free of I/O, so it is unit-testable with a throwaway key.
 *
 * `privateKey` is a PEM string or a KeyObject. Nothing derived from it is
 * returned except the signed token, and no error raised here carries the key.
 */
export function signAppJwt({
  appId,
  privateKey,
  now,
  lifetimeSeconds = JWT_LIFETIME_SECONDS,
  clockSkewSeconds = JWT_CLOCK_SKEW_SECONDS,
}) {
  const claims = buildAppJwtClaims({
    appId,
    now,
    lifetimeSeconds,
    clockSkewSeconds,
  })
  let key
  try {
    key =
      typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey
  } catch (error) {
    // Deliberately does not echo the input: a malformed PEM is still a PEM.
    throw new GitHubApiError(
      "INVALID_PRIVATE_KEY",
      `the GitHub App private key could not be parsed (${redactSecrets(error.message)}); expected a PKCS#1 or PKCS#8 RSA private key in PEM form`
    )
  }
  if (key === null || typeof key !== "object") {
    throw new GitHubApiError(
      "INVALID_PRIVATE_KEY",
      `signAppJwt requires a PEM string or a node:crypto KeyObject (received ${describeValue(privateKey)})`
    )
  }
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }))
  const payload = base64UrlEncode(JSON.stringify(claims))
  const signingInput = `${header}.${payload}`
  let signature
  try {
    signature = createSign("RSA-SHA256").update(signingInput).sign(key)
  } catch (error) {
    throw new GitHubApiError(
      "INVALID_PRIVATE_KEY",
      `the GitHub App private key could not sign an RS256 assertion (${redactSecrets(error.message)}); an Ed25519 or EC key cannot be used for a GitHub App JWT`
    )
  }
  return `${signingInput}.${base64UrlEncode(signature)}`
}

/** Read GitHub's rate-limit headers into a plain record. Pure. */
export function parseRateLimit(headers) {
  const get = (name) => {
    if (headers === null || headers === undefined) return null
    if (typeof headers.get === "function") return headers.get(name)
    return headers[name] ?? headers[name.toLowerCase()] ?? null
  }
  const toNumber = (value) => {
    if (value === null || value === undefined || value === "") return null
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return Object.freeze({
    limit: toNumber(get("x-ratelimit-limit")),
    remaining: toNumber(get("x-ratelimit-remaining")),
    resetEpochSeconds: toNumber(get("x-ratelimit-reset")),
    resource: get("x-ratelimit-resource"),
    retryAfterSeconds: toNumber(get("retry-after")),
  })
}

/** True when `status` is worth another attempt. Pure. */
export function isRetryableStatus(status, rateLimit) {
  if (RETRYABLE_STATUSES.includes(status)) return true
  // A 403 is a rate limit only when GitHub says the quota is gone; otherwise
  // it is a permission failure and retrying just burns the remaining quota.
  return status === 403 && rateLimit?.remaining === 0
}

/**
 * How long to wait before attempt `attempt` (1-based). Honours `retry-after`
 * and the rate-limit reset, then falls back to exponential backoff. Pure.
 */
export function retryDelayMs(attempt, rateLimit, nowMs) {
  const retryAfter = rateLimit?.retryAfterSeconds
  if (typeof retryAfter === "number" && retryAfter > 0) {
    return Math.min(retryAfter * 1000, 300_000)
  }
  const reset = rateLimit?.resetEpochSeconds
  if (
    typeof reset === "number" &&
    typeof nowMs === "number" &&
    rateLimit?.remaining === 0
  ) {
    const waitMs = reset * 1000 - nowMs
    if (waitMs > 0) return Math.min(waitMs + 1000, 300_000)
  }
  return Math.min(1000 * 2 ** (attempt - 1), 30_000)
}

/**
 * Everything that reaches the URL of an outbound request is validated below,
 * at the boundary, rather than trusted for where it came from.
 *
 * `contract.repository` is a value read off disk and the ids are whatever the
 * caller was handed; neither is a proof. A repository name carrying `..`, a
 * second slash or a scheme silently retargets `${baseUrl}${path}` at a
 * different API path or a different host - and every request this module makes
 * carries an installation token in an Authorization header, so a retargeted
 * request hands that token to whoever answers rather than returning a 404.
 *
 * `resolveApiUrl` is the half that closes the class of bug rather than the
 * instance: whatever the components were, the URL about to be fetched is
 * re-parsed and asserted to still sit under the API root, so a future caller
 * that interpolates something new cannot reintroduce the escape.
 */

/** The characters GitHub allows in an owner or a repository name, and no others. */
export const REPOSITORY_FULL_NAME_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/

/** A commit SHA as GitHub writes one: 40 lowercase hexadecimal characters. */
export const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/

/** One component of a git ref path, e.g. `heads` or `main`. */
const REF_SEGMENT_PATTERN = /^[A-Za-z0-9._-]+$/

/** The values the Checks API documents for `filter`. */
export const CHECK_RUN_FILTERS = Object.freeze(["latest", "all"])

/**
 * A refusal to send, as opposed to a failure GitHub reported. It extends
 * `GitHubApiError` rather than `LocalCiError` directly so that every existing
 * `instanceof GitHubApiError` catch still sees it, while `.code` and the type
 * both say the request never left this machine.
 */
export class GitHubRequestTargetError extends GitHubApiError {}

/**
 * Refusals are the messages most likely to be pasted into an issue, and the
 * value being refused is frequently the one a caller built out of something
 * sensitive, so every one of them is redacted on the way out.
 */
function refuse(code, message) {
  return new GitHubRequestTargetError(code, redactSecrets(message))
}

const isTraversalSegment = (segment) => segment === "." || segment === ".."

/**
 * `owner/repo`, refusing anything that could move a request off the repository
 * it appears to name. Pure.
 */
export function requireRepositoryFullName(
  value,
  label = "contract.repository"
) {
  if (typeof value !== "string" || !REPOSITORY_FULL_NAME_PATTERN.test(value)) {
    throw refuse(
      "INVALID_REPOSITORY",
      `${label} must be an "owner/repo" full name built from the characters GitHub allows (received ${describeValue(value)}); a scheme, a second slash or any other character would point the request somewhere else`
    )
  }
  const [owner, repo] = value.split("/")
  if (isTraversalSegment(owner) || isTraversalSegment(repo)) {
    // `.` and `..` are legal characters in a repository name but not a legal
    // whole one, and either half resolves to a different API path.
    throw refuse(
      "INVALID_REPOSITORY",
      `${label} is ${quoteForMessage(value)}, one half of which is a path traversal segment; that resolves to a different API path than the repository it appears to name`
    )
  }
  return Object.freeze({ owner, repo, fullName: value })
}

/** A commit SHA, exactly as GitHub returns one. Pure. */
export function requireCommitSha(value, label = "the commit SHA") {
  if (typeof value !== "string" || !COMMIT_SHA_PATTERN.test(value)) {
    throw refuse(
      "INVALID_COMMIT_SHA",
      `${label} must be 40 lowercase hexadecimal characters, as GitHub writes a commit SHA (received ${describeValue(value)})`
    )
  }
  return value
}

/**
 * A git ref path without the `refs/` prefix, e.g. `heads/main`. Pure.
 *
 * Slashes are legal here, which is exactly why the segments are checked one by
 * one instead of the whole string being percent-encoded.
 */
export function requireRefPath(value, label = "the git ref") {
  if (typeof value !== "string" || value === "") {
    throw refuse(
      "INVALID_REF",
      `${label} must be a non-empty ref such as "heads/main" (received ${describeValue(value)})`
    )
  }
  const unsafe = value
    .split("/")
    .find(
      (segment) =>
        !REF_SEGMENT_PATTERN.test(segment) || isTraversalSegment(segment)
    )
  if (unsafe !== undefined) {
    throw refuse(
      "INVALID_REF",
      `${label} ${quoteForMessage(value)} carries the segment ${JSON.stringify(unsafe)}, which is not a git ref component; only [A-Za-z0-9._-] separated by single slashes reaches the API`
    )
  }
  return value
}

/** A positive integer id on its way into a path. Pure. */
function requireNumericId(value, label) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value)
  }
  if (typeof value === "string" && /^[0-9]+$/.test(value)) return value
  throw refuse(
    "INVALID_INPUT",
    `${label} must be a positive integer id (received ${describeValue(value)})`
  )
}

/** GitHub caps a page at 100 and rejects anything else. Pure. */
function requirePageSize(value, label) {
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw refuse(
      "INVALID_INPUT",
      `${label} must be an integer from 1 to 100 (received ${describeValue(value)})`
    )
  }
  return String(value)
}

function requireCheckName(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw refuse(
      "INVALID_INPUT",
      `${label} must be a non-empty check-run name (received ${describeValue(value)})`
    )
  }
  return value
}

function requireCheckRunFilter(value, label) {
  if (!CHECK_RUN_FILTERS.includes(value)) {
    throw refuse(
      "INVALID_INPUT",
      `${label} must be one of ${CHECK_RUN_FILTERS.join(", ")} (received ${describeValue(value)})`
    )
  }
  return value
}

/**
 * A path that can only ever address something *under* the API root. Pure.
 *
 * Each clause below is a way a string can stop being relative: an absolute URL
 * replaces the host outright, `//` replaces it while keeping the scheme, a
 * backslash is folded into a slash by the WHATWG parser, and tabs and newlines
 * are stripped by it - so a value containing one does not describe the request
 * that would actually be sent.
 */
export function requireRelativeRequestPath(value, label = "the request path") {
  if (typeof value !== "string" || value === "") {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} must be a non-empty string beginning with "/" (received ${describeValue(value)})`
    )
  }
  if (URL.canParse(value)) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} parses as an absolute URL, which would send the request - and its Authorization header - to a host this client never chose`
    )
  }
  if (value.startsWith("//")) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} begins with "//", which is a protocol-relative URL: it keeps the scheme and replaces the host`
    )
  }
  if (!value.startsWith("/")) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} must begin with "/"; a path relative to the API root is the only shape this client sends`
    )
  }
  if (value.includes("\\")) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} contains a backslash, which the URL parser folds into a slash`
    )
  }
  if (value.includes("#")) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} contains a fragment marker, which silently truncates the request that is sent`
    )
  }
  if (/[^!-~]/.test(value)) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} contains a character outside printable ASCII; whitespace and control characters are stripped by the URL parser, so such a value does not describe the request that is sent`
    )
  }
  const [pathname] = value.split("?")
  const traversal = pathname.split("/").find(isTraversalSegment)
  if (traversal !== undefined) {
    throw refuse(
      "UNSAFE_REQUEST_PATH",
      `${label} ${quoteForMessage(value)} contains the segment ${JSON.stringify(traversal)}, which escapes the path it appears to name`
    )
  }
  return value
}

/** The API root a client may be pointed at. Pure. */
export function requireApiBaseUrl(value, label = "the GitHub API base URL") {
  if (typeof value !== "string" || !URL.canParse(value)) {
    throw refuse(
      "INVALID_API_BASE_URL",
      `${label} must be an absolute URL such as ${GITHUB_API_BASE_URL} (received ${describeValue(value)})`
    )
  }
  const url = new URL(value)
  if (url.protocol !== "https:") {
    // Worded without the word "token" on purpose: `redactSecrets` removes
    // whatever follows one, and a refusal that redacts its own prose is a
    // refusal nobody can act on.
    throw refuse(
      "INVALID_API_BASE_URL",
      `${label} must be https (received ${quoteForMessage(url.protocol)}); every request made through it carries an Authorization credential, and cleartext would publish it to anyone on the path`
    )
  }
  if (url.search !== "" || url.hash !== "") {
    throw refuse(
      "INVALID_API_BASE_URL",
      `${label} must carry no query string or fragment (received ${quoteForMessage(value)})`
    )
  }
  return url
}

/**
 * The absolute URL for `path` under `baseUrl`, asserted to still be under it.
 * Pure, and the last thing that runs before `fetch`.
 */
export function resolveApiUrl(baseUrl, path) {
  const base = requireApiBaseUrl(baseUrl)
  const safePath = requireRelativeRequestPath(path)
  const root = base.href.endsWith("/") ? base.href.slice(0, -1) : base.href
  const composed = `${root}${safePath}`
  if (!URL.canParse(composed)) {
    throw refuse(
      "UNSAFE_REQUEST_URL",
      `${safePath} does not compose a parseable URL against ${root}`
    )
  }
  const resolved = new URL(composed)
  const rootPath = base.pathname.endsWith("/")
    ? base.pathname
    : `${base.pathname}/`
  if (
    resolved.origin !== base.origin ||
    !resolved.pathname.startsWith(rootPath)
  ) {
    throw refuse(
      "UNSAFE_REQUEST_URL",
      `${safePath} resolves to ${resolved.origin}${resolved.pathname}, which is outside the API root ${base.origin}${rootPath}; this client will not send an Authorization header there`
    )
  }
  return resolved.href
}

/** `owner/repo` from the contract, refusing anything that is not one. Pure. */
export function repositorySlug(contract) {
  return requireRepositoryFullName(contract?.repository, "contract.repository")
}

/**
 * True when `id` matches `contract.githubApp.repositoryId`, or when the
 * contract still carries the null pre-provisioning sentinel. Pure.
 *
 * A null sentinel means "not pinned yet" rather than "anything goes": the
 * allowlist's exact full-name match is still in force, and this is the second,
 * rename-proof half of the same check once the id is filled in.
 */
export function matchesPinnedRepositoryId(id, contract) {
  const pinned = contract?.githubApp?.repositoryId
  if (pinned === null || pinned === undefined) return true
  return String(id) === String(pinned)
}

/**
 * Normalise one pull request from the REST payload into the shape
 * core/allowlist.mjs classifies. Pure, and tolerant of a missing `repo` object:
 * GitHub returns `head.repo: null` when the fork has been deleted, and that has
 * to classify as "no head repository" rather than crash.
 */
export function normalisePullRequest(pull) {
  if (typeof pull !== "object" || pull === null) {
    throw new GitHubApiError(
      "INVALID_RESPONSE",
      `pull request entry must be an object (received ${describeValue(pull)})`
    )
  }
  const head = pull.head ?? {}
  const base = pull.base ?? {}
  return Object.freeze({
    event: "pull_request",
    number: pull.number ?? null,
    title: typeof pull.title === "string" ? pull.title : null,
    draft: pull.draft === true,
    ref: `refs/pull/${pull.number}/head`,
    branch: typeof head.ref === "string" ? head.ref : null,
    sha: typeof head.sha === "string" ? head.sha : null,
    headRepository: head.repo?.full_name ?? null,
    headRepositoryId: head.repo?.id ?? null,
    baseRepository: base.repo?.full_name ?? null,
    baseBranch: typeof base.ref === "string" ? base.ref : null,
  })
}

/** GitHub caps a check run's `output.text` at 65535 characters. Pure. */
export const CHECK_OUTPUT_TEXT_LIMIT = 65535
export const CHECK_OUTPUT_SUMMARY_LIMIT = 65535
export const CHECK_OUTPUT_TITLE_LIMIT = 255

function clampField(value, limit, label) {
  if (typeof value !== "string" || value.length <= limit) return value
  const marker = `\n\n… ${label} truncated at ${limit} characters by the agent.`
  return `${value.slice(0, limit - marker.length)}${marker}`
}

/**
 * Clamp a check-run output to GitHub's documented limits, announcing every
 * truncation. Pure. Silent truncation of a failure list is the exact failure
 * mode core/summary.mjs exists to prevent, so it is not introduced here.
 */
export function clampCheckOutput(output) {
  if (typeof output !== "object" || output === null) return output
  return Object.freeze({
    ...output,
    title: clampField(output.title, CHECK_OUTPUT_TITLE_LIMIT, "title"),
    summary: clampField(output.summary, CHECK_OUTPUT_SUMMARY_LIMIT, "summary"),
    text: clampField(output.text, CHECK_OUTPUT_TEXT_LIMIT, "text"),
  })
}

function errorFromResponse({ status, body, headers, method, path }) {
  const rateLimit = parseRateLimit(headers)
  const apiMessage =
    typeof body === "object" &&
    body !== null &&
    typeof body.message === "string"
      ? body.message
      : typeof body === "string" && body !== ""
        ? body.slice(0, 500)
        : null
  const rateLimited =
    status === 429 || (status === 403 && rateLimit.remaining === 0)
  const resetHint =
    rateLimit.resetEpochSeconds === null
      ? ""
      : `, quota resets at ${new Date(rateLimit.resetEpochSeconds * 1000).toISOString()}`
  const detail = apiMessage === null ? "no message body" : apiMessage
  return new GitHubApiError(
    rateLimited ? "GITHUB_RATE_LIMITED" : "GITHUB_API_ERROR",
    redactSecrets(
      `${method} ${path} failed with HTTP ${status}: ${detail}${rateLimited ? `${resetHint} (remaining ${rateLimit.remaining ?? "unknown"} of ${rateLimit.limit ?? "unknown"})` : ""}`
    ),
    {
      status,
      apiMessage: redactSecrets(apiMessage),
      documentationUrl: body?.documentation_url ?? null,
      requestId:
        typeof headers?.get === "function"
          ? headers.get("x-github-request-id")
          : null,
      rateLimit,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
      method,
      path,
    }
  )
}

/**
 * Build the client.
 *
 * Dependencies are injected so the whole file runs offline in a unit test:
 * `fetch` defaults to `globalThis.fetch`, `now` to `Date.now`, and `sleep` to
 * a promise timer. `logger` is optional and only ever receives redacted text.
 */
export function createGitHubClient({
  contract,
  appId,
  installationId,
  privateKey,
  fetch = globalThis.fetch,
  now = () => Date.now(),
  sleep = (ms) => delay(ms),
  baseUrl = GITHUB_API_BASE_URL,
  userAgent = USER_AGENT,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  logger = null,
} = {}) {
  if (typeof contract !== "object" || contract === null) {
    throw new GitHubApiError(
      "INVALID_CONTRACT",
      `createGitHubClient requires the validated contract (received ${describeValue(contract)})`
    )
  }
  if (typeof fetch !== "function") {
    throw new GitHubApiError(
      "MISSING_FETCH",
      "createGitHubClient needs a fetch implementation; this Node build has no global fetch and none was injected"
    )
  }
  const { owner, repo, fullName } = repositorySlug(contract)
  const resolvedAppId = requirePositiveIdentifier(
    appId ?? contract.githubApp?.appId,
    "githubApp.appId"
  )
  const resolvedInstallationId = requirePositiveIdentifier(
    installationId ?? contract.githubApp?.installationId,
    "githubApp.installationId"
  )

  // Parsed once, then the PEM text is dropped. The KeyObject cannot be
  // serialised back to PEM by accident: `JSON.stringify` of one is `{}`.
  let key
  try {
    key =
      typeof privateKey === "string" ? createPrivateKey(privateKey) : privateKey
  } catch (error) {
    throw new GitHubApiError(
      "INVALID_PRIVATE_KEY",
      `the GitHub App private key could not be parsed (${redactSecrets(error.message)})`
    )
  }
  if (key === null || key === undefined) {
    throw new GitHubApiError(
      "INVALID_PRIVATE_KEY",
      "createGitHubClient requires the GitHub App private key; without it no installation token can be minted"
    )
  }

  const log = (level, message) => {
    if (logger && typeof logger[level] === "function") {
      logger[level](redactSecrets(message))
    }
  }

  let cachedToken = null

  async function send({ method, path, body, token, accept = GITHUB_ACCEPT }) {
    // Re-validated here even though every caller below builds `path` from
    // checked components: this is the one line every outbound request passes
    // through, so it is the only place the guarantee cannot be edited around.
    const url = resolveApiUrl(baseUrl, path)
    const headers = {
      accept,
      "content-type": "application/json",
      "user-agent": userAgent,
      "x-github-api-version": GITHUB_API_VERSION,
    }
    if (token) headers.authorization = `Bearer ${token}`

    let lastError = null
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      let response
      try {
        response = await fetch(url, {
          method,
          headers,
          body: body === undefined ? undefined : JSON.stringify(body),
        })
      } catch (error) {
        lastError = new GitHubApiError(
          "GITHUB_UNREACHABLE",
          redactSecrets(
            `${method} ${path} could not reach ${baseUrl}: ${error.message}`
          ),
          { method, path }
        )
        if (attempt === maxAttempts) throw lastError
        await sleep(retryDelayMs(attempt, null, now()))
        continue
      }

      const status = response.status
      const text = await response.text()
      let payload = null
      if (text !== "") {
        try {
          payload = JSON.parse(text)
        } catch {
          payload = text
        }
      }

      if (status >= 200 && status < 300) return payload

      const error = errorFromResponse({
        status,
        body: payload,
        headers: response.headers,
        method,
        path,
      })
      if (attempt < maxAttempts && isRetryableStatus(status, error.rateLimit)) {
        const waitMs = retryDelayMs(attempt, error.rateLimit, now())
        log(
          "warn",
          `${method} ${path} returned ${status}; retrying in ${Math.round(waitMs / 1000)}s (attempt ${attempt} of ${maxAttempts})`
        )
        await sleep(waitMs)
        lastError = error
        continue
      }
      throw error
    }
    /* c8 ignore next */
    throw lastError
  }

  /**
   * Mint (or reuse) an installation access token.
   *
   * The token is held in memory only, is renewed `TOKEN_SAFETY_WINDOW_MS`
   * before GitHub expires it, and is never logged, returned to a caller
   * outside this module, or written anywhere.
   */
  async function installationToken() {
    const nowMs = now()
    if (
      cachedToken &&
      cachedToken.expiresAtMs - TOKEN_SAFETY_WINDOW_MS > nowMs
    ) {
      return cachedToken.value
    }
    const jwt = signAppJwt({
      appId: resolvedAppId,
      privateKey: key,
      now: nowMs,
    })
    const payload = await send({
      method: "POST",
      path: `/app/installations/${resolvedInstallationId}/access_tokens`,
      token: jwt,
    })
    const value = payload?.token
    if (typeof value !== "string" || value === "") {
      throw new GitHubApiError(
        "INVALID_RESPONSE",
        "the installation access token response carried no token"
      )
    }
    const expiresAtMs = Date.parse(payload.expires_at ?? "")
    cachedToken = {
      value,
      expiresAtMs: Number.isFinite(expiresAtMs)
        ? expiresAtMs
        : nowMs + 3_600_000,
    }
    log(
      "info",
      `minted an installation token for ${fullName}, valid until ${new Date(cachedToken.expiresAtMs).toISOString()}`
    )
    return value
  }

  async function api(method, path, body) {
    return send({ method, path, body, token: await installationToken() })
  }

  return Object.freeze({
    repository: fullName,
    appId: resolvedAppId,
    installationId: resolvedInstallationId,

    /** Force the next call to mint a fresh token. Used by the self-check. */
    invalidateToken() {
      cachedToken = null
    },

    /** Prove the credentials work without publishing anything. */
    async verifyCredentials() {
      await installationToken()
      const app = await send({
        method: "GET",
        path: "/app",
        token: signAppJwt({
          appId: resolvedAppId,
          privateKey: key,
          now: now(),
        }),
      })
      return Object.freeze({
        slug: app?.slug ?? null,
        id: app?.id ?? null,
        name: app?.name ?? null,
      })
    },

    /**
     * Every open pull request, normalised for core/allowlist.mjs. Fork pull
     * requests are returned rather than filtered: the caller must record the
     * refusal, and a silently dropped candidate is indistinguishable from one
     * that never existed.
     */
    async listOpenPullRequests({ perPage = 100 } = {}) {
      const size = requirePageSize(perPage, "listOpenPullRequests({ perPage })")
      const payload = await api(
        "GET",
        `/repos/${owner}/${repo}/pulls?state=open&per_page=${size}&sort=updated&direction=desc`
      )
      if (!Array.isArray(payload)) {
        throw new GitHubApiError(
          "INVALID_RESPONSE",
          `the pull request listing returned ${describeValue(payload)}, expected an array`
        )
      }
      return Object.freeze(payload.map((pull) => normalisePullRequest(pull)))
    },

    /**
     * Resolve a ref to its head SHA. `ref` is the git ref without the
     * `refs/` prefix, e.g. `heads/main`.
     */
    async getRef(ref) {
      if (typeof ref !== "string" || ref === "") {
        throw new GitHubApiError(
          "INVALID_INPUT",
          `getRef requires a ref such as "heads/main" (received ${describeValue(ref)})`
        )
      }
      const normalised = requireRefPath(
        ref.startsWith("refs/") ? ref.slice(5) : ref,
        "getRef(ref)"
      )
      const payload = await api(
        "GET",
        `/repos/${owner}/${repo}/git/ref/${normalised}`
      )
      const sha = payload?.object?.sha
      if (typeof sha !== "string") {
        throw new GitHubApiError(
          "INVALID_RESPONSE",
          `the ref ${JSON.stringify(ref)} resolved to ${describeValue(sha)}, expected a commit SHA`
        )
      }
      return Object.freeze({
        ref: `refs/${normalised}`,
        sha,
        type: payload.object.type ?? null,
      })
    },

    /** Create a check run. `output` is clamped to GitHub's field limits. */
    async createCheckRun({
      name,
      headSha,
      status,
      conclusion,
      output,
      detailsUrl,
      startedAt,
      completedAt,
    }) {
      const body = {
        name,
        head_sha: requireCommitSha(headSha, "createCheckRun({ headSha })"),
        status,
        ...(conclusion === undefined || conclusion === null
          ? {}
          : { conclusion }),
        ...(detailsUrl ? { details_url: detailsUrl } : {}),
        ...(startedAt ? { started_at: startedAt } : {}),
        ...(completedAt ? { completed_at: completedAt } : {}),
        ...(output ? { output: clampCheckOutput(output) } : {}),
      }
      return api("POST", `/repos/${owner}/${repo}/check-runs`, body)
    },

    /** Update a check run in place, by id. */
    async updateCheckRun(
      checkRunId,
      { status, conclusion, output, detailsUrl, completedAt }
    ) {
      const id = requireNumericId(checkRunId, "updateCheckRun(checkRunId)")
      const body = {
        ...(status ? { status } : {}),
        ...(conclusion ? { conclusion } : {}),
        ...(detailsUrl ? { details_url: detailsUrl } : {}),
        ...(completedAt ? { completed_at: completedAt } : {}),
        ...(output ? { output: clampCheckOutput(output) } : {}),
      }
      return api("PATCH", `/repos/${owner}/${repo}/check-runs/${id}`, body)
    },

    /**
     * The check runs on a commit, newest first, optionally filtered by name.
     *
     * The array is returned unfiltered by provenance on purpose: deciding
     * whether a check run belongs to this plane is core/app-identity.mjs's
     * job, and doing it here would hide an impostor rather than refuse it.
     */
    async getCheckRunsForRef(
      ref,
      { checkName = null, filter = "latest" } = {}
    ) {
      const sha = requireCommitSha(ref, "getCheckRunsForRef(ref)")
      // Percent-encoded rather than form-encoded: `URLSearchParams` writes a
      // space as `+`, and the same query built by scripts/check-local-ci-proof
      // writes it as `%20`. One of the two would be asking a different
      // question, and a check name with a space is the normal case here.
      const query = [
        `filter=${encodeURIComponent(requireCheckRunFilter(filter, "getCheckRunsForRef({ filter })"))}`,
        "per_page=100",
      ]
      if (checkName !== null && checkName !== undefined) {
        query.push(
          `check_name=${encodeURIComponent(requireCheckName(checkName, "getCheckRunsForRef({ checkName })"))}`
        )
      }
      const payload = await api(
        "GET",
        `/repos/${owner}/${repo}/commits/${sha}/check-runs?${query.join("&")}`
      )
      const runs = payload?.check_runs
      if (!Array.isArray(runs)) {
        throw new GitHubApiError(
          "INVALID_RESPONSE",
          `the check-run listing for ${sha} returned ${describeValue(runs)}, expected an array`
        )
      }
      return Object.freeze([...runs])
    },

    /**
     * Re-run the failed jobs of a workflow run.
     *
     * This is the single Actions write the App is permitted to make, and the
     * permission is re-derived from the contract at the call site rather than
     * assumed from the token's scopes: a token with Actions: write can also
     * cancel runs and dispatch workflows, and nothing should be one edit away
     * from doing either.
     */
    async rerunWorkflowJob({ runId, operation = ACTIONS_WRITE_OPERATION }) {
      const allowed = contract.githubApp?.allowedActionsWriteOperations ?? []
      if (!Array.isArray(allowed) || !allowed.includes(operation)) {
        throw new GitHubApiError(
          "ACTIONS_WRITE_REFUSED",
          `the operation ${JSON.stringify(operation)} is not in contract.githubApp.allowedActionsWriteOperations (${allowed.join(", ") || "none"}); the agent refuses Actions writes the contract has not authorised`
        )
      }
      if (operation !== ACTIONS_WRITE_OPERATION) {
        throw new GitHubApiError(
          "ACTIONS_WRITE_REFUSED",
          `${JSON.stringify(operation)} has no implementation here; ${JSON.stringify(ACTIONS_WRITE_OPERATION)} is the only Actions write with a call site`
        )
      }
      const id = requireNumericId(runId, "rerunWorkflowJob({ runId })")
      await api(
        "POST",
        `/repos/${owner}/${repo}/actions/runs/${id}/${ACTIONS_WRITE_OPERATION}`
      )
      return Object.freeze({ runId, operation: ACTIONS_WRITE_OPERATION })
    },
  })
}
