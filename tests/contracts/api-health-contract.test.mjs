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

test("Given the public health endpoint is liveness-only When its response contract is inspected Then it says so and avoids cache", () => {
  const healthRoute = readProjectFile("app", "api", "health", "route.ts")

  assert.match(healthRoute, /scope: "liveness"/)
  assert.match(healthRoute, /"cache-control": "no-store, max-age=0"/)
  assert.match(healthRoute, /\[REQUEST_ID_HEADER\]: requestId/)
  assert.doesNotMatch(healthRoute, /from "@\/lib\/supabase/)
  assert.doesNotMatch(healthRoute, /from "@\/lib\/stripe/)
  assert.doesNotMatch(healthRoute, /from "@\/lib\/notifications/)
})
