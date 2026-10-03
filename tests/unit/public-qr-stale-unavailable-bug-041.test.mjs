import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * QA BUG-041 (38c42a1..2c45031): a signed-in member scanning a QR that had
 * just been switched back on was told "This loyalty card is unavailable". The
 * /q lookup (`lib/customer/join-lookup.ts`) is an `unstable_cache` entry under
 * the merchant tag, revalidated with the "max" profile, so the first read
 * after a write was served the row cached while the QR was off.
 *
 * The real resolver (`lib/customer/join.ts`), the real lookup module and the
 * real cache helper (`lib/cache/tags.ts`) are bundled. Only `next/cache` (a
 * store that keeps whatever it cached, like a fresh or stale entry) and the
 * Supabase service client (a mutable qr_codes / merchants row) are replaced.
 */
const REAL = new Set([
  "@/lib/customer/join-lookup",
  "@/lib/customer/availability",
  "@/lib/cache/tags",
  "@/lib/customer/qr-rate-limit-core",
  "@/lib/customer/reward-examples",
])

const STATE = `export const state = {
  cache: new Map(), cacheOptions: new Map(), revalidated: [], reads: [],
  qrActive: true, merchantStatus: "active",
};`

// unstable_cache that never refreshes on its own: the first answer for a key
// is served again, as a fresh or stale-while-revalidate entry would be.
const NEXT_CACHE = `import { state } from "fixture-state";
  export function unstable_cache(load, keyParts, options) {
    return async () => {
      const key = JSON.stringify(keyParts)
      state.cacheOptions.set(key, options)
      if (!state.cache.has(key)) state.cache.set(key, await load())
      return structuredClone(state.cache.get(key))
    }
  }
  export function revalidateTag(tag, profile) { state.revalidated.push([tag, profile]) }
  export function revalidatePath() {}`

const CARD = {
  id: "card-1",
  location_id: "location-1",
  card_name: "Stamp card",
  stamps_required: 5,
  reward_terms: "Terms.",
  reward_expires_after_days: null,
  merchant_locations: { trading_day_starts_at: "05:00" },
  minimum_spend_pence: null,
  one_transaction_per_stamp: true,
  is_active: true,
  reward_pool_items: [],
}

const SUPABASE = `import { state } from "fixture-state";
  const CARD = ${JSON.stringify(CARD)};
  function merchant() {
    return { id: "merchant-1", business_name: "The Old Crown", business_slug: "old-crown",
      email: "venue@example.test", phone: null, status: state.merchantStatus,
      requires_billing: false, billing_customers: null };
  }
  function row(table) {
    if (table === "qr_codes") {
      return { id: "qr-code-1", qr_id: "old-crown-qr", merchant_id: "merchant-1",
        is_active: state.qrActive, destination_type: "join",
        merchants: merchant(), loyalty_cards: CARD };
    }
    if (table === "merchants") return { ...merchant(), loyalty_cards: [CARD] };
    return null;
  }
  function query(table) {
    let columns = "";
    const builder = {
      select(value) { columns = value; return builder },
      eq() { return builder },
      order() { return builder },
      maybeSingle: async () => {
        state.reads.push(table + ":" + (columns.includes("merchants(") || columns.includes("loyalty_cards(") ? "state" : "identity"));
        return { data: row(table), error: null };
      },
      then(resolve) { return Promise.resolve({ data: [], error: null }).then(resolve) },
    };
    return builder;
  }
  export function createSupabaseServiceRoleClient() { return { from: query } }`

const SPECIAL = {
  "server-only": "",
  "fixture-state": STATE,
  "next/cache": NEXT_CACHE,
  "next/server": "export function after() {}",
  "@/lib/supabase/server": SUPABASE,
  "@/lib/analytics/events": "export async function recordProductEvent() {}",
  "@/lib/customer/identity":
    "export async function getCurrentCustomer() { return null }",
  "@/lib/customer/qr-rate-limit":
    "export async function enforceQrScanRateLimit() {}",
  "@/lib/observability/logger": "export const logger = { warn() {} }",
}

async function loadResolver() {
  const root = process.cwd()
  const result = await build({
    stdin: {
      contents: `export { resolveQrForJoin, getMerchantJoinContext } from "./lib/customer/join.ts";
        export * as lookup from "./lib/customer/join-lookup.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "join-lookup-boundaries",
        setup(build) {
          build.onResolve({ filter: /^@\/lib\// }, ({ path: specifier }) =>
            REAL.has(specifier)
              ? { path: path.join(root, `${specifier.slice(2)}.ts`) }
              : { path: specifier, namespace: "fixture" }
          )
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => {
              if (!(id in SPECIAL)) throw new Error(`unexpected import ${id}`)
              return { contents: SPECIAL[id], resolveDir: root }
            }
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

const scan = (join) =>
  join.resolveQrForJoin("old-crown-qr", { recordScan: false })

test("Given the lookup cached a switched-off QR When the QR is switched back on Then the next scan is available", async () => {
  const join = await loadResolver()
  join.state.qrActive = false
  assert.equal((await scan(join)).available, false)

  join.state.qrActive = true
  for (let round = 0; round < 3; round += 1) {
    assert.equal((await scan(join)).available, true)
  }
})

test("Given the lookup cached a suspended venue When it is reinstated Then its join page and QR are available at once", async () => {
  const join = await loadResolver()
  join.state.merchantStatus = "suspended"
  assert.equal((await scan(join)).available, false)
  assert.equal(
    (await join.getMerchantJoinContext("old-crown"))?.available,
    false
  )

  join.state.merchantStatus = "active"
  assert.equal((await scan(join)).available, true)
  assert.equal(
    (await join.getMerchantJoinContext("old-crown"))?.available,
    true
  )
})

test("Given an available QR When it is scanned again Then the cached row is used without another database read", async () => {
  const join = await loadResolver()
  await scan(join)
  const reads = join.state.reads.length
  await scan(join)
  assert.equal(join.state.reads.length, reads)
})

test("Given a still switched-off QR When it is scanned Then it stays unavailable", async () => {
  const join = await loadResolver()
  join.state.qrActive = false
  assert.equal((await scan(join)).available, false)
  assert.equal((await scan(join)).available, false)
})

test("Given a switched-off QR When it is resolved Then its pause is preserved in the landing read model", async () => {
  const join = await loadResolver()
  join.state.qrActive = false

  const context = await scan(join)

  assert.equal(context.available, false)
  assert.equal(context.qrPaused, true)
})

test("Given a suspended venue with an active QR When it is resolved Then it is unavailable without reporting a QR pause", async () => {
  const join = await loadResolver()
  join.state.merchantStatus = "suspended"

  const context = await scan(join)

  assert.equal(context.available, false)
  assert.equal(context.qrPaused, false)
})

test("the join rows carry a join-availability tag that writers expire with no stale window", async () => {
  const join = await loadResolver()
  await scan(join)
  await join.getMerchantJoinContext("old-crown")

  const stateEntries = [...join.state.cacheOptions].filter(([key]) =>
    /join-context/.test(key)
  )
  assert.equal(stateEntries.length, 2)
  for (const [, options] of stateEntries) {
    assert.deepEqual(options.tags, [
      "merchant:merchant-1",
      "join-availability:merchant-1",
    ])
  }

  assert.equal(typeof join.lookup.expireJoinAvailability, "function")
  join.lookup.expireJoinAvailability("merchant-1")
  assert.deepEqual(join.state.revalidated, [
    ["join-availability:merchant-1", { expire: 0 }],
  ])
})

test("QR pause and resume, and admin venue and QR controls, expire join availability after the write", () => {
  const read = (...segments) =>
    readFileSync(path.join(process.cwd(), ...segments), "utf8")
  const checks = [
    [read("app", "app", "qr", "actions.ts"), 2],
    [read("app", "app", "qr", "pause-actions.ts"), 1],
    [read("app", "admin", "actions.ts"), 2],
  ]
  for (const [source, calls] of checks) {
    const matches = source.match(
      /expireJoinAvailability\((merchant\.id|merchantId)\)/g
    )
    assert.equal(matches?.length, calls)
  }
})
