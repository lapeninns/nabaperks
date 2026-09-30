import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * Test mobiles that can reach a running app stay behind the guarded helper
 * (QA BUG-052).
 *
 * The app's phone parser rejects Ofcom's drama range (07700 900xxx), so live
 * journeys type numbers from the allocatable 074 range. Those are real
 * subscribers' numbers: the dev server logs Server Function arguments, and a
 * run against a provider-enabled server could text them. Only
 * `disposableUkMobile()` in tests/e2e/helpers/customer-join-live-db.ts may
 * build one, because it refuses unless the local dev code is honoured and every
 * Twilio setting is a synthetic placeholder (disposable-phone-guard.ts).
 *
 * This contract fails when any other test file builds a UK mobile dynamically
 * (a `07…`/`+447…` prefix joined to generated digits), or when a browser spec
 * or helper types a literal real-range mobile outside the drama range.
 */

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const GUARDED_HELPER = "tests/e2e/helpers/customer-join-live-db.ts"

/**
 * In-memory property inputs for pure functions (HMAC and cookie codecs). They
 * never reach a server, a provider or a log, so they need no guard.
 */
const PURE_PROPERTY_INPUTS = new Map([
  [
    "tests/unit/phone-pii.property.test.mjs",
    "HMAC/encryption property inputs; no server, provider or log",
  ],
  [
    "tests/unit/session-cookie-core.property.test.mjs",
    "cookie codec property inputs; no server, provider or log",
  ],
])

const SOURCE_EXTENSIONS = /\.(?:[cm]?[jt]s|tsx)$/

/** A `07…`, `447…` or `+447…` prefix joined to generated digits. */
const DYNAMIC_MOBILE = [
  // `074${digits}` or `+4474${digits}`
  /`(?:\+?44|0)7\d*\$\{/,
  // "074" + digits
  /["'](?:\+?44|0)7\d*["']\s*\+/,
]

/** A literal UK mobile, national or E.164, with optional spaces. */
const LITERAL_MOBILE = /(?:\+44\s?|(?<![\d+])0)7\d{3}\s?\d{3}\s?\d{3}(?!\d)/g
const DRAMA_RANGE = /^(?:\+44|0)7700900\d{3}$/

function testFiles(dir) {
  const files = []
  for (const entry of readdirSync(path.join(root, dir), {
    withFileTypes: true,
  })) {
    const relative = `${dir}/${entry.name}`
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue
      files.push(...testFiles(relative))
    } else if (SOURCE_EXTENSIONS.test(entry.name)) {
      files.push(relative)
    }
  }
  return files
}

function dynamicMobileLines(source) {
  return source
    .split("\n")
    .map((line, index) => ({ line: line.trim(), number: index + 1 }))
    .filter(({ line }) => DYNAMIC_MOBILE.some((pattern) => pattern.test(line)))
}

function realRangeLiterals(source) {
  return [...source.matchAll(LITERAL_MOBILE)]
    .map((match) => match[0])
    .filter((value) => !DRAMA_RANGE.test(value.replace(/\s/g, "")))
}

test("the detectors recognise the generator shapes this contract forbids", () => {
  const flagged = [
    "const n = `074${String(Math.random()).slice(2, 10)}`",
    "const n = `+4474${digits}`",
    'const n = "07" + digits',
  ]
  for (const line of flagged) {
    assert.equal(dynamicMobileLines(line).length, 1, line)
  }
  assert.deepEqual(realRangeLiterals('return "07911123456"'), ["07911123456"])
  assert.deepEqual(realRangeLiterals('fill("07400 123456")'), ["07400 123456"])
  assert.deepEqual(realRangeLiterals('fill("07700900123")'), [])
  assert.deepEqual(realRangeLiterals('"+447700900000"'), [])
})

test("no test file builds a UK mobile outside disposableUkMobile()", () => {
  const offenders = []
  for (const file of testFiles("tests")) {
    if (file === GUARDED_HELPER || file.startsWith("tests/contracts/")) continue
    if (PURE_PROPERTY_INPUTS.has(file)) continue
    const source = readFileSync(path.join(root, file), "utf8")
    for (const { line, number } of dynamicMobileLines(source)) {
      offenders.push(`${file}:${number} ${line}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "generate test mobiles with disposableUkMobile() from " +
      `${GUARDED_HELPER}, which refuses unless nothing can text them`
  )
})

test("browser specs type no literal real-range mobile outside the guarded helper", () => {
  const offenders = []
  for (const file of testFiles("tests/e2e")) {
    if (file === GUARDED_HELPER) continue
    const source = readFileSync(path.join(root, file), "utf8")
    for (const value of realRangeLiterals(source)) {
      offenders.push(`${file}: ${value}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    "use the drama range (07700 900xxx) for DB-free fixtures, or " +
      "disposableUkMobile() for a journey the app must accept"
  )
})

test("the exempt property inputs still exist and never reach an app", () => {
  for (const [file] of PURE_PROPERTY_INPUTS) {
    const source = readFileSync(path.join(root, file), "utf8")
    assert.doesNotMatch(
      source,
      /@playwright\/test|fetch\(|from ["']postgres["']/,
      `${file} stays a pure in-memory property test`
    )
  }
})

test("the guarded helper still refuses before it generates a number", () => {
  const helper = readFileSync(path.join(root, GUARDED_HELPER), "utf8")
  const body = helper.slice(
    helper.indexOf("export function disposableUkMobile")
  )
  const guard = body.indexOf("assertDisposablePhoneSafe(env)")
  const generator = body.indexOf("`074${")
  assert.ok(guard > 0, "disposableUkMobile calls the guard")
  assert.ok(generator > guard, "the guard runs before any number is built")
})
