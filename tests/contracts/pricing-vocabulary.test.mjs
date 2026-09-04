import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

const read = (path) =>
  readFileSync(new URL(`../../${path}`, import.meta.url), "utf8")

function walk(dir) {
  const abs = path.join(projectRoot, dir)
  const out = []
  for (const name of readdirSync(abs)) {
    const rel = path.join(dir, name)
    const stats = statSync(path.join(projectRoot, rel))
    if (stats.isDirectory()) {
      out.push(...walk(rel))
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(rel)
    }
  }
  return out
}

const PRICING_MODULE = [
  "components/marketing/pricing/price-lockup.tsx",
  "components/marketing/pricing/plan-includes-list.tsx",
  "components/marketing/pricing/campaign-strip.tsx",
  "components/marketing/pricing/fine-print-strip.tsx",
  "components/marketing/pricing/pricing-sheet.tsx",
  "components/marketing/pricing/takeover-anchor.tsx",
  "components/marketing/pricing/cadence-option.tsx",
]

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

test("the seasonal chip keeps the configured campaign identity and deadline", () => {
  const source = read("components/marketing/pricing/campaign-strip.tsx")
  const chipBranch = source.slice(
    source.indexOf('variant === "chip"'),
    source.indexOf('variant === "strip"')
  )

  assert.match(chipBranch, /offer\.name/)
  assert.match(chipBranch, /offer\.deadlineLine/)
})

test("the FAQ accordion preserves the shared roundel and unclipped focus ring", () => {
  const source = read("components/marketing/landing/faq.tsx")
  const faqList = source.slice(0, source.indexOf("export function LandingFaq"))

  assert.match(faqList, /<IconRoundel/)
  assert.doesNotMatch(faqList, /group overflow-hidden/)
})

test('Given the campaign strip omits its disclosure by design When any caller renders variant="strip" Then that same file also renders termsLine', () => {
  // CLAIMS-COMPLIANCE GUARD, not a style rule. CampaignStrip's `variant="strip"`
  // deliberately drops offer.termsLine — the disclosure that the campaign
  // wrapper does not change deliverables, prices, or guarantee conditions —
  // because the strip is meant to bond to a PricingSheet whose own
  // FinePrintStrip re-homes that disclosure instead. That contract currently
  // rests on convention alone: this exact omission already shipped once onto
  // a live pre-checkout Stripe surface before being caught. Every file that
  // opts into the stripped variant must also render `termsLine` SOMEWHERE in
  // its own source, or the campaign wrapper's disclosure silently vanishes
  // from that surface. This walks app/ and components/ rather than
  // hardcoding today's two callers, so a future third caller is caught too.
  const offenders = []

  for (const root of ["app", "components"]) {
    for (const file of walk(root)) {
      const source = read(file)
      if (source.includes('variant="strip"') && !source.includes("termsLine")) {
        offenders.push(file)
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `these files render CampaignStrip variant="strip" without also rendering ` +
      `offer.termsLine, so the campaign wrapper's mandatory disclosure that it ` +
      `does not change deliverables, prices, or guarantee conditions silently ` +
      `disappears from the surface: ${offenders.join(", ")}. Re-home ` +
      `offer.termsLine into that file's own FinePrintStrip (or equivalent).`
  )
})
