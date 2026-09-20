import assert from "node:assert/strict"
import { test } from "node:test"
import { build } from "esbuild"

const MERCHANT_ID = "92fc8106-02d6-48d8-a6c9-34efbfac9380"

async function loadControls() {
  const result = await build({
    stdin: {
      contents:
        'export * from "./app/admin/actions.ts"; export { state } from "fixture-state";',
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "admin-control-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|next\/|@\/lib\/)/ },
            ({ path }) => {
              if (
                [
                  "@/lib/admin/action-state",
                  "@/lib/admin/merchant-control-fields",
                ].includes(path)
              )
                return null
              return { path, namespace: "fixture" }
            }
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => {
            const modules = {
              "fixture-state": `export const state = { allowed: true, gates: [], writes: [], refreshes: [], failure: false, missing: false };`,
              "@/lib/admin/auth": `import {state} from "fixture-state"; export async function requireAdminAction() {
              state.gates.push("admin"); if (!state.allowed) throw new Error("Admin access required");
            }`,
              "@/lib/admin/service-role": `import {state} from "fixture-state"; export async function createAdminServiceRoleClient() {
              state.gates.push("service-role"); return { from(table) { return { update(values) { return { eq(column, id) {
                state.writes.push({table, values, column, id}); return { select() { return { async single() {
                  return {data: state.missing ? null : {id}, error: state.failure ? {message: "private detail"} : null};
                } } } };
              } } } } } };
            }`,
              "@/lib/supabase/server": `import {state} from "fixture-state"; export async function createSupabaseServerClient() {
              state.gates.push("session"); return { async rpc(name, args) {
                state.writes.push({name, args}); return {error: state.failure ? {message: "private detail"} : null};
              } };
            }`,
              "next/cache":
                'import {state} from "fixture-state"; export function revalidatePath(path) {state.refreshes.push(path)}',
              "@/lib/cache/tags": `import {state} from "fixture-state";
              export function revalidateMerchantCacheTags(id) {state.refreshes.push("merchant:" + id)}
              export function qrImageContextCacheTag() {} export function revalidateCacheTag() {}`,
              "@/lib/admin/data-export":
                "export function buildExportDownload() {}",
              "@/lib/customer/consent":
                'export const MARKETING_POLICY_VERSION = "test";',
            }
            assert.ok(path in modules, `Unrecognised boundary: ${path}`)
            return { contents: modules[path] }
          })
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}

function form(fields = {}) {
  const data = new FormData()
  data.set("merchantId", MERCHANT_ID)
  for (const [key, value] of Object.entries(fields)) data.set(key, value)
  return data
}

const ACTIONS = [
  "setCustomerMessagingEnabledAction",
  "suspendMerchantAction",
  "reinstateMerchantAction",
]

test("Given an unauthorised caller When any merchant control is invoked Then no data client or write is reached", async () => {
  for (const action of ACTIONS) {
    const controls = await loadControls()
    controls.state.allowed = false
    await assert.rejects(
      controls[action](
        {},
        form({ enabled: "true", reason: "Review required" })
      ),
      /Admin access required/
    )
    assert.deepEqual(controls.state.gates, ["admin"])
    assert.deepEqual(controls.state.writes, [])
  }
})

test("Given malformed control fields When submitted Then errors return before a client or mutation is created", async () => {
  for (const [action, fields] of [
    ["setCustomerMessagingEnabledAction", {}],
    ["setCustomerMessagingEnabledAction", { enabled: "on" }],
    ["suspendMerchantAction", { reason: "abc" }],
    ["suspendMerchantAction", { reason: "x".repeat(501) }],
    ...ACTIONS.map((action) => [
      action,
      { merchantId: "forged", enabled: "true", reason: "Review required" },
    ]),
  ]) {
    const controls = await loadControls()
    assert.equal((await controls[action]({}, form(fields))).status, "error")
    assert.deepEqual(controls.state.gates, ["admin"])
    assert.deepEqual(controls.state.writes, [])
    assert.deepEqual(controls.state.refreshes, [])
  }
})

test("Given an admin messaging change When enabled or disabled Then only that merchant field is updated and its surfaces refresh", async () => {
  for (const enabled of [true, false]) {
    const controls = await loadControls()
    assert.equal(
      (
        await controls.setCustomerMessagingEnabledAction(
          {},
          form({ enabled: String(enabled) })
        )
      ).status,
      "success"
    )
    assert.deepEqual(controls.state.gates, ["admin", "service-role"])
    assert.deepEqual(controls.state.writes, [
      {
        table: "merchants",
        values: { customer_messaging_enabled: enabled },
        column: "id",
        id: MERCHANT_ID,
      },
    ])
    assert.deepEqual(controls.state.refreshes, [
      `merchant:${MERCHANT_ID}`,
      "/admin/merchants",
      "/admin/audit",
      "/app",
      "/home",
    ])
  }
})

test("Given suspension and reinstatement When submitted Then the session RPC receives only its validated arguments", async () => {
  for (const [action, name, args] of [
    [
      "suspendMerchantAction",
      "admin_suspend_merchant",
      { p_merchant_id: MERCHANT_ID, p_reason: "Review required" },
    ],
    [
      "reinstateMerchantAction",
      "admin_reinstate_merchant",
      { p_merchant_id: MERCHANT_ID },
    ],
  ]) {
    const controls = await loadControls()
    assert.equal(
      (await controls[action]({}, form({ reason: " Review required " })))
        .status,
      "success"
    )
    assert.deepEqual(controls.state.gates, ["admin", "session"])
    assert.deepEqual(controls.state.writes, [{ name, args }])
    assert.ok(controls.state.refreshes.includes("/admin/audit"))
  }
})

test("Given database failure or a missing merchant When a control is submitted Then no success, private detail or refresh is returned", async () => {
  for (const action of ACTIONS) {
    const controls = await loadControls()
    controls.state.failure = true
    const result = await controls[action](
      {},
      form({ enabled: "true", reason: "Review required" })
    )
    assert.equal(result.status, "error")
    assert.doesNotMatch(result.message, /private detail/)
    assert.deepEqual(controls.state.refreshes, [])
  }
  const controls = await loadControls()
  controls.state.missing = true
  assert.equal(
    (
      await controls.setCustomerMessagingEnabledAction(
        {},
        form({ enabled: "true" })
      )
    ).status,
    "error"
  )
  assert.deepEqual(controls.state.refreshes, [])
})
