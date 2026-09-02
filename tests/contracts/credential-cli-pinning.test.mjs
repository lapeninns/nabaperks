import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Supabase and Vercel credential tooling uses pinned provider CLIs", () => {
  const packageJson = JSON.parse(readProjectFile("package.json"))
  const envKeys = readProjectFile("scripts", "env-keys.mjs")

  assert.equal(packageJson.devDependencies.vercel, "56.5.0")
  assert.match(envKeys, /"dlx",\s*"supabase@2\.106\.0"/)
  assert.match(envKeys, /\["exec", "vercel", \.\.\.args\]/)
  assert.doesNotMatch(envKeys, /pnpm dlx supabase(?!@)/)
  assert.doesNotMatch(envKeys, /pnpm dlx vercel/)
  assert.doesNotMatch(envKeys, /"dlx",\s*"supabase"/)
  assert.doesNotMatch(envKeys, /"dlx",\s*"vercel"/)
})
