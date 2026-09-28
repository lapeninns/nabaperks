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
  const nextConfig = readProjectFile("next.config.ts")
  const facts = readProjectFile("lib", "marketing", "facts.ts")
  const llms = readProjectFile("public", "llms.txt")

  for (const [directory, canonical] of routes) {
    const page = readProjectFile("app", directory, "page.tsx")
    assert.match(page, /export const metadata: Metadata = \{/)
    assert.match(
      page,
      new RegExp(`alternates: \\{ canonical: "${canonical}" \\}`)
    )
    assert.ok(facts.includes(`path: "${canonical}"`))
    assert.ok(llms.includes(`https://nabaperks.com${canonical}`))
  }

  assert.match(nextConfig, /source: "\/:path\*"/)
  assert.match(nextConfig, /staticMarketingContentSecurityPolicy\(\)/)

  assert.ok(footer.includes('href="/cookies"'))
  assert.ok(footer.includes('href="/merchant-terms"'))
  assert.ok(footer.includes('href="/data-processing"'))
})

test("Given legal copy follows product behaviour When the shared content is inspected Then key code-backed rules remain explicit", () => {
  const content = readProjectFile("lib", "legal", "content.ts")

  for (const expected of [
    'CUSTOMER_LEGAL_VERSION = "2026-09-28.1"',
    'docNumber: "CT-2026-09-28.1"',
    "sent to your mobile number by WhatsApp or text message",
    "by email to your email address",
    "each verified email address can belong to only one Nabaperks wallet",
    "Nabaperks does not combine wallets",
    "cannot be changed or removed by editing your profile",
    "you can still ask for it to be deleted through a privacy request",
    "public offer link need a confirmed phone number",
    "venue trading day",
    "first active configured reward",
    "configured reward weightings",
    "be at least 18",
    "A verified email address and verified mobile phone number are required before reward collection",
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

test("Given the reward-logic activation When September terms are accepted Then the snapshot preserves the displayed policy", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260926100000_loyalty_terms_snapshot_v20260926.sql"
  )

  assert.match(migration, /new\.policy_version <> '2026-09-26'/)
  assert.match(
    migration,
    /extensions\.digest\(new\.terms_snapshot::text, 'sha256'\)/
  )
  assert.match(migration, /private\.loyalty_earning_terms_text\(v_card\.id\)/)
  assert.match(
    migration,
    /order by items\.display_order, items\.created_at, items\.id/
  )
  assert.match(
    migration,
    /order by windows\.isodow, windows\.starts_at, windows\.id/
  )
  assert.match(migration, /and upgrades\.merchant_id = windows\.merchant_id/)
  assert.match(migration, /and upgrades\.location_id = windows\.location_id/)

  for (const section of [
    "joining",
    "earning-rule",
    "reward",
    "redemption",
    "reward-pool",
    "collection-windows",
    "exclusions",
    "referrals-and-additional-rewards",
    "fraud-and-abuse",
    "availability",
    "merchant-contact",
  ]) {
    assert.ok(migration.includes(`'id', '${section}'`))
  }

  for (const displayedRule of [
    "venue trading day",
    "immediately opens a fresh card",
    "Email is optional; if supplied, it must be verified",
    "Photo ID is required only for rewards marked as age checked",
    "No collection windows configured",
    "30-day grace period",
  ]) {
    assert.ok(
      migration.includes(displayedRule),
      `activation snapshot includes ${displayedRule}`
    )
  }
  assert.doesNotMatch(migration, /normally expire within 56 days/)
})

test("Given email joining When 2026-09-28 terms are accepted Then the snapshot describes phone or email verification and keeps the corrected rules", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20261007100000_loyalty_terms_snapshot_v20260928.sql"
  )

  assert.match(migration, /new\.policy_version <> '2026-09-28'/)
  assert.match(
    migration,
    /create trigger customer_terms_apply_v20260928_snapshot\s+before insert on public\.customer_loyalty_terms_acceptances/
  )
  assert.match(
    migration,
    /extensions\.digest\(new\.terms_snapshot::text, 'sha256'\)/
  )
  assert.match(
    migration,
    /grant execute on function public\.apply_customer_legal_terms_snapshot_v20260928\(\)\s+to service_role/
  )

  for (const section of [
    "joining",
    "earning-rule",
    "reward",
    "redemption",
    "reward-pool",
    "collection-windows",
    "exclusions",
    "referrals-and-additional-rewards",
    "fraud-and-abuse",
    "availability",
    "merchant-contact",
  ]) {
    assert.ok(migration.includes(`'id', '${section}'`))
  }

  for (const displayedRule of [
    "Join by verifying your mobile phone number or, where offered, your email address with a one-time code",
    "A verified email address is required before reward collection",
    "venue trading day",
    "immediately opens a fresh card",
    "30-day grace period",
  ]) {
    assert.ok(
      migration.includes(displayedRule),
      `2026-09-28 snapshot includes ${displayedRule}`
    )
  }
  assert.doesNotMatch(migration, /Email is optional; if supplied/)
})
