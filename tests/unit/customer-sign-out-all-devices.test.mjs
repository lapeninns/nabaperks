import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { build } from "esbuild"

/**
 * "Log out on all devices" (QA BUG-012 follow-up). `clearAllCustomerSessions`
 * says which sessions it actually ended; when only this browser could be
 * signed out (`this_device`, the app running ahead of the revoke-all
 * migration), the login page must be told so instead of implying every
 * device was signed out.
 *
 * `app/home/actions.ts` is bundled with every import stubbed; each stubbed
 * function answers from `state.impl` and records its call.
 */
const ENTRY = path.join(process.cwd(), "app", "home", "actions.ts")

const SPECIAL = {
  "server-only": "",
  "next/navigation": `export function redirect(destination) {
    const error = new Error("NEXT_REDIRECT"); error.destination = destination; throw error
  }`,
  "@/lib/security/rate-limit": `export class RateLimitError extends Error {}
    export function customerRateLimitIdentityFromHeaders() { return "identity" }
    export function customerDeviceHashFromHeaders() { return "device" }
    export function trustedClientIp() { return "127.0.0.1" }`,
}

const IMPORT_PATTERN = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+"([^"]+)"/g

function importedNames(file) {
  const names = new Map()
  const source = readFileSync(file, "utf8")
  for (const [, list, specifier] of source.matchAll(IMPORT_PATTERN)) {
    const set = names.get(specifier) ?? new Set()
    for (const raw of list.split(",")) {
      const name = raw.trim().split(/\s+as\s+/)[0]
      if (name && !name.startsWith("type ")) set.add(name)
    }
    names.set(specifier, set)
  }
  return names
}

function stubModule(specifier, names) {
  if (specifier in SPECIAL) return SPECIAL[specifier]
  const exports = [...names].map(
    (name) => `export async function ${name}(...args) {
      state.calls.push(${JSON.stringify(name)});
      const impl = state.impl[${JSON.stringify(name)}];
      return typeof impl === "function" ? impl(...args) : impl
    }`
  )
  return `import { state } from "fixture-state";\n${exports.join("\n")}`
}

async function loadHomeActions() {
  const root = process.cwd()
  const names = importedNames(ENTRY)
  const result = await build({
    stdin: {
      contents: `export { signOutAllCustomerDevicesAction } from "./app/home/actions.ts";
        export { state } from "fixture-state";`,
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "home-action-boundaries",
        setup(build) {
          build.onResolve(
            { filter: /^(fixture-state|server-only|next\/|@\/)/ },
            ({ path: specifier }) => ({ path: specifier, namespace: "fixture" })
          )
          build.onLoad(
            { filter: /.*/, namespace: "fixture" },
            ({ path: id }) => ({
              contents:
                id === "fixture-state"
                  ? "export const state = { calls: [], impl: {} };"
                  : stubModule(id, names.get(id) ?? new Set()),
              resolveDir: root,
            })
          )
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${randomUUID()}`
  )
}

async function redirectOf(promise) {
  try {
    await promise
  } catch (error) {
    if (error?.message === "NEXT_REDIRECT") return error.destination
    throw error
  }
  assert.fail("Expected a redirect")
}

test("Given every session was revoked When the customer logs out on all devices Then the login page opens as before", async () => {
  const { signOutAllCustomerDevicesAction, state } = await loadHomeActions()
  state.impl.clearAllCustomerSessions = "all_devices"

  assert.equal(
    await redirectOf(signOutAllCustomerDevicesAction()),
    "/home/login"
  )
  assert.deepEqual(state.calls, ["clearAllCustomerSessions"])
})

test("Given only this browser could be signed out When the customer logs out on all devices Then the login page is told it was this device only", async () => {
  const { signOutAllCustomerDevicesAction, state } = await loadHomeActions()
  state.impl.clearAllCustomerSessions = "this_device"

  assert.equal(
    await redirectOf(signOutAllCustomerDevicesAction()),
    "/home/login?signed_out=this_device"
  )
})
