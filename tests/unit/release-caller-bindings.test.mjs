import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const deployment = readFileSync(
  ".github/workflows/production-deploy.yml",
  "utf8"
)
const database = readFileSync(
  ".github/workflows/production-database.yml",
  "utf8"
)

test("deployment caller passes exactly the five declared protected credentials", () => {
  const used = [
    ...new Set(
      [...deployment.matchAll(/secrets\.([A-Z_]+)/g)].map((match) => match[1])
    ),
  ].sort()
  const declared = deployment
    .split("    secrets:\n")[1]
    .split("    inputs:\n")[0]
  const passed = database
    .split("    uses: ./.github/workflows/production-deploy.yml\n")[1]
    .split("    permissions:\n")[0]
  assert.equal(used.length, 5)
  assert.deepEqual(
    [...declared.matchAll(/^      ([A-Z_]+):/gm)]
      .map((match) => match[1])
      .sort(),
    used
  )
  assert.deepEqual(
    [...passed.matchAll(/^      ([A-Z_]+):/gm)].map((match) => match[1]).sort(),
    used
  )
  for (const key of used) {
    assert.ok(declared.includes(`${key}:\n        required: true`))
    assert.ok(passed.includes(`${key}: \${{ secrets.${key} }}`))
  }
  assert.doesNotMatch(passed, /inherit/)
  assert.match(deployment, /environment: Production/)
})
