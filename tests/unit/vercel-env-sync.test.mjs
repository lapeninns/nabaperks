import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

import {
  planVercelEnvironmentSync,
  requiredEnvironmentGaps,
} from "../../scripts/vercel-governance/env-sync.mjs"

const CONTRACT = JSON.parse(
  readFileSync("config/vercel-governance-contract.json", "utf8")
)

function completeValues(environment) {
  const target = CONTRACT.environments[environment]
  const values = Object.fromEntries(
    target.requiredKeys.map((name) => [name, `${name.toLowerCase()}-value`])
  )
  for (const alternatives of target.requiredAnyOf ?? []) {
    for (const name of alternatives[0]) {
      values[name] = `${name.toLowerCase()}-value`
    }
  }
  return values
}

test("Vercel sync excludes deployment credentials from application runtime", () => {
  const localValues = {
    NEXT_PUBLIC_APP_URL: "https://nabaperks.com",
    SUPABASE_DB_PASSWORD: "must-not-sync",
  }
  const plan = planVercelEnvironmentSync({
    contract: CONTRACT,
    environment: "production",
    existingNames: ["SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_REF"],
    localNames: Object.keys(localValues),
    localValues,
  })

  assert.deepEqual(plan.add, ["NEXT_PUBLIC_APP_URL"])
  assert.deepEqual(plan.excludedLocal, ["SUPABASE_DB_PASSWORD"])
  assert.deepEqual(plan.existingForbidden, [
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_PROJECT_REF",
  ])
  assert.deepEqual(plan.removeForbidden, [])
})

test("Vercel sync can explicitly plan removal of existing forbidden keys", () => {
  const plan = planVercelEnvironmentSync({
    contract: CONTRACT,
    environment: "production",
    existingNames: ["SUPABASE_DB_PASSWORD", "SUPABASE_PROJECT_REF"],
    localNames: [],
    localValues: {},
    pruneForbidden: true,
  })

  assert.deepEqual(plan.removeForbidden, [
    "SUPABASE_DB_PASSWORD",
    "SUPABASE_PROJECT_REF",
  ])
})

test("staging completeness follows its environment-specific contract", () => {
  const values = completeValues("staging")

  assert.deepEqual(requiredEnvironmentGaps(CONTRACT, "staging", values), {
    missingAlternatives: [],
    missingKeys: [],
  })

  delete values.PRODUCTION_MONITOR_SECRET
  delete values.TWILIO_AUTH_TOKEN
  const gaps = requiredEnvironmentGaps(CONTRACT, "staging", values)

  assert.deepEqual(gaps.missingKeys, ["PRODUCTION_MONITOR_SECRET"])
  assert.deepEqual(gaps.missingAlternatives, [
    [["TWILIO_AUTH_TOKEN"], ["TWILIO_API_KEY_SID", "TWILIO_API_KEY_SECRET"]],
  ])
})

test("replace mode separates additions from rotations without leaking values", () => {
  const localValues = {
    NEXT_PUBLIC_APP_URL: "https://staging.example.test",
    RESEND_API_KEY: "secret-value",
  }
  const plan = planVercelEnvironmentSync({
    contract: CONTRACT,
    environment: "staging",
    existingNames: ["RESEND_API_KEY"],
    localNames: Object.keys(localValues),
    localValues,
    replace: true,
  })

  assert.deepEqual(plan.add, ["NEXT_PUBLIC_APP_URL"])
  assert.deepEqual(plan.replace, ["RESEND_API_KEY"])
  assert.doesNotMatch(JSON.stringify(plan), /secret-value/)
})
