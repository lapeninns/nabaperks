import assert from "node:assert/strict"
import { randomBytes } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { afterEach, beforeEach, test } from "node:test"
import { build } from "esbuild"

import { customerEmailAuthMode } from "@/lib/customer/email-auth-mode"

/**
 * QA BUG-015 and BUG-016: the runtime environment read (`getServerEnv`, which
 * every service-role client runs first) must not fail for an email sign-in
 * setting the parser already handles safely. An unrecognised
 * CUSTOMER_EMAIL_AUTH_MODE (for example `FULL`) resolves to `off` at runtime;
 * the deploy gate (scripts/check-env.mjs) still rejects it. Before the fix,
 * `getServerEnv()` threw EnvConfigError, which took down phone sign-in, join,
 * the QR router, /home and reward QR while /api/health stayed 200.
 */

const root = process.cwd()
const contract = JSON.parse(
  readFileSync(path.join(root, "config/env-contract.json"), "utf8")
)
const saved = new Map()

async function loadServerEnv() {
  const logs = []
  globalThis.__serverEnvLogs = logs
  const result = await build({
    stdin: {
      contents: 'export { getServerEnv } from "./lib/env/server.ts"',
      resolveDir: root,
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    plugins: [
      {
        name: "server-env-boundaries",
        setup(build) {
          build.onResolve({ filter: /^server-only$/ }, () => ({
            path: "server-only",
            namespace: "stub",
          }))
          build.onResolve(
            { filter: /^@\/lib\/observability\/logger$/ },
            () => ({
              path: "logger",
              namespace: "stub",
            })
          )
          build.onResolve({ filter: /^@\// }, ({ path: specifier }) => {
            const base = path.join(root, specifier.slice(2))
            for (const ext of ["", ".ts", ".json"]) {
              try {
                readFileSync(base + ext)
                return { path: base + ext }
              } catch {
                // try the next extension
              }
            }
            return undefined
          })
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path: id }) => ({
            contents:
              id === "logger"
                ? `const log = (level) => (message, context) => globalThis.__serverEnvLogs.push({ level, message, context });
                   export const logger = { info: log("info"), warn: log("warn"), error: log("error") }`
                : "",
          }))
        },
      },
    ],
  })
  const mod = await import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
  return { getServerEnv: mod.getServerEnv, logs }
}

function secret() {
  return randomBytes(36).toString("base64url")
}

beforeEach(() => {
  for (const entry of contract) {
    saved.set(entry.name, process.env[entry.name])
    delete process.env[entry.name]
    if (entry.optional) continue
    process.env[entry.name] =
      entry.kind === "url" ? "http://127.0.0.1:3000" : secret()
  }
})

afterEach(() => {
  for (const [name, value] of saved) {
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  saved.clear()
})

test("Given CUSTOMER_EMAIL_AUTH_MODE=FULL When the server env is read Then it does not throw and email sign-in resolves to off", async () => {
  const { getServerEnv, logs } = await loadServerEnv()
  for (const raw of ["FULL", "Full", "on", "full,existing", "full​"]) {
    process.env.CUSTOMER_EMAIL_AUTH_MODE = raw
    assert.doesNotThrow(() => getServerEnv(), raw)
    assert.equal(customerEmailAuthMode(process.env), "off", raw)
  }
  // One structured warning for the process, naming the setting, never the value.
  const warnings = logs.filter(
    (log) => log.message === "config.invalid_email_auth_mode"
  )
  assert.equal(warnings.length, 1)
  assert.deepEqual(warnings[0].context, {
    name: "CUSTOMER_EMAIL_AUTH_MODE",
    resolvedMode: "off",
  })
})

test("Given email sign-in on without CUSTOMER_EMAIL_HMAC_SECRET When the server env is read Then service-role paths keep working", async () => {
  const { getServerEnv } = await loadServerEnv()
  for (const mode of ["existing", "full"]) {
    process.env.CUSTOMER_EMAIL_AUTH_MODE = mode
    delete process.env.CUSTOMER_EMAIL_HMAC_SECRET
    assert.doesNotThrow(() => getServerEnv(), mode)
  }
})

test("Given a valid mode When the server env is read Then nothing is warned", async () => {
  const { getServerEnv, logs } = await loadServerEnv()
  for (const mode of [undefined, "", "off", "existing", " full "]) {
    if (mode === undefined) delete process.env.CUSTOMER_EMAIL_AUTH_MODE
    else process.env.CUSTOMER_EMAIL_AUTH_MODE = mode
    assert.doesNotThrow(() => getServerEnv())
  }
  assert.deepEqual(logs, [])
})
