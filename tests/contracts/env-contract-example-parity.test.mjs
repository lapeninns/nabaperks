import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { test } from "node:test"

/**
 * Environment contract ↔ .env.example parity.
 *
 * AGENTS.md treats `.env.example` and `config/env-contract.json` as a
 * synchronized pair, but per-var contract tests only assert the handful of
 * secrets a given feature added. That let two optional, call-time-enforced
 * secrets (CUSTOMER_EMAIL_HMAC_SECRET, MERCHANT_OTP_ALIAS_TOKEN_ENCRYPTION_KEY)
 * land in the contract while missing from the template — so a fresh `.env.local`
 * copied from the template silently lacked them and the affected feature failed
 * at call time. This closes the whole class: every contract variable must have a
 * `NAME=` line in the template.
 */

const root = fileURLToPath(new URL("../..", import.meta.url))
const read = (relative) => readFileSync(`${root}/${relative}`, "utf8")

const contract = JSON.parse(read("config/env-contract.json"))
const contractVariables = Array.isArray(contract)
  ? contract
  : (contract.variables ?? contract.vars ?? contract.entries ?? [])

const exampleKeys = new Set(
  [...read(".env.example").matchAll(/^([A-Z0-9_]+)=/gm)].map((m) => m[1])
)

test("every env-contract variable is declared in .env.example", () => {
  assert.ok(
    contractVariables.length > 0,
    "expected config/env-contract.json to declare variables"
  )

  const missing = contractVariables
    .map((entry) => entry.name)
    .filter((name) => name && !exampleKeys.has(name))

  assert.deepEqual(
    missing,
    [],
    `config/env-contract.json variables missing a NAME= line in .env.example: ${missing.join(", ")}`
  )
})
