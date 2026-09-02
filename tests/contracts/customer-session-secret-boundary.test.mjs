import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import test from "node:test"

const root = new URL("../../", import.meta.url)

test("server startup validates the customer session secret before logging", () => {
  const instrumentation = readFileSync(
    new URL("instrumentation.ts", root),
    "utf8"
  )
  assert.ok(
    instrumentation.indexOf("requiredCustomerSessionSecret()") <
      instrumentation.indexOf('logger.info("server.start"')
  )
})

test("runtime consumers cannot bypass the shared secret resolver", () => {
  const offenders = []
  for (const directory of ["app", "lib"]) {
    for (const file of files(new URL(`${directory}/`, root))) {
      if (!/\.(?:ts|tsx)$/.test(file.pathname)) continue
      const source = readFileSync(file, "utf8")
      if (
        /process\.env\.CUSTOMER_SESSION_SECRET|process\.env\[[^\]]*CUSTOMER_SESSION_SECRET/.test(
          source
        ) &&
        !file.pathname.endsWith("/lib/security/customer-session-secret.ts")
      ) {
        offenders.push(file.pathname)
      }
    }
  }
  assert.deepEqual(offenders, [])
})

function* files(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = new URL(
      entry.name + (entry.isDirectory() ? "/" : ""),
      directory
    )
    if (entry.isDirectory()) yield* files(child)
    else if (statSync(child).isFile()) yield child
  }
}
