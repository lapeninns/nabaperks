import assert from "node:assert/strict"
import { after, test } from "node:test"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"
import {
  actAsMerchantOwner,
  createRewardPoolFixture,
} from "./helpers/reward-pool-fixture.mjs"

// QA BUG-001 (38c42a1..2c45031): the preset picker sends each preset with a
// `requires_age_check` flag (app/app/card/actions.ts). The public wrapper used
// to forward that key to the strict private allow-list, so every batch failed
// with 22023 before any insert.
const skip = (await isLiveDbReady()) ? false : "local Supabase is not available"

// The exact element shape the card action sends to add_reward_pool_presets.
const APP_PAYLOAD = [
  {
    preset_id: "regulars-pint",
    reward_name: "Regulars' pint",
    reward_terms:
      "One house pint, small wine, or soft drink for the member. Valid once issued.",
    requires_age_check: true,
  },
  {
    preset_id: "free-starter",
    reward_name: "Free starter",
    reward_terms:
      "One starter up to GBP 8 with any main meal. Valid once issued.",
    requires_age_check: false,
  },
  {
    preset_id: "dessert-on-the-house",
    reward_name: "Dessert on the house",
    reward_terms:
      "One dessert from the main menu with any paid main. Valid once issued.",
    requires_age_check: false,
  },
]

after(async () => {
  await closeDb()
})

async function addPresetsAsOwner(tx, fixture, presets) {
  await actAsMerchantOwner(tx, fixture.ownerUserId)
  await tx.unsafe("set local role authenticated")
  try {
    return await tx.savepoint(
      (sp) => sp`
        select preset_id, requires_age_check, active_reward_count, saved_action
        from public.add_reward_pool_presets(
          ${fixture.merchantId}::uuid,
          ${fixture.cardId}::uuid,
          ${sp.json(presets)}
        )`
    )
  } finally {
    await tx.unsafe("reset role")
    await tx`select set_config('request.jwt.claim.role', 'service_role', true)`
  }
}

async function readPoolItems(tx, fixture) {
  const rows = await tx`
    select reward_name, requires_age_check, is_active
    from public.reward_pool_items
    where loyalty_card_id = ${fixture.cardId}::uuid
    order by display_order`
  return rows.map((row) => ({ ...row }))
}

test(
  "Given the owner sends the app's preset payload When add_reward_pool_presets runs Then three active rewards keep each age-check flag",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)

      const rows = await addPresetsAsOwner(tx, fixture, APP_PAYLOAD)

      assert.deepEqual(
        rows.map((row) => [row.preset_id, row.requires_age_check]),
        [
          ["regulars-pint", true],
          ["free-starter", false],
          ["dessert-on-the-house", false],
        ]
      )
      assert.deepEqual(
        rows.map((row) => row.active_reward_count),
        [3, 3, 3]
      )
      assert.deepEqual(await readPoolItems(tx, fixture), [
        {
          reward_name: "Regulars' pint",
          requires_age_check: true,
          is_active: true,
        },
        {
          reward_name: "Free starter",
          requires_age_check: false,
          is_active: true,
        },
        {
          reward_name: "Dessert on the house",
          requires_age_check: false,
          is_active: true,
        },
      ])
    })
  }
)

test(
  "Given a preset without requires_age_check When the batch is added Then the reward defaults to an age check",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const [, starter] = APP_PAYLOAD
      const withoutFlag = {
        preset_id: starter.preset_id,
        reward_name: starter.reward_name,
        reward_terms: starter.reward_terms,
      }

      const rows = await addPresetsAsOwner(tx, fixture, [withoutFlag])

      assert.deepEqual(
        rows.map((row) => row.requires_age_check),
        [true]
      )
    })
  }
)

test(
  "Given a non-boolean requires_age_check When the batch is added Then it is rejected before any reward is written",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      for (const invalid of ["yes", 1, { value: true }]) {
        await assert.rejects(
          () =>
            addPresetsAsOwner(tx, fixture, [
              APP_PAYLOAD[0],
              { ...APP_PAYLOAD[1], requires_age_check: invalid },
            ]),
          (error) => error.code === "22023"
        )
      }
      assert.deepEqual(await readPoolItems(tx, fixture), [])
    })
  }
)

test(
  "Given an unknown extra key When the batch is added Then the strict allow-list still rejects it",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await assert.rejects(
        () =>
          addPresetsAsOwner(tx, fixture, [{ ...APP_PAYLOAD[0], weight: 5 }]),
        (error) => error.code === "22023"
      )
      assert.deepEqual(await readPoolItems(tx, fixture), [])
    })
  }
)
