import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { after, test } from "node:test"

import { verifyRestoredDatabase } from "../../scripts/check-restored-backup.mjs"
import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

test(
  "local restore verifier checks the current test ledger and database invariants without proving backup lineage",
  { skip },
  async () => {
    const evidence = await verifyRestoredDatabase(
      db(),
      readdirSync("supabase/migrations")
        .map((name) => name.match(/^(\d{14})_.*\.sql$/)?.[1])
        .filter(Boolean)
        .sort()
    )

    assert.ok(evidence.migrationCount > 0)
    assert.equal(evidence.activeCronJobs, 0)
    assert.equal(typeof evidence.counts.merchants, "string")
  }
)
