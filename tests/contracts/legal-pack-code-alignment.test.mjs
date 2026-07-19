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

test("Given the public legal pack When routes are inspected Then each document has canonical metadata and public discovery", () => {
  const routes = [
    ["cookies", "/cookies"],
    ["merchant-terms", "/merchant-terms"],
    ["data-processing", "/data-processing"],
  ]
  const footer = readProjectFile("components", "layout", "marketing-layout.tsx")
  const csp = readProjectFile("lib", "security", "csp.ts")
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const llms = readProjectFile("public", "llms.txt")

  for (const [directory, canonical] of routes) {
    const page = readProjectFile("app", directory, "page.tsx")
    assert.match(page, /export const metadata: Metadata = \{/)
    assert.match(
      page,
      new RegExp(`alternates: \\{ canonical: "${canonical}" \\}`)
    )
    assert.ok(csp.includes(`"${canonical}"`))
    assert.ok(facts.includes(`path: "${canonical}"`))
    assert.ok(llms.includes(`https://nabaperks.com${canonical}`))
  }

  assert.ok(footer.includes('href="/cookies"'))
  assert.ok(footer.includes('href="/merchant-terms"'))
  assert.ok(footer.includes('href="/data-processing"'))
})

test("Given legal copy follows product behaviour When the shared content is inspected Then key code-backed rules remain explicit", () => {
  const content = readProjectFile("lib", "legal", "content.ts")

  for (const expected of [
    'CUSTOMER_LEGAL_VERSION = "2026-07-19"',
    "Europe/London calendar date",
    "first active configured reward",
    "configured reward weightings",
    "be at least 18",
    "verified email address",
    "active or trialling",
    "eligible for anonymisation after seven days",
    "eligible for anonymisation after 365 days",
    "expire after 90 days",
  ]) {
    assert.ok(content.includes(expected), `legal content includes ${expected}`)
  }

  assert.doesNotMatch(content, /fresh email (?:assurance|check)/i)
  assert.doesNotMatch(content, /follows ICO guidance/i)
  assert.doesNotMatch(content, /data controller for Nabaperks loyalty data/i)
  assert.doesNotMatch(content, /UK business day/i)
})

test("Given the venue terms version changes When a customer joins Then the recorded snapshot is rebuilt from the displayed rule set", () => {
  const action = readProjectFile(
    "app",
    "m",
    "[merchantSlug]",
    "join",
    "actions.ts"
  )
  const consent = readProjectFile("lib", "customer", "consent.ts")
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260719170000_align_verified_email_legal_terms.sql"
  )

  assert.match(action, /const policyVersion = CUSTOMER_LEGAL_VERSION/)
  assert.match(consent, /MARKETING_POLICY_VERSION = CUSTOMER_LEGAL_VERSION/)
  assert.match(migration, /new\.policy_version <> '2026-07-19'/)
  assert.match(
    migration,
    /before insert on public\.customer_loyalty_terms_acceptances/
  )
  assert.match(
    migration,
    /extensions\.digest\(new\.terms_snapshot::text, 'sha256'\)/
  )
  assert.match(
    migration,
    /'id', 'merchant-contact',\s+'body', 'Ask the venue team'/
  )
  assert.doesNotMatch(migration, /fresh email (?:assurance|check)/i)

  for (const section of [
    "joining",
    "earning-rule",
    "reward",
    "redemption",
    "exclusions",
    "referrals-and-additional-rewards",
    "fraud-and-abuse",
    "availability",
    "merchant-contact",
  ]) {
    assert.ok(migration.includes(`'id', '${section}'`))
  }
})
