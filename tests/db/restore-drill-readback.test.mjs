import assert from "node:assert/strict"
import { after, test } from "node:test"

import {
  migrationVersionsAt,
  verifyRestoredDatabase,
} from "../../scripts/check-restored-backup.mjs"
import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

test(
  "restore drill readback proves the ledger, forced RLS and core database path without writes",
  { skip },
  async () => {
    const evidence = await verifyRestoredDatabase(
      db(),
      migrationVersionsAt(process.cwd(), new Date("2999-01-01T00:00:00.000Z"))
    )

    assert.ok(evidence.migrationCount > 0)
    assert.equal(evidence.activeCronJobs, 0)
    assert.equal(typeof evidence.counts.merchants, "string")
  }
)
