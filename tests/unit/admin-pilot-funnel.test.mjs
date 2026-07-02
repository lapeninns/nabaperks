import assert from "node:assert/strict"
import { test } from "node:test"

// Pure module only: `@/lib/analytics/events` is deliberately NOT imported here
// (it pulls the Supabase server client). Stage names being real product
// events is already compiler-enforced: PILOT_FUNNEL_STAGES is typed against
// ProductEventName via a type-only import, so `pnpm typecheck` fails on any
// event that leaves the taxonomy.
import {
  PILOT_FUNNEL_STAGES,
  pilotFunnelEventNames,
  toPilotFunnelItems,
} from "@/lib/analytics/pilot-funnel"

test("the pilot funnel is a curated eight-stage journey, not the whole event stream", () => {
  assert.equal(PILOT_FUNNEL_STAGES.length, 8)
})

test("the funnel runs merchant setup through to redemption in order", () => {
  assert.deepEqual(
    PILOT_FUNNEL_STAGES.map((stage) => stage.event),
    [
      "merchant_signed_up",
      "loyalty_card_created",
      "qr_created",
      "qr_scanned",
      "customer_joined",
      "stamp_issued",
      "reward_unlocked",
      "reward_redeemed",
    ]
  )
  assert.deepEqual(
    [...pilotFunnelEventNames],
    PILOT_FUNNEL_STAGES.map((stage) => stage.event)
  )
})

test("stage labels are humanised copy, not raw event keys", () => {
  for (const stage of PILOT_FUNNEL_STAGES) {
    assert.ok(stage.label.length > 0)
    assert.doesNotMatch(stage.label, /_/)
    assert.match(stage.label, /^[A-Z]/)
  }
})

test("toPilotFunnelItems preserves stage order and defaults missing counts to zero", () => {
  const items = toPilotFunnelItems({ qr_scanned: 42, customer_joined: 7 })

  assert.equal(items.length, 8)
  assert.deepEqual(
    items.map((item) => item.label),
    PILOT_FUNNEL_STAGES.map((stage) => stage.label)
  )
  assert.equal(items[3]?.value, 42)
  assert.equal(items[4]?.value, 7)
  assert.equal(items[0]?.value, 0)
  assert.equal(items[7]?.value, 0)
})
