import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import {
  customerTermsSnapshotTriggerName,
  readCustomerLegalVersion,
} from "../../scripts/check-staging-release.mjs"

// QA BUG-006 (38c42a1..2c45031): the runbook pre-flight named the snapshot
// function of an older terms version, so it passed on a database where joins
// recording the build's version stored the older built-in snapshot. The
// pre-flight must name the function and trigger of the version the build
// records, and the staging proof and readiness must check that trigger.

const runbook = readFileSync("docs/operations/production-runbook.md", "utf8")

test("the runbook terms pre-flight names the snapshot of the build's terms version", () => {
  const version = readCustomerLegalVersion()
  const suffix = version.replaceAll("-", "").replaceAll(".", "_")
  const triggerName = customerTermsSnapshotTriggerName(version)

  assert.equal(triggerName, `customer_terms_apply_v${suffix}_snapshot`)
  assert.ok(
    runbook.includes(`**Satisfied by version \`${version}\`**`),
    "the email sign-in terms precondition names the current version"
  )
  assert.ok(
    runbook.includes(`public.apply_customer_legal_terms_snapshot_v${suffix}()`),
    "the pre-flight names the current version's snapshot function"
  )
  assert.ok(
    runbook.includes(`'${triggerName}'`),
    "the pre-flight query checks the current version's trigger"
  )
  assert.match(runbook, /^### Migrations before the app$/m)
  assert.match(runbook, /\(#migrations-before-the-app\)/)
  assert.match(runbook, /`-` removed and `\.` replaced by `_`/)
})

test("the trigger name rule matches the database guard and refuses undated versions", () => {
  assert.equal(
    customerTermsSnapshotTriggerName("2026-09-28.1"),
    "customer_terms_apply_v20260928_1_snapshot"
  )
  assert.equal(
    customerTermsSnapshotTriggerName("2026-09-26"),
    "customer_terms_apply_v20260926_snapshot"
  )
  for (const version of ["staging-release-v1", "2026-09-28.0", ""]) {
    assert.throws(() => customerTermsSnapshotTriggerName(version))
  }
  const guard = readFileSync(
    "supabase/migrations/20261007100300_loyalty_terms_snapshot_v20260928_1.sql",
    "utf8"
  )
  assert.match(
    guard,
    /'customer_terms_apply_v'\s*\|\| replace\(replace\(new\.policy_version, '-', ''\), '\.', '_'\)\s*\|\| '_snapshot'/
  )
})

test("the staging proof and readiness check the build's terms version", () => {
  const script = readFileSync("scripts/check-staging-release.mjs", "utf8")
  assert.match(
    script,
    /await proveCustomerTermsSnapshot\(sql, readCustomerLegalVersion\(\)\)/
  )
  assert.match(script, /readiness\.checks\?\.legalTerms/)
  const route = readFileSync("app/api/readiness/route.ts", "utf8")
  assert.match(route, /legalVersion: CUSTOMER_LEGAL_VERSION/)
})
