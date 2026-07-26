import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"

const projectRoot = process.cwd()
const BANNED = [/Nab a Perks/, /NAB A PERKS/, /NABAPERKS/]

test("no print catalogue carries a non-canonical lockup", () => {
  const configDir = path.join(projectRoot, "config")
  const catalogues = readdirSync(configDir).filter((name) =>
    /(poster|table-tent|nfc-card|nfc-square)-designs\.json$/.test(name)
  )
  assert.equal(catalogues.length, 4)
  for (const name of catalogues) {
    const source = readFileSync(path.join(configDir, name), "utf8")
    for (const pattern of BANNED) {
      assert.doesNotMatch(source, pattern, `${name} carries ${pattern}`)
    }
  }
})

test("the PDF wordmark spells the canonical brand", () => {
  const source = readFileSync(
    path.join(projectRoot, "lib", "qr", "poster-brand.ts"),
    "utf8"
  )
  const lead = /lead:\s*"([^"]*)"/.exec(source)
  const accent = /accent:\s*"([^"]*)"/.exec(source)
  const tail = /tail:\s*"([^"]*)"/.exec(source)
  assert.ok(lead && accent && tail, "wordmark segments are declared")
  assert.equal(`${lead[1]}${accent[1]}${tail[1]}`, "Nabaperks")
})

test("renderers hold no second, inline wordmark literal", () => {
  // drawKitWordmark previously carried its own title-case lockup, so fixing
  // poster-brand.ts alone left the tents spelling "Nab a Perks".
  const source = readFileSync(
    path.join(projectRoot, "lib", "notifications", "poster-pdf-kit-brand.ts"),
    "utf8"
  )
  assert.doesNotMatch(source, /"Nab /, "no inline lead segment")
  assert.doesNotMatch(source, /" Perks"/, "no inline tail segment")
})
