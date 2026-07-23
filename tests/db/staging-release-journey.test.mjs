import { after, test } from "node:test"

import { proveRolledBackLoyaltyJourney } from "../../scripts/check-staging-release.mjs"
import { closeDb, db, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(closeDb)

test(
  "staging release journey creates merchant-to-reward state and rolls it all back",
  { skip },
  async () => {
    await proveRolledBackLoyaltyJourney(db(), {
      revision: "0".repeat(40),
    })
  }
)
