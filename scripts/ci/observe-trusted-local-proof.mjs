#!/usr/bin/env node
import { readFile } from "node:fs/promises"
import { pathToFileURL } from "node:url"
import { FULL_HOSTED_ROOTS } from "../../ops/local-ci/core/routing.mjs"
import { verifyProofPolicy } from "../../ops/local-ci/core/proof-policy.mjs"

const fallback = (reason, proofValid = false) => ({
  route: "hosted",
  requiredRoots: [...FULL_HOSTED_ROOTS],
  reason,
  proofValid,
})

/** Read-only, one API request. This observer never grants authority, consumes an
 * attempt or schedules work. Policy/log inventory must be external trusted
 * supervisor records; do not point these paths into the candidate checkout.
 * Signed envelopes are published as the entire check output.text JSON value.
 */
export async function observeTrustedLocalProof({
  repository,
  sha,
  token,
  policy = null,
  observedLogDigests = null,
  now = Date.now(),
  fetchImpl = fetch,
}) {
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository ?? "") ||
    !/^[a-f0-9]{40}$/.test(sha ?? "")
  )
    return fallback("invalid-request")
  if (!policy || policy.repository !== repository || policy.sha !== sha)
    return fallback("missing-or-mismatched-trusted-policy")
  if (!token) return fallback("publisher-readback-unavailable")
  try {
    const response = await fetchImpl(
      `https://api.github.com/repos/${repository}/commits/${sha}/check-runs?per_page=100`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        signal: AbortSignal.timeout(30_000),
      }
    )
    if (!response.ok) return fallback("publisher-readback-unavailable")
    const body = await response.json()
    if (!Array.isArray(body.check_runs) || body.total_count > 100)
      return fallback("incomplete-publisher-readback")
    const candidates = body.check_runs.filter(
      (check) =>
        check.name === policy.checkName &&
        check.head_sha === sha &&
        check.app?.id === policy.appId
    )
    if (candidates.length !== 1)
      return fallback("missing-or-ambiguous-publisher-proof")
    const check = candidates[0]
    if (check.status !== "completed" || check.conclusion !== "success")
      return fallback("local-proof-not-successful")
    const envelope = JSON.parse(check.output?.text ?? "null")
    const result = verifyProofPolicy({
      envelope,
      policy,
      now,
      observedLogDigests,
      publisherAppId: check.app.id,
    })
    return result.valid
      ? fallback("valid-signature-observed-authority-disabled", true)
      : fallback("invalid-local-envelope")
  } catch {
    return fallback("publisher-proof-unavailable-or-malformed")
  }
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = {}
  for (let index = 0; index < args.length; index += 2) {
    if (
      !["--repository", "--sha", "--policy", "--logs"].includes(args[index]) ||
      !args[index + 1]
    )
      throw new Error(
        "Expected --repository, --sha and optional trusted --policy / --logs paths"
      )
    options[args[index].slice(2)] = args[index + 1]
  }
  let policy = null
  let observedLogDigests = null
  try {
    if (options.policy)
      policy = JSON.parse(await readFile(options.policy, "utf8"))
    if (options.logs)
      observedLogDigests = JSON.parse(await readFile(options.logs, "utf8"))
  } catch {
    process.stdout.write(
      `${JSON.stringify(fallback("trusted-policy-or-logs-unavailable"))}\n`
    )
    return
  }
  const result = await observeTrustedLocalProof({
    ...options,
    policy,
    observedLogDigests,
    token: env.GITHUB_TOKEN,
  })
  process.stdout.write(`${JSON.stringify(result)}\n`)
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main().catch(() => {
    process.stdout.write(
      `${JSON.stringify(fallback("invalid-observer-invocation"))}\n`
    )
    process.exitCode = 1
  })
}
