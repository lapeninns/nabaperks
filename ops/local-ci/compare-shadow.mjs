#!/usr/bin/env node
/** Compare saved provider evidence; never fetch, publish, route or promote. */
import { readFile } from "node:fs/promises"
import { parseArgs } from "node:util"
import { pathToFileURL } from "node:url"

import { compareShadowEvidence } from "./core/shadow-qualification.mjs"
import { readAtSha, CONTRACT_PATH } from "../../scripts/ci/hosted-evidence.mjs"
import { extractLaneSummary } from "./core/summary.mjs"

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

export async function compareSavedEvidence(
  { sha, profile = "pr", localCheckPath, hostedEvidencePath },
  { readAtShaImpl = readAtSha, readJsonImpl = readJson } = {}
) {
  if (!/^[a-f0-9]{40}$/.test(sha ?? "")) throw new Error("Invalid evidence SHA")
  // App identity comes from the reviewed verifier. Qualification limits come
  // from the same immutable candidate as the evidence, even on another branch.
  const verifierContract = await readJsonImpl(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  )
  const contract = JSON.parse(await readAtShaImpl({ sha, path: CONTRACT_PATH }))
  const check = await readJsonImpl(localCheckPath)
  if (
    check.status !== "completed" ||
    check.head_sha !== sha ||
    check.app?.id !== verifierContract.githubApp.appId ||
    check.name !== verifierContract.checkName
  ) {
    throw new Error(
      "Local check is incomplete or does not match the pinned App, check name and SHA"
    )
  }
  const summary = extractLaneSummary(check.output?.text)
  if (!summary || summary.conclusion !== check.conclusion) {
    throw new Error(
      "Published local summary is missing or disagrees with its check conclusion"
    )
  }
  const bindEnvelope = (record) => ({
    ...record,
    lanes: record.lanes?.map((lane) => ({
      schema: record.schema,
      plane: record.plane,
      profile: record.profile,
      headSha: record.headSha,
      ...lane,
    })),
  })
  return compareShadowEvidence({
    contract,
    headSha: sha,
    profile,
    local: bindEnvelope(summary),
    hosted: bindEnvelope(await readJsonImpl(hostedEvidencePath)),
    publishedDurationSeconds:
      (Date.parse(check.completed_at) - Date.parse(check.started_at)) / 1000,
  })
}

async function main(args) {
  if (args[0] === "--") args.shift()
  const { values } = parseArgs({
    args,
    options: {
      "local-check": { type: "string" },
      "hosted-evidence": { type: "string" },
      sha: { type: "string" },
      profile: { type: "string", default: "pr" },
    },
  })
  if (!values["local-check"] || !values["hosted-evidence"] || !values.sha) {
    throw new Error(
      "Required: --local-check FILE --hosted-evidence FILE --sha SHA [--profile pr|main]"
    )
  }
  const result = await compareSavedEvidence({
    sha: values.sha,
    profile: values.profile,
    localCheckPath: values["local-check"],
    hostedEvidencePath: values["hosted-evidence"],
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result.verdict === "equivalent" && result.budget?.satisfied ? 0 : 1
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2))
  } catch (error) {
    process.stderr.write(`Shadow comparison refused: ${error.message}\n`)
    process.exitCode = 1
  }
}
