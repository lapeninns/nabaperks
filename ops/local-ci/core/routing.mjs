import { verifyProofPolicy } from "./proof-policy.mjs"

export const FULL_HOSTED_ROOTS = Object.freeze([
  "fast",
  "quality",
  "build",
  "e2e",
  "a11y",
  "visual",
  "lighthouse",
  "zap-baseline",
  "db",
])
const hosted = (reason) => ({
  route: "hosted",
  requiredRoots: [...FULL_HOSTED_ROOTS],
  reason,
})

/** Inert preparation: no workflow calls this adapter or grants local authority.
 * A future protected controller must supply independently pinned policy and
 * qualification, API publisher metadata, collected logs, and a durable atomic
 * consumeAttempt operation. Never load these from candidate code/artifacts.
 * consumeAttempt must atomically check latest eligible attempt/challenge and
 * mark it consumed; false handles replay, supersession and concurrent callers.
 */
export async function routeTrustedProof({
  authorityEnabled = false,
  available = false,
  paused = true,
  qualified = false,
  consumeAttempt,
  ...proof
} = {}) {
  if (authorityEnabled !== true) return hosted("local-authority-disabled")
  if (available !== true || paused !== false)
    return hosted("local-unavailable-or-paused")
  if (qualified !== true) return hosted("local-unqualified")
  try {
    if (
      proof.policy?.lanes?.length !== FULL_HOSTED_ROOTS.length ||
      FULL_HOSTED_ROOTS.some((lane) => !proof.policy.lanes.includes(lane))
    )
      return hosted("incomplete-required-coverage")
    const result = verifyProofPolicy(proof)
    if (!result.valid)
      return hosted(`invalid-proof:${result.failures.join(",")}`)
    if (typeof consumeAttempt !== "function")
      return hosted("missing-durable-attempt-ledger")
    const { repository, sha, profile, attemptId, challenge } = proof.policy
    if (
      (await consumeAttempt({
        repository,
        sha,
        profile,
        attemptId,
        challenge,
      })) !== true
    )
      return hosted("replayed-or-superseded-attempt")
    return {
      route: "local",
      requiredRoots: [...FULL_HOSTED_ROOTS],
      reason: "trusted-proof-accepted",
    }
  } catch {
    return hosted("trusted-verification-unavailable")
  }
}
