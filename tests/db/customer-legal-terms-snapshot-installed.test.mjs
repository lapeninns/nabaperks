import assert from "node:assert/strict"
import { after, test } from "node:test"

import {
  proveCustomerTermsSnapshot,
  readCustomerLegalVersion,
} from "../../scripts/check-staging-release.mjs"
import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

// QA BUG-006 (38c42a1..2c45031): a build that records CUSTOMER_LEGAL_VERSION
// against a database without that version's snapshot trigger stores the join
// function's older built-in snapshot under the new version. Readiness
// (customer_legal_terms_snapshot_installed) and the staging release proof
// (pg_trigger) must both see the missing trigger.

async function installed(tx, version) {
  const [row] = await tx`
    select public.customer_legal_terms_snapshot_installed(${version}) as installed`
  return row.installed
}

test(
  "the snapshot probe is true for the app's terms version and false for any version without a trigger",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const appVersion = readCustomerLegalVersion()
      assert.equal(await installed(tx, appVersion), true)
      assert.equal(await installed(tx, "2026-09-28"), true)
      assert.equal(await installed(tx, "2026-09-26"), true)

      for (const version of [
        "2026-09-29",
        "2026-09-28.2",
        "2026-09-28.0",
        "staging-release-v1",
        "",
        null,
        "2026-09-28.1' or true --",
      ]) {
        assert.equal(await installed(tx, version), false, String(version))
      }
    })
  }
)

test(
  "a database without the app version's trigger fails the probe and the staging proof",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const appVersion = readCustomerLegalVersion()
      await proveCustomerTermsSnapshot(tx, appVersion)

      const triggerName = `customer_terms_apply_v${appVersion
        .replaceAll("-", "")
        .replaceAll(".", "_")}_snapshot`
      await tx.unsafe(
        `drop trigger ${triggerName} on public.customer_loyalty_terms_acceptances`
      )

      assert.equal(await installed(tx, appVersion), false)
      await assert.rejects(
        proveCustomerTermsSnapshot(tx, appVersion),
        /no terms snapshot trigger/
      )
    })
  }
)

test(
  "a disabled snapshot trigger does not count as installed",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`
        alter table public.customer_loyalty_terms_acceptances
        disable trigger customer_terms_apply_v20260928_snapshot`
      assert.equal(await installed(tx, "2026-09-28"), false)
      await assert.rejects(
        proveCustomerTermsSnapshot(tx, "2026-09-28"),
        /no terms snapshot trigger/
      )
    })
  }
)

test(
  "only the service role can call the snapshot probe",
  { skip },
  async () => {
    for (const role of ["anon", "authenticated"]) {
      await inRolledBackTxn(async (tx) => {
        await tx.unsafe(`set local role ${role}`)
        await assert.rejects(
          installed(tx, readCustomerLegalVersion()),
          (error) => error.code === "42501",
          role
        )
      })
    }
  }
)
