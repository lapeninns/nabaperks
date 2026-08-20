import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

test("Given a development caller environment When production build starts Then Next receives production NODE_ENV", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"))

  assert.match(
    packageJson.scripts.build,
    /^NODE_ENV=production\s/,
    "the production build command must override an inherited development NODE_ENV"
  )
})
