import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import test from "node:test"

const packageJson = JSON.parse(
  readFileSync(new URL("../../package.json", import.meta.url), "utf8")
)

test("the DB test tier runs a target preflight before test discovery", () => {
  assert.match(
    packageJson.scripts["test:db"],
    /--import \.\/tests\/db\/helpers\/db-preflight\.mjs/
  )
})

test("every direct PostgreSQL test client imports guarded URL resolution", () => {
  const dbDirectory = new URL("../db/", import.meta.url)
  const directClients = readdirSync(dbDirectory)
    .filter((file) => file.endsWith(".test.mjs"))
    .filter((file) =>
      readFileSync(new URL(file, dbDirectory), "utf8").includes(
        'from "postgres"'
      )
    )

  assert.ok(directClients.length > 0)
  for (const file of directClients) {
    const source = readFileSync(new URL(file, dbDirectory), "utf8")
    assert.match(
      source,
      /from "\.\/helpers\/db(?:-target)?\.mjs"/,
      `${file} must resolve its target through the loopback guard`
    )
  }
})
