import assert from "node:assert/strict"
import { test } from "node:test"

import { checkDatabaseReadiness } from "@/lib/observability/readiness"

test("database readiness returns ok only for a successful bounded RLS read", async () => {
  let request
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async (input, init) => {
      request = { input: String(input), init }
      return new Response("[]", { status: 200 })
    },
    supabaseUrl: "https://project.supabase.com",
  })

  assert.deepEqual(result, { database: "ok" })
  assert.match(request.input, /\/rest\/v1\/rpc\/production_readiness_probe$/)
  assert.equal(request.init.method, "POST")
  assert.equal(request.init.body, "{}")
  assert.equal(request.init.headers.apikey, "service-role-test-key")
  assert.equal(request.init.cache, "no-store")
  assert.ok(request.init.signal instanceof AbortSignal)
})

test("database readiness collapses provider failures to a safe public state", async () => {
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async () =>
      new Response("private provider detail", { status: 503 }),
    supabaseUrl: "https://project.supabase.com",
  })

  assert.deepEqual(result, { database: "error" })
  assert.equal(
    JSON.stringify(result).includes("private provider detail"),
    false
  )
})

test("database readiness fails closed before fetch when configuration is absent", async () => {
  let calls = 0
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "",
    fetcher: async () => {
      calls += 1
      return new Response("[]")
    },
    supabaseUrl: "",
  })

  assert.deepEqual(result, { database: "error" })
  assert.equal(calls, 0)
})

test("database readiness collapses timeouts and network errors", async () => {
  const result = await checkDatabaseReadiness({
    serviceRoleKey: "service-role-test-key",
    fetcher: async () => {
      throw new DOMException("timed out with sensitive URL", "TimeoutError")
    },
    supabaseUrl: "https://project.supabase.com",
  })

  assert.deepEqual(result, { database: "error" })
})
