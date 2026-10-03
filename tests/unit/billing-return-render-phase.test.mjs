import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { test } from "node:test"
import { pathToFileURL } from "node:url"
import { build } from "esbuild"
import "next/dist/server/node-environment-baseline.js"
import { AfterContext } from "next/dist/server/after/after-context.js"
import { workAsyncStorage } from "next/dist/server/app-render/work-async-storage.external.js"
import { workUnitAsyncStorage } from "next/dist/server/app-render/work-unit-async-storage.external.js"

async function loadWorkflow(outcome) {
  const root = process.cwd()
  const boundaries = {
    "server-only": "",
    "@/lib/analytics/merchant-billing-events":
      "export function scheduleMerchantBillingCheckoutReturned() {}",
    "@/lib/merchant/ensure-join-qr":
      "export async function autoProvisionJoinQrFromSetup() {}",
    "@/lib/stripe/checkout": `
      export async function createBillingCheckoutDependencies() { return {} }
      export async function confirmBillingCheckoutReturn() { return ${JSON.stringify(outcome)} }
      export async function reconcileBillingPortalReturn() { return ${JSON.stringify(outcome)} }
    `,
  }
  const result = await build({
    entryPoints: [path.join(root, "lib/merchant/billing-checkout-return.ts")],
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "billing-return-provider-boundaries",
        setup(builder) {
          builder.onResolve({ filter: /^(server-only|@\/)/ }, ({ path: id }) =>
            id in boundaries ? { path: id, namespace: "fixture" } : undefined
          )
          builder.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({
              contents: boundaries[id],
              loader: "js",
            })
          )
          builder.onResolve({ filter: /^next\// }, ({ path: id }) => ({
            path: pathToFileURL(path.join(root, "node_modules", `${id}.js`))
              .href,
            external: true,
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

async function renderReturn(workflow) {
  const pending = []
  const closeCallbacks = []
  const invalidations = []
  const afterErrors = []
  const requestStore = { type: "request", phase: "render" }
  const afterContext = new AfterContext({
    waitUntil: (promise) => pending.push(promise),
    onClose: (callback) => closeCallbacks.push(callback),
    onTaskError: (error) => afterErrors.push(error),
  })
  const workStore = {
    page: "/app/launch/page",
    route: "/app/launch",
    afterContext,
    incrementalCache: {
      async revalidateTag(tags) {
        invalidations.push(...tags)
      },
    },
    cacheLifeProfiles: {
      max: { stale: 300, revalidate: 900, expire: 31536000 },
    },
  }
  const outcome = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, workflow)
  )
  assert.deepEqual(invalidations, [], "render must not invalidate the cache")
  for (const callback of closeCallbacks) callback()
  await Promise.all(pending)
  assert.deepEqual(afterErrors, [], "post-response invalidation must complete")
  return { outcome, invalidations }
}

for (const source of ["checkout", "portal"]) {
  test(`confirmed ${source} return renders before Next cache invalidation`, async () => {
    // Given a verified provider outcome in Next's actual render request context.
    const expected = { kind: "confirmed", source, status: "trialing" }
    const billingReturn = await loadWorkflow(expected)
    const workflow =
      source === "checkout"
        ? () =>
            billingReturn.completeBillingCheckoutReturn(
              "owned-merchant",
              "owned-session"
            )
        : () => billingReturn.completeBillingPortalReturn("owned-merchant")
    // When the return orchestration executes during page rendering.
    const result = await renderReturn(workflow)
    // Then rendering succeeds and Next applies invalidation after response close.
    assert.deepEqual(result.outcome, expected)
    assert.ok(result.invalidations.includes("merchant:owned-merchant"))
    assert.ok(result.invalidations.includes("_N_T_/app/launch"))
  })
}

test("catching-up checkout return schedules no cache invalidation", async () => {
  // Given the provider has not confirmed the checkout.
  const billingReturn = await loadWorkflow({ kind: "catching_up" })
  // When the pending return renders.
  const result = await renderReturn(() =>
    billingReturn.completeBillingCheckoutReturn(
      "owned-merchant",
      "owned-session"
    )
  )
  // Then the pending outcome remains truthful and no invalidation runs.
  assert.deepEqual(result.outcome, { kind: "catching_up" })
  assert.deepEqual(result.invalidations, [])
})
