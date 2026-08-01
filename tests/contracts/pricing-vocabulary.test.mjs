import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

// Task 5 widens this to the whole module once every file exists. It stays scoped
// to the files that exist RIGHT NOW so the suite is never committed red:
// pnpm quality:fast runs contracts, and a red contract would block Tasks 2-4.
const PRICING_MODULE = ["components/marketing/pricing/price-lockup.tsx"]

test("the pricing vocabulary stays server-rendered", () => {
  for (const path of PRICING_MODULE) {
    assert.doesNotMatch(
      read(path),
      /"use client"/,
      `${path} must stay a server component`
    )
  }
})

test("the pricing vocabulary never hard-codes a price", () => {
  for (const path of PRICING_MODULE) {
    assert.doesNotMatch(
      read(path),
      /£\d/,
      `${path} must render figures from facts, not literals`
    )
  }
})

test("PriceLockup keeps the inline variant contiguous for merchant exact-text specs", () => {
  const source = read("components/marketing/pricing/price-lockup.tsx")
  // The inline branch must join amount and cadence into one string expression,
  // never two sibling elements — merchant e2e asserts exact single text nodes.
  assert.match(source, /size === "inline"/)
  assert.match(source, /\{`£\$\{amount\} \$\{cadence\}`\}/)
})
