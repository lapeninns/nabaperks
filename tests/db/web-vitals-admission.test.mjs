import { after, test } from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

import { closeDb, inRolledBackTxn, isLiveDbReady } from "./helpers/db.mjs"

const ready = await isLiveDbReady()
const skip = ready ? false : "live Supabase DB not reachable/current"

after(async () => {
  await closeDb()
})

const record = (tx, metricName, metricId) => tx`
  select public.record_web_vital_sample(
    ${metricName}, ${metricId},
    ${metricName === "CLS" ? 1 : 123}::double precision,
    ${metricName === "CLS" ? 0.1 : 12}::double precision,
    'good', 'home', 'navigate'
  ) as inserted`

test(
  "web-vital replay stores once and every request spends bounded work",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const metricId = `v4-${randomUUID()}`
      await tx`set local role service_role`

      const [first] = await record(tx, "LCP", metricId)
      const [replay] = await record(tx, "LCP", metricId)
      const [secondMetric] = await record(tx, "CLS", metricId)
      assert.equal(first.inserted, true)
      assert.equal(replay.inserted, false)
      assert.equal(secondMetric.inserted, true)

      const [{ rows }] = await tx`
      select count(*)::int as rows
      from public.web_vital_samples
      where metric_id = ${metricId}`
      assert.equal(rows, 2, "one page may retain one row per Web Vital name")

      const buckets = await tx`
      select bucket_key, count
      from public.rate_limit_buckets
      where bucket_key in (
        'web-vitals-global-burst-v1',
        'web-vitals-global-daily-v1'
      )
      order by bucket_key`
      assert.equal(buckets.length, 2)
      assert.deepEqual(
        buckets.map((bucket) => bucket.count),
        [3, 3],
        "a replay consumes no extra row but still spends global work capacity"
      )
    })
  }
)

test(
  "the fixed global budget rolls back overflow atomically",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      const metricId = `v4-${randomUUID()}`
      await tx`
      insert into public.rate_limit_buckets (bucket_key, count, reset_at)
      values ('web-vitals-global-daily-v1', 10000, now() + interval '1 day')
      on conflict (bucket_key) do update
      set count = 10000, reset_at = excluded.reset_at`
      await tx`set local role service_role`

      await assert.rejects(
        () => tx.savepoint((sp) => record(sp, "LCP", metricId)),
        /rate limit exceeded/i
      )
      const [{ rows }] = await tx`
      select count(*)::int as rows
      from public.web_vital_samples
      where metric_id = ${metricId}`
      assert.equal(
        rows,
        0,
        "a refused globally distributed write leaves no row"
      )
    })
  }
)

test(
  "API roles and direct service-role inserts cannot bypass admission",
  { skip },
  async () => {
    await inRolledBackTxn(async (tx) => {
      await tx`set local role authenticated`
      await assert.rejects(
        () => tx.savepoint((sp) => record(sp, "LCP", `v4-${randomUUID()}`)),
        /permission denied/i
      )

      await tx`set local role service_role`
      await assert.rejects(
        () =>
          tx.savepoint(
            (sp) => sp`
          insert into public.web_vital_samples (
            metric_name, metric_id, value, delta, rating, route_key,
            navigation_type
          ) values (
            'LCP', ${`v4-${randomUUID()}`}, 123, 12, 'good', 'home', 'navigate'
          )`
          ),
        /permission denied/i
      )
    })
  }
)
