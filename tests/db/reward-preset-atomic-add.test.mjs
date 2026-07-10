import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { after, test } from "node:test"

import postgres from "postgres"

import { closeDb, db, dbUrl, inRolledBackTxn } from "./helpers/db.mjs"
import {
  actAsMerchantOwner,
  addRewardPoolPresets,
  cleanupRewardPoolFixture,
  createOrGetJoinQr,
  createRewardPoolFixture,
  expectRewardPoolRpcRejection,
  upsertRewardPoolItem,
} from "./helpers/reward-pool-fixture.mjs"

const MIGRATION_PATH = join(
  process.cwd(),
  "supabase/migrations/20260710110000_atomic_reward_preset_add.sql"
)
const LOCAL_DB_HOSTS = new Set(["127.0.0.1", "localhost"])
const localDbUrl = resolveLocalDbUrl()
const skip = localDbUrl
  ? false
  : "atomic reward-preset proof requires local Supabase Postgres"

const THREE_PRESETS = [
  rewardPreset(
    "regulars-pint",
    "Regulars' pint",
    "One house pint, small wine, or soft drink. Valid once issued."
  ),
  rewardPreset(
    "free-starter",
    "Free starter",
    "One starter with any paid main meal. Valid once issued."
  ),
  rewardPreset(
    "dessert-on-the-house",
    "Dessert on the house",
    "One dessert with any paid main meal. Valid once issued."
  ),
]

after(async () => {
  await closeDb()
})

test(
  "reward-pool RPCs pin the exact atomic signature, ACL, search path, RLS, and direct-DML boundary",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const functions = await tx`
        select
          proname,
          pg_get_function_identity_arguments(oid) as identity_arguments,
          pg_get_function_result(oid) as function_result,
          prosecdef,
          coalesce(array_to_string(proconfig, ','), '') as function_config,
          has_function_privilege('authenticated', oid, 'execute') as authenticated_can_execute,
          has_function_privilege('service_role', oid, 'execute') as service_role_can_execute,
          has_function_privilege('anon', oid, 'execute') as anon_can_execute
        from pg_proc
        where pronamespace = 'public'::regnamespace
          and proname in (
            'add_reward_pool_presets',
            'assert_reward_pool_launch_ready',
            'delete_reward_pool_item',
            'upsert_reward_pool_item'
          )
        order by proname`

      assert.deepEqual(
        functions.map((fn) => fn.proname),
        [
          "add_reward_pool_presets",
          "assert_reward_pool_launch_ready",
          "delete_reward_pool_item",
          "upsert_reward_pool_item",
        ],
        "the atomic RPC and every affected mutation/guard function must exist"
      )

      const atomic = functions.find(
        (fn) => fn.proname === "add_reward_pool_presets"
      )
      assert.equal(
        atomic?.identity_arguments ?? "",
        "p_merchant_id uuid, p_loyalty_card_id uuid, p_presets jsonb",
        "the PostgREST named-argument contract is exact"
      )
      assert.equal(
        atomic?.function_result ?? "",
        [
          "TABLE(preset_id text",
          "reward_pool_item_id uuid",
          "reward_name text",
          "reward_terms text",
          "weight integer",
          "is_active boolean",
          "display_order integer",
          "saved_action text",
          "active_reward_count integer)",
        ].join(", "),
        "the action receives authoritative rows, outcomes, and the final active count"
      )

      for (const fn of functions) {
        assert.equal(fn.prosecdef, true, `${fn.proname} is SECURITY DEFINER`)
        assert.match(
          fn.function_config,
          fn.proname === "assert_reward_pool_launch_ready"
            ? /search_path=(?:public|"public")/
            : /search_path=(?:public, auth|"public", "auth")/,
          `${fn.proname} pins its search path`
        )
        assert.equal(
          fn.authenticated_can_execute,
          true,
          `${fn.proname}: authenticated executes`
        )
        assert.equal(
          fn.service_role_can_execute,
          true,
          `${fn.proname}: service_role executes`
        )
        assert.equal(
          fn.anon_can_execute,
          false,
          `${fn.proname}: PUBLIC/anon execute is revoked`
        )
      }

      const [table] = await tx`
        select
          relrowsecurity,
          relforcerowsecurity,
          has_table_privilege('authenticated', oid, 'select') as authenticated_select,
          has_table_privilege('authenticated', oid, 'insert') as authenticated_insert,
          has_table_privilege('authenticated', oid, 'update') as authenticated_update,
          has_table_privilege('authenticated', oid, 'delete') as authenticated_delete,
          has_table_privilege('service_role', oid, 'select, insert, update, delete') as service_role_maintenance,
          has_table_privilege('anon', oid, 'select, insert, update, delete') as anon_table_access
        from pg_class
        where oid = 'public.reward_pool_items'::regclass`

      assert.equal(table.relrowsecurity, true, "reward pool RLS stays enabled")
      assert.equal(
        table.relforcerowsecurity,
        true,
        "reward pool RLS stays forced"
      )
      assert.equal(
        table.authenticated_select,
        true,
        "owner reads remain available"
      )
      assert.equal(
        table.authenticated_insert,
        false,
        "direct inserts are revoked"
      )
      assert.equal(
        table.authenticated_update,
        false,
        "direct updates are revoked"
      )
      assert.equal(
        table.authenticated_delete,
        false,
        "direct deletes are revoked"
      )
      assert.equal(
        table.service_role_maintenance,
        true,
        "service-role maintenance remains available"
      )
      assert.equal(
        table.anon_table_access,
        false,
        "anonymous table access stays denied"
      )
    })
  }
)

test(
  "one atomic call creates three active presets with exact product and audit ledgers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      const rows = await addRewardPoolPresets(tx, fixture, THREE_PRESETS)

      assert.deepEqual(
        rows.map((row) => row.preset_id),
        THREE_PRESETS.map((preset) => preset.preset_id),
        "the RPC returns catalogue order"
      )
      assert.deepEqual(
        rows.map((row) => row.reward_name),
        THREE_PRESETS.map((preset) => preset.reward_name)
      )
      assert.deepEqual(
        rows.map((row) => row.saved_action),
        Array(3).fill("reward_pool_item_created")
      )
      assert.deepEqual(
        rows.map((row) => row.display_order),
        [1, 2, 3]
      )
      assert.deepEqual(
        rows.map((row) => row.active_reward_count),
        [3, 3, 3]
      )
      assert.ok(rows.every((row) => row.weight === 1 && row.is_active === true))

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 3,
        active_reward_count: 3,
        product_event_count: 3,
        audit_count: 3,
      })

      const audits = await tx`
        select target_id::text as target_id
        from public.audit_logs
        where merchant_id = ${fixture.merchantId}::uuid
          and target_table = 'reward_pool_items'
          and action = 'reward_pool_item_created'
        order by target_id`
      assert.deepEqual(
        audits.map((row) => row.target_id).sort(),
        rows.map((row) => row.reward_pool_item_id).sort(),
        "each created reward owns one matching audit row"
      )
    })
  }
)

test(
  "a failure after the first reward audit rolls back every reward, product event, and audit",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)
      await installSecondRewardAuditFailure(tx, fixture)

      await expectRewardPoolRpcRejection(
        tx,
        () => addRewardPoolPresets(tx, fixture, THREE_PRESETS),
        /scoped second reward audit failure/i,
        "a mid-ledger failure must reject the whole batch"
      )

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 0,
        active_reward_count: 0,
        product_event_count: 0,
        audit_count: 0,
      })
    })
  }
)

test(
  "an identical retry returns authoritative existing rows without duplicate rewards or ledgers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      const first = await addRewardPoolPresets(tx, fixture, THREE_PRESETS)
      const retry = await addRewardPoolPresets(tx, fixture, THREE_PRESETS)

      assert.deepEqual(
        first.map((row) => row.saved_action),
        Array(3).fill("reward_pool_item_created")
      )
      assert.deepEqual(
        retry.map((row) => row.saved_action),
        Array(3).fill("reward_pool_item_existing")
      )
      assert.deepEqual(
        retry.map((row) => row.reward_pool_item_id),
        first.map((row) => row.reward_pool_item_id),
        "a retry returns the original rows in request order"
      )
      assert.deepEqual(
        retry.map((row) => row.active_reward_count),
        [3, 3, 3]
      )

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 3,
        active_reward_count: 3,
        product_event_count: 3,
        audit_count: 3,
      })
    })
  }
)

test(
  "active and inactive normalized-name matches are returned without overwrite, reactivation, or new ledgers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      const active = await upsertRewardPoolItem(tx, fixture, {
        rewardName: "REGULARS'   PINT",
        rewardTerms:
          "Keep this merchant-authored active reward exactly as saved.",
        displayOrder: 4,
      })
      const inactive = await upsertRewardPoolItem(tx, fixture, {
        rewardName: "Free   Starter",
        rewardTerms:
          "Keep this merchant-authored inactive reward exactly as saved.",
        isActive: false,
        displayOrder: 8,
      })

      const rows = await addRewardPoolPresets(
        tx,
        fixture,
        THREE_PRESETS.slice(0, 2)
      )

      assert.deepEqual(
        rows.map((row) => row.saved_action),
        ["reward_pool_item_existing", "reward_pool_item_existing"]
      )
      assert.deepEqual(
        rows.map((row) => row.reward_pool_item_id),
        [active.reward_pool_item_id, inactive.reward_pool_item_id]
      )
      assert.equal(rows[0].reward_name, "REGULARS'   PINT")
      assert.equal(
        rows[0].reward_terms,
        "Keep this merchant-authored active reward exactly as saved."
      )
      assert.equal(rows[0].is_active, true)
      assert.equal(rows[1].reward_name, "Free   Starter")
      assert.equal(
        rows[1].reward_terms,
        "Keep this merchant-authored inactive reward exactly as saved."
      )
      assert.equal(rows[1].is_active, false)
      assert.deepEqual(
        rows.map((row) => row.active_reward_count),
        [1, 1]
      )

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 2,
        active_reward_count: 1,
        product_event_count: 2,
        audit_count: 2,
      })
    })
  }
)

test(
  "empty, malformed, and eight-item batches reject before any reward or ledger write",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      await expectFailureMessage(
        () => tx.savepoint(() => addRewardPoolPresets(tx, fixture, [])),
        /batch must contain between 1 and 7 presets/i,
        "empty batches are invalid"
      )
      await expectFailureMessage(
        () =>
          tx.savepoint(() =>
            addRewardPoolPresets(tx, fixture, {
              preset_id: "not-an-array",
              reward_name: "Malformed",
              reward_terms: "This object is not a preset array.",
            })
          ),
        /batch must contain between 1 and 7 presets/i,
        "non-array JSON is invalid"
      )
      await expectFailureMessage(
        () =>
          tx.savepoint(() =>
            addRewardPoolPresets(tx, fixture, [
              rewardPreset("invalid-terms", "Invalid terms", "too short"),
            ])
          ),
        /preset.*name.*terms|invalid preset payload/i,
        "the complete payload is validated before insertion"
      )
      await expectFailureMessage(
        () =>
          tx.savepoint(() =>
            addRewardPoolPresets(
              tx,
              fixture,
              Array.from({ length: 8 }, (_, index) =>
                rewardPreset(
                  `preset-${index + 1}`,
                  `Reward ${index + 1}`,
                  `Reward terms for batch item ${index + 1} are long enough.`
                )
              )
            )
          ),
        /batch must contain between 1 and 7 presets/i,
        "the defensive batch ceiling is seven"
      )

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 0,
        active_reward_count: 0,
        product_event_count: 0,
        audit_count: 0,
      })
    })
  }
)

test(
  "anonymous and cross-owner calls fail while owner RLS reads remain isolated",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const ownerFixture = await createRewardPoolFixture(tx)
      const otherFixture = await createRewardPoolFixture(tx)

      await actAsMerchantOwner(tx, ownerFixture.ownerUserId)
      await expectRewardPoolRpcRejection(
        tx,
        () => addRewardPoolPresets(tx, otherFixture, THREE_PRESETS),
        /ownership|merchant|card|permission|not found/i,
        "one owner cannot add presets to another merchant's card"
      )

      await expectRewardPoolRpcRejection(
        tx,
        () =>
          asAnon(tx, (sp) =>
            addRewardPoolPresets(sp, ownerFixture, THREE_PRESETS)
          ),
        /permission denied|execute/i,
        "anonymous callers cannot execute the definer RPC"
      )

      await actAsMerchantOwner(tx, ownerFixture.ownerUserId)
      await addRewardPoolPresets(tx, ownerFixture, [THREE_PRESETS[0]])

      const visible = await asAuthenticated(
        tx,
        ownerFixture.ownerUserId,
        (sp) =>
          sp`
          select merchant_id::text as merchant_id
          from public.reward_pool_items
          order by merchant_id`
      )
      assert.deepEqual(
        visible.map((row) => row.merchant_id),
        [ownerFixture.merchantId],
        "authenticated SELECT remains owner-scoped by RLS"
      )

      const [otherState] = await readRewardBatchState(tx, otherFixture)
      assert.deepEqual(otherState, {
        reward_count: 0,
        active_reward_count: 0,
        product_event_count: 0,
        audit_count: 0,
      })
    })
  }
)

test(
  "authenticated owners can select their rewards but cannot insert, update, or delete the table directly",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      const rewardId = randomUUID()
      await tx`
        insert into public.reward_pool_items (
          id,
          merchant_id,
          location_id,
          loyalty_card_id,
          reward_name,
          reward_terms,
          weight,
          is_active,
          display_order
        ) values (
          ${rewardId}::uuid,
          ${fixture.merchantId}::uuid,
          ${fixture.locationId}::uuid,
          ${fixture.cardId}::uuid,
          'Trusted fixture reward',
          'This fixture exists to prove direct DML is denied.',
          1,
          true,
          1
        )`

      const ownRows = await asAuthenticated(
        tx,
        fixture.ownerUserId,
        (sp) =>
          sp`
          select id::text as id
          from public.reward_pool_items
          where merchant_id = ${fixture.merchantId}::uuid`
      )
      assert.deepEqual(
        ownRows.map((row) => row.id),
        [rewardId]
      )

      const insertFailure = await captureFailure(() =>
        asAuthenticated(
          tx,
          fixture.ownerUserId,
          (sp) => sp`
          insert into public.reward_pool_items (
            merchant_id,
            location_id,
            loyalty_card_id,
            reward_name,
            reward_terms,
            weight,
            is_active,
            display_order
          ) values (
            ${fixture.merchantId}::uuid,
            ${fixture.locationId}::uuid,
            ${fixture.cardId}::uuid,
            'Forbidden direct insert',
            'This row must never be written by authenticated DML.',
            1,
            true,
            2
          )`
        )
      )
      const updateFailure = await captureFailure(() =>
        asAuthenticated(
          tx,
          fixture.ownerUserId,
          (sp) => sp`
          update public.reward_pool_items
          set reward_name = 'Forbidden direct update'
          where id = ${rewardId}::uuid`
        )
      )
      const deleteFailure = await captureFailure(() =>
        asAuthenticated(
          tx,
          fixture.ownerUserId,
          (sp) => sp`
          delete from public.reward_pool_items
          where id = ${rewardId}::uuid`
        )
      )

      assert.match(insertFailure, /permission denied/i)
      assert.match(updateFailure, /permission denied/i)
      assert.match(deleteFailure, /permission denied/i)

      const [stored] = await tx`
        select reward_name
        from public.reward_pool_items
        where id = ${rewardId}::uuid`
      assert.equal(stored.reward_name, "Trusted fixture reward")
    })
  }
)

test(
  "identical same-card batches serialize to one reward and ledger set",
  { skip, timeout: 10_000 },
  async () => {
    const setup = db()
    const fixture = await createRewardPoolFixture(setup)

    try {
      const startTogether = createStartBarrier(2)
      const [first, second] = await Promise.all([
        callBatchOnDedicatedConnection(fixture, THREE_PRESETS, startTogether),
        callBatchOnDedicatedConnection(fixture, THREE_PRESETS, startTogether),
      ])
      const rows = [...first, ...second]

      assert.equal(first.length, 3)
      assert.equal(second.length, 3)
      assert.equal(
        rows.filter((row) => row.saved_action === "reward_pool_item_created")
          .length,
        3
      )
      assert.equal(
        rows.filter((row) => row.saved_action === "reward_pool_item_existing")
          .length,
        3
      )

      const [state] = await readRewardBatchState(setup, fixture)
      assert.deepEqual(state, {
        reward_count: 3,
        active_reward_count: 3,
        product_event_count: 3,
        audit_count: 3,
      })
    } finally {
      await cleanupRewardPoolFixture(setup, fixture)
    }
  }
)

test(
  "disjoint same-card batches serialize to non-overlapping stable display orders",
  { skip, timeout: 10_000 },
  async () => {
    const setup = db()
    const fixture = await createRewardPoolFixture(setup)
    const firstBatch = THREE_PRESETS.slice(0, 2)
    const secondBatch = [
      rewardPreset(
        "coffee-after-lunch",
        "Coffee after lunch",
        "One hot drink after a paid lunch. Valid once issued."
      ),
      rewardPreset(
        "sunday-roast-upgrade",
        "Sunday roast upgrade",
        "One roast upgrade with a paid Sunday main. Valid once issued."
      ),
    ]

    try {
      const startTogether = createStartBarrier(2)
      const [first, second] = await Promise.all([
        callBatchOnDedicatedConnection(fixture, firstBatch, startTogether),
        callBatchOnDedicatedConnection(fixture, secondBatch, startTogether),
      ])
      const rows = [...first, ...second]

      assert.ok(
        rows.every((row) => row.saved_action === "reward_pool_item_created")
      )
      assert.deepEqual(
        rows
          .map((row) => row.display_order)
          .sort((left, right) => left - right),
        [1, 2, 3, 4]
      )
      assertStrictlyIncreasing(first.map((row) => row.display_order))
      assertStrictlyIncreasing(second.map((row) => row.display_order))

      const [state] = await readRewardBatchState(setup, fixture)
      assert.deepEqual(state, {
        reward_count: 4,
        active_reward_count: 4,
        product_event_count: 4,
        audit_count: 4,
      })
    } finally {
      await cleanupRewardPoolFixture(setup, fixture)
    }
  }
)

test(
  "single-item create and rename reject normalized-name collisions without extra ledgers",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      await upsertRewardPoolItem(tx, fixture, {
        rewardName: "Free starter",
        displayOrder: 1,
      })
      const second = await upsertRewardPoolItem(tx, fixture, {
        rewardName: "Dessert on the house",
        displayOrder: 2,
      })

      await expectRewardPoolRpcRejection(
        tx,
        () =>
          upsertRewardPoolItem(tx, fixture, {
            rewardName: "  FREE   STARTER  ",
            displayOrder: 3,
          }),
        /already exists|already in.*pool|duplicate/i,
        "one-item create shares the normalized-name invariant"
      )
      await expectRewardPoolRpcRejection(
        tx,
        () =>
          upsertRewardPoolItem(tx, fixture, {
            rewardPoolItemId: second.reward_pool_item_id,
            rewardName: " free    starter ",
            displayOrder: 2,
          }),
        /already exists|already in.*pool|duplicate/i,
        "one-item rename shares the normalized-name invariant"
      )

      const rewards = await tx`
        select reward_name
        from public.reward_pool_items
        where merchant_id = ${fixture.merchantId}::uuid
        order by display_order`
      assert.deepEqual(
        rewards.map((row) => row.reward_name),
        ["Free starter", "Dessert on the house"]
      )

      const [state] = await readRewardBatchState(tx, fixture)
      assert.deepEqual(state, {
        reward_count: 2,
        active_reward_count: 2,
        product_event_count: 2,
        audit_count: 2,
      })
    })
  }
)

test(
  "the third active preset preserves the launch-ready QR boundary",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const fixture = await createRewardPoolFixture(tx)
      await actAsMerchantOwner(tx, fixture.ownerUserId)

      const firstTwo = await addRewardPoolPresets(
        tx,
        fixture,
        THREE_PRESETS.slice(0, 2)
      )
      assert.deepEqual(
        firstTwo.map((row) => row.active_reward_count),
        [2, 2]
      )
      await expectRewardPoolRpcRejection(
        tx,
        () => createOrGetJoinQr(tx, fixture),
        /3 active mystery rewards/i,
        "two active presets remain below launch readiness"
      )

      const [third] = await addRewardPoolPresets(tx, fixture, [
        THREE_PRESETS[2],
      ])
      assert.equal(third.saved_action, "reward_pool_item_created")
      assert.equal(third.active_reward_count, 3)

      const qr = await createOrGetJoinQr(tx, fixture)
      assert.ok(qr.qr_code_uuid, "the third active reward unlocks the join QR")
    })
  }
)

test(
  "the atomic reward-preset migration replays without widening its exact contract",
  { skip },
  async () => {
    assert.ok(
      existsSync(MIGRATION_PATH),
      "atomic reward-preset migration must exist (RED until implemented)"
    )
    const source = readFileSync(MIGRATION_PATH, "utf8")

    await inRolledBackTxn(async (tx) => {
      await tx.unsafe(source)
      await tx.unsafe(source)

      const [contract] = await tx`
        select
          pg_get_function_identity_arguments(oid) as identity_arguments,
          has_function_privilege('anon', oid, 'execute') as anon_can_execute
        from pg_proc
        where oid = 'public.add_reward_pool_presets(uuid, uuid, jsonb)'::regprocedure`
      assert.equal(
        contract.identity_arguments,
        "p_merchant_id uuid, p_loyalty_card_id uuid, p_presets jsonb"
      )
      assert.equal(contract.anon_can_execute, false)
    })
  }
)

function rewardPreset(presetId, rewardName, rewardTerms) {
  return {
    preset_id: presetId,
    reward_name: rewardName,
    reward_terms: rewardTerms,
  }
}

function readRewardBatchState(sql, fixture) {
  return sql`
    select
      (select count(*)::int
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid) as reward_count,
      (select count(*)::int
       from public.reward_pool_items
       where merchant_id = ${fixture.merchantId}::uuid
         and loyalty_card_id = ${fixture.cardId}::uuid
         and is_active) as active_reward_count,
      (select count(*)::int
       from public.product_events
       where merchant_id = ${fixture.merchantId}::uuid
         and event_name = 'reward_pool_item_created') as product_event_count,
      (select count(*)::int
       from public.audit_logs
       where merchant_id = ${fixture.merchantId}::uuid
         and target_table = 'reward_pool_items'
         and action = 'reward_pool_item_created') as audit_count`
}

async function installSecondRewardAuditFailure(tx, fixture) {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const functionName = `test_reward_batch_audit_failure_${suffix}`
  const triggerName = `test_reward_batch_audit_failure_${suffix}`

  await tx.unsafe(`
    create function public.${functionName}()
    returns trigger
    language plpgsql
    set search_path = public
    as $function$
    begin
      if new.merchant_id = '${fixture.merchantId}'::uuid
        and new.target_table = 'reward_pool_items'
        and new.action = 'reward_pool_item_created'
        and (
          select count(*)
          from public.audit_logs
          where merchant_id = '${fixture.merchantId}'::uuid
            and target_table = 'reward_pool_items'
            and action = 'reward_pool_item_created'
        ) >= 1 then
        raise exception 'scoped second reward audit failure';
      end if;
      return new;
    end;
    $function$;

    create trigger ${triggerName}
      before insert on public.audit_logs
      for each row execute function public.${functionName}();
  `)
}

async function asAuthenticated(tx, userId, action) {
  return tx.savepoint(async (sp) => {
    await sp`set local role authenticated`
    await sp`select set_config('request.jwt.claim.role', 'authenticated', true)`
    await sp`select set_config('request.jwt.claim.sub', ${userId}, true)`
    const result = await action(sp)
    await sp`reset role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    return result
  })
}

async function asAnon(tx, action) {
  return tx.savepoint(async (sp) => {
    await sp`set local role anon`
    await sp`select set_config('request.jwt.claim.role', 'anon', true)`
    await sp`select set_config('request.jwt.claim.sub', '', true)`
    const result = await action(sp)
    await sp`reset role`
    await sp`select set_config('request.jwt.claim.role', 'service_role', true)`
    return result
  })
}

async function callBatchOnDedicatedConnection(fixture, presets, start) {
  assert.ok(localDbUrl)
  const sql = postgres(localDbUrl, { max: 1 })
  try {
    return await sql.begin(async (tx) => {
      await tx`set local role authenticated`
      await tx`select set_config('request.jwt.claim.role', 'authenticated', true)`
      await tx`select set_config('request.jwt.claim.sub', ${fixture.ownerUserId}, true)`
      await start()
      return addRewardPoolPresets(tx, fixture, presets)
    })
  } finally {
    await sql.end({ timeout: 5 })
  }
}

function createStartBarrier(participantCount) {
  let arrived = 0
  let release
  const opened = new Promise((resolve) => {
    release = resolve
  })

  return async () => {
    arrived += 1
    if (arrived === participantCount) release()
    await opened
  }
}

function assertStrictlyIncreasing(values) {
  for (let index = 1; index < values.length; index += 1) {
    assert.ok(values[index] > values[index - 1])
  }
}

async function captureFailure(action) {
  try {
    await action()
    return ""
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function expectFailureMessage(action, pattern, message) {
  const failure = await captureFailure(action)
  assert.doesNotMatch(
    failure,
    /function public\.add_reward_pool_presets.*does not exist/i,
    `${message}: the atomic RPC itself must exist`
  )
  assert.match(failure, pattern, message)
}

function resolveLocalDbUrl() {
  const rawUrl = dbUrl()?.trim()
  if (!rawUrl) return undefined

  try {
    const url = new URL(rawUrl)
    return LOCAL_DB_HOSTS.has(url.hostname) &&
      ["postgres:", "postgresql:"].includes(url.protocol)
      ? rawUrl
      : undefined
  } catch {
    return undefined
  }
}
