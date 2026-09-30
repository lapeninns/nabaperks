import assert from "node:assert/strict"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * QA BUG-033..035 (38c42a1..2c45031) made CustomerProfileMarketing load the
 * signed-in wallet's eligibility (verified phone, verified email, venues)
 * whenever the caller does not pass it. The /dev harness lanes are DB-free
 * and have no session, so every harness mount must pass a literal
 * `eligibility` and never fall through to that server read.
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return listSourceFiles(fullPath)
    return entry.isFile() && entry.name.endsWith(".tsx") ? [fullPath] : []
  })
}

test("Given a DB-free harness lane When it mounts the profile marketing section Then it passes literal eligibility instead of reading a session", () => {
  const mounts = []
  for (const filePath of listSourceFiles(
    path.join(projectRoot, "app", "dev")
  )) {
    const source = readFileSync(filePath, "utf8")
    for (const match of source.matchAll(/<CustomerProfileMarketing\b[^>]*>/g)) {
      mounts.push({
        file: path.relative(projectRoot, filePath).split(path.sep).join("/"),
        tag: match[0],
      })
    }
  }

  assert.ok(mounts.length > 0, "the profile harness mounts the section")
  for (const { file, tag } of mounts) {
    assert.match(
      tag,
      /eligibility=\{\{[\s\S]*hasVerifiedPhone: (true|false),[\s\S]*hasVerifiedEmail: (true|false),[\s\S]*membershipCount: \d+,?[\s\S]*\}\}/,
      `${file} must pass a literal eligibility`
    )
  }
})
