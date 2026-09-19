import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { relative, resolve } from "node:path"
import { test } from "node:test"

const projectRoot = resolve(import.meta.dirname, "../..")

test("customer phone decryption is contained to the messaging address resolver", () => {
  const importers = ["app", "lib"]
    .flatMap((directory) => sourceFiles(resolve(projectRoot, directory)))
    .filter((file) =>
      readFileSync(resolve(projectRoot, file), "utf8").includes(
        "decryptCustomerPhone"
      )
    )

  assert.deepEqual(
    importers
      .map((file) => relative(projectRoot, resolve(projectRoot, file)))
      .sort(),
    [
      "lib/customer/phone-pii-core.ts",
      "lib/customer/phone-pii.ts",
      "lib/notifications/customer-messaging-address.ts",
    ]
  )
})

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(?:ts|tsx)$/.test(entry.name) ? [relative(projectRoot, path)] : []
  })
}
