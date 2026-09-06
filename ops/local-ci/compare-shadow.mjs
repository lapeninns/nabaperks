#!/usr/bin/env node
/** Compare saved provider evidence; never fetch, publish, route or promote. */
import { readFile } from "node:fs/promises"
import { parseArgs } from "node:util"

import { compareShadowEvidence } from "./core/shadow-qualification.mjs"
import { extractLaneSummary } from "./core/summary.mjs"

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"))
}

try {
  const args = process.argv.slice(2)
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
  const contract = await readJson(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  )
  const check = await readJson(values["local-check"])
  if (
    check.status !== "completed" ||
    check.head_sha !== values.sha ||
    check.app?.id !== contract.githubApp.appId ||
    check.name !== contract.checkName
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
  const started = Date.parse(check.started_at)
  const completed = Date.parse(check.completed_at)
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
  const result = compareShadowEvidence({
    contract,
    headSha: values.sha,
    profile: values.profile,
    local: bindEnvelope(summary),
    hosted: bindEnvelope(await readJson(values["hosted-evidence"])),
    publishedDurationSeconds: (completed - started) / 1000,
  })
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  process.exitCode =
    result.verdict === "equivalent" && result.budget?.satisfied ? 0 : 1
} catch (error) {
  process.stderr.write(`Shadow comparison refused: ${error.message}\n`)
  process.exitCode = 1
}
