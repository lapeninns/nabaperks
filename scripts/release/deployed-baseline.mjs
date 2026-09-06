import assert from "node:assert/strict"
import { writeFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { readCanonicalVercelProductionTarget } from "../vercel-production-target.mjs"
import { validateProductionCandidate } from "./candidate.mjs"

const PRODUCTION_ALIAS = "nabaperks.com"

function aliasIdentity(alias, target) {
  assert.equal(alias?.alias, PRODUCTION_ALIAS, "production alias mismatch")
  assert.equal(
    alias.projectId,
    target.projectId,
    "production alias project mismatch"
  )
  assert.match(
    alias.deploymentId ?? "",
    /^dpl_[A-Za-z0-9]+$/,
    "alias deployment identity missing"
  )
  assert.equal(
    alias.deployment?.id,
    alias.deploymentId,
    "alias deployment binding mismatch"
  )
  assert.ok(
    typeof alias.deployment.url === "string",
    "alias deployment URL missing"
  )
  return { id: alias.deploymentId, url: `https://${alias.deployment.url}` }
}

// The protected release owner supplies a credential and canonical reviewed target.
// Source config and short public health revisions never choose the baseline.
export async function readDeployedBaseline({
  target,
  getJson,
  now = () => Date.now(),
}) {
  const aliasPath = `/v4/aliases/${PRODUCTION_ALIAS}`
  const initial = aliasIdentity(await getJson(aliasPath), target)
  const metadata = await getJson(`/v13/deployments/${initial.id}`)
  const revision = metadata?.meta?.githubCommitSha
  assert.match(
    revision ?? "",
    /^[a-f0-9]{40}$/,
    "full deployed revision missing"
  )
  const candidate = validateProductionCandidate(metadata, {
    revision,
    projectId: target.projectId,
    teamId: target.teamId,
    url: initial.url,
    deploymentId: initial.id,
  })
  assert.equal(
    candidate.deploymentId,
    initial.id,
    "deployed baseline ID changed"
  )
  assert.deepEqual(
    aliasIdentity(await getJson(aliasPath), target),
    initial,
    "production alias changed during baseline readback"
  )
  return {
    schema: "nabaperks.production-baseline.v1",
    ...candidate,
    observedAt: new Date(now()).toISOString(),
  }
}

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    assert.equal(
      process.argv.length,
      3,
      "baseline evidence output path required"
    )
    assert.ok(process.env.VERCEL_TOKEN, "protected Vercel credential required")
    const target = readCanonicalVercelProductionTarget()
    const result = await readDeployedBaseline({
      target,
      getJson: async (path) => {
        const url = new URL(path, "https://api.vercel.com")
        url.searchParams.set("teamId", target.teamId)
        const response = await fetch(url, {
          headers: { authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
          redirect: "error",
          signal: AbortSignal.timeout(15_000),
        })
        assert.equal(response.status, 200, "canonical provider readback failed")
        return response.json()
      },
    })
    writeFileSync(process.argv[2], `${JSON.stringify(result)}\n`, {
      flag: "wx",
      mode: 0o600,
    })
    console.log(
      `Verified deployed baseline ${result.revision} at ${result.deploymentId}`
    )
  } catch {
    console.error(
      "Production baseline could not be authenticated; database promotion must not proceed."
    )
    process.exitCode = 1
  }
}
