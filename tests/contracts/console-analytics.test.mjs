import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
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

function walk(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry)) out.push(full)
  }
  return out
}

const CONSOLE_EVENTS = [
  "console_tab_selected",
  "counter_qr_presented",
  "counter_qr_present_closed",
  "team_code_revealed",
  "team_code_reset_confirmed",
  "team_code_reset_cancelled",
  "numbers_range_changed",
  "numbers_day_selected",
  "numbers_metric_opened",
  "activity_group_expanded",
  "activity_filter_changed",
]

test("Given the console interaction events When the vocabulary is read Then each is registered in both the contract and the product event list", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")
  const contract = readProjectFile("lib", "analytics", "console-contract.ts")

  for (const name of CONSOLE_EVENTS) {
    assert.match(events, new RegExp(`"${name}"`), `${name} in events.ts`)
    assert.match(contract, new RegExp(`"${name}"`), `${name} in contract`)
  }
})

test("Given console client components When they report an interaction Then they cross through the validated server action, never PostHog directly", () => {
  const action = readProjectFile("app", "app", "console-events.ts")
  assert.match(action, /^"use server"/)
  assert.match(action, /parseConsoleEvent\(input\)/)
  assert.match(action, /capturePostHogEvent\(/)
  assert.match(action, /getCurrentMerchant\(\)/)

  const clientFiles = [
    ...walk(path.join(projectRoot, "components", "layout")),
    ...walk(path.join(projectRoot, "components", "merchant")),
    ...walk(path.join(projectRoot, "components", "data")),
  ].filter((file) => readFileSync(file, "utf8").startsWith('"use client"'))

  for (const file of clientFiles) {
    const source = readFileSync(file, "utf8")
    assert.doesNotMatch(source, /posthog/i, path.relative(projectRoot, file))
    assert.doesNotMatch(
      source,
      /capturePostHogEvent|recordProductEvent/,
      path.relative(projectRoot, file)
    )
  }
})
