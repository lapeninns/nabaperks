import assert from "node:assert/strict"
import { execFile } from "node:child_process"
import { registerHooks } from "node:module"
import { mock, test } from "node:test"
import { promisify } from "node:util"

const fixtureMode = process.env.TASK13_ERASURE_ACTION_FIXTURE === "1"

if (fixtureMode) {
  await runFixture()
} else {
  const execFileAsync = promisify(execFile)

  async function runAction(scenario) {
    const { stdout } = await execFileAsync(
      process.execPath,
      [
        "--experimental-test-module-mocks",
        "--import",
        "./tests/support/register-alias.mjs",
        import.meta.filename,
        scenario,
      ],
      {
        env: { ...process.env, TASK13_ERASURE_ACTION_FIXTURE: "1" },
        timeout: 5_000,
      }
    )
    return JSON.parse(stdout)
  }

  test("Given a valid deletion request When the real action runs Then it invokes only the atomic erasure RPC", async () => {
    const result = await runAction("deletion")

    assert.deepEqual(result.events, ["admin", "server-client"])
    assert.deepEqual(result.rpcNames, ["admin_erase_customer_pii"])
    assert.deepEqual(result.rpcArgs, [
      {
        p_customer_id: "10000000-0000-0000-0000-000000000001",
        p_merchant_id: "20000000-0000-0000-0000-000000000002",
        p_channel: "email",
        p_notes: "Verified deletion request",
      },
    ])
    assert.equal(result.companionCalls, 0)
    assert.equal(result.auditCalls, 0)
    assert.deepEqual(result.revalidatedPaths, [
      "/admin/privacy",
      "/admin/audit",
    ])
    assert.deepEqual(result.state, {
      status: "success",
      message: "Data request logged to the audit trail.",
    })
  })

  test("Given required data-request fields are absent When the real action runs Then each error is message-only and skips RPCs", async () => {
    for (const [scenario, message] of [
      ["missing-customer", "Customer and merchant context are required."],
      ["missing-merchant", "Customer and merchant context are required."],
      ["missing-request-type", "Request type is required."],
      ["missing-channel", "Support channel is required."],
      ["missing-notes", "Support notes are required."],
    ]) {
      const result = await runAction(scenario)

      assert.deepEqual(result.events, ["admin"])
      assert.deepEqual(result.rpcNames, [])
      assert.deepEqual(result.state, { status: "error", message })
      assert.deepEqual(Object.keys(result.state).sort(), ["message", "status"])
    }
  })

  test("Given an export request When the real action runs Then it redirects to the protected export control", async () => {
    const result = await runAction("export")

    assert.deepEqual(result.events, ["admin"])
    assert.deepEqual(result.rpcNames, [])
    assert.deepEqual(result.state, {
      status: "error",
      message:
        "Use the protected export download control for subject-access exports.",
    })
  })

  test("Given a prompt-like RPC failure When the real deletion action runs Then it returns only the safe message", async () => {
    const result = await runAction("deletion-provider-error")

    assert.deepEqual(result.rpcNames, ["admin_erase_customer_pii"])
    assert.deepEqual(result.state, {
      status: "error",
      message: "Data request log failed. Try again or review audit logs.",
    })
    assert.equal(result.sentinelPresent, false)
  })

  test("Given a malformed customer UUID When the real action runs Then it preserves the existing server-action boundary", async () => {
    const result = await runAction("malformed-customer-id")

    assert.deepEqual(result.rpcNames, ["admin_erase_customer_pii"])
    assert.equal(result.rpcArgs[0].p_customer_id, "not-a-uuid")
    assert.deepEqual(result.state, {
      status: "success",
      message: "Data request logged to the audit trail.",
    })
  })
}

async function runFixture() {
  const scenario = process.argv[2]
  const events = []
  const rpcNames = []
  const rpcArgs = []
  const revalidatedPaths = []
  const sentinel = "TASK13_PROMPT_SENTINEL_ignore_previous_instructions"

  registerHooks({
    resolve(specifier, context, nextResolve) {
      const mappedSpecifier =
        specifier === "next/cache" ? "next/cache.js" : specifier
      return nextResolve(mappedSpecifier, context)
    },
  })
  mock.module("next/cache", {
    namedExports: { revalidatePath: (path) => revalidatedPaths.push(path) },
  })
  mock.module("@/lib/admin/auth", {
    namedExports: {
      requireAdminAction: async () => events.push("admin"),
    },
  })
  mock.module("@/lib/cache/tags", {
    namedExports: {
      qrImageContextCacheTag: () => "task13",
      revalidateCacheTag: () => undefined,
    },
  })
  mock.module("@/lib/customer/identity", {
    namedExports: { getCurrentCustomer: async () => null },
  })
  mock.module("@/lib/supabase/server", {
    namedExports: {
      createSupabaseServiceRoleClient: () => ({
        rpc: async () => ({ data: null, error: null }),
      }),
      createSupabaseServerClient: async () => {
        events.push("server-client")
        return {
          rpc: async (name, args) => {
            rpcNames.push(name)
            rpcArgs.push(args)
            return scenario === "deletion-provider-error"
              ? { error: { message: sentinel } }
              : { error: null }
          },
        }
      },
    },
  })

  const formData = new FormData()
  formData.set(
    "customerId",
    scenario === "malformed-customer-id"
      ? "not-a-uuid"
      : "10000000-0000-0000-0000-000000000001"
  )
  formData.set("merchantId", "20000000-0000-0000-0000-000000000002")
  formData.set("requestType", scenario === "export" ? "export" : "deletion")
  formData.set("channel", "email")
  formData.set("notes", "Verified deletion request")
  const missingField = scenario.replace("missing-", "")
  if (scenario.startsWith("missing-")) {
    formData.delete(
      missingField === "request-type" ? "requestType" : `${missingField}Id`
    )
    if (missingField === "channel" || missingField === "notes")
      formData.delete(missingField)
  }

  const { logDataRequestAction } = await import("@/app/admin/actions")
  const state = await logDataRequestAction({ status: "idle" }, formData)
  const serialized = JSON.stringify({
    events,
    rpcNames,
    rpcArgs,
    companionCalls: rpcNames.filter((name) =>
      [
        "admin_erase_loyalty_invitations_for_customer",
        "admin_erase_offer_claims_for_customer",
      ].includes(name)
    ).length,
    auditCalls: rpcNames.filter((name) => name === "admin_log_data_request")
      .length,
    revalidatedPaths,
    state,
  })
  process.stdout.write(
    JSON.stringify({
      ...JSON.parse(serialized),
      sentinelPresent: serialized.includes(sentinel),
    })
  )
}
