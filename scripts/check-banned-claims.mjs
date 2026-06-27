#!/usr/bin/env node
/**
 * check-banned-claims — static guardrail for the PDF-grounded SEO/GEO pass.
 *
 * Scans the PUBLIC MARKETING + SEO surfaces only for banned public claims and
 * non-approved entity/compliance language. Merchant/admin product surfaces are
 * intentionally NOT scanned: the merchant onboarding/profile venue-category
 * taxonomy (e.g. "Bubble tea") is functional self-identification, not public
 * marketing targeting, and is out of scope for this pass.
 *
 * Usage: node scripts/check-banned-claims.mjs   (exit 1 if any banned match)
 */
import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"

const ROOT = process.cwd()

/** Curated public marketing/SEO roots (files or dirs). */
const SCAN = [
  "app/page.tsx",
  "app/layout.tsx",
  "app/sitemap.ts",
  "app/robots.ts",
  "app/about",
  "app/loyalty-for-pubs",
  "app/guides",
  "app/pricing",
  "app/privacy",
  "app/terms",
  "app/opengraph-image.tsx",
  "components/marketing",
  "components/seo",
  "lib/marketing",
  "lib/seo",
  "lib/legal",
  "public/llms.txt",
]

const SKIP = /(\.test\.|\.spec\.|node_modules|\.next)/

/** Banned patterns: { label, re }. Case-insensitive. */
const BANNED = [
  { label: "chippy targeting", re: /\bchipp(y|ies)\b/i },
  { label: "bubble tea targeting", re: /bubble\s*tea/i },
  { label: "Companies House", re: /companies house/i },
  { label: "company number", re: /company number/i },
  { label: "registered office", re: /registered office/i },
  { label: "founding date", re: /founding date|\bfounded in\b/i },
  { label: "named founder/person", re: /\bfounder\b|\bSubodh\b/i },
  { label: "personal LinkedIn", re: /linkedin\.com\/in\//i },
  { label: "hard UK-GDPR/ICO compliance claim", re: /uk[\s-]*gdpr[\s/-]*ico[\s-]*compliant|ico[\s-]*compliant/i },
  { label: "fully compliant", re: /fully compliant/i },
  { label: "GDPR guaranteed", re: /gdpr guaranteed/i },
  { label: "legally approved", re: /legally approved/i },
  { label: "certified claim", re: /\bcertified\b/i },
  { label: "production-records claim", re: /reproducible from production records|figures reproducible from production/i },
  { label: "embed-calculator surface", re: /embed this calculator/i },
  { label: "deprecated product term 'Browser Card'", re: /Browser Card|Open-Browser Loyalty Card/ },
]

async function collectFiles(entry) {
  const abs = join(ROOT, entry)
  let s
  try {
    s = await stat(abs)
  } catch {
    return [] // optional path not yet created
  }
  if (s.isFile()) return SKIP.test(abs) ? [] : [abs]
  const out = []
  for (const name of await readdir(abs)) {
    out.push(...(await collectFiles(join(entry, name))))
  }
  return out
}

const files = (await Promise.all(SCAN.map(collectFiles))).flat()
const findings = []

for (const file of files) {
  const text = await readFile(file, "utf8")
  const lines = text.split("\n")
  lines.forEach((line, i) => {
    for (const { label, re } of BANNED) {
      if (re.test(line)) {
        findings.push({ file: relative(ROOT, file), line: i + 1, label, text: line.trim() })
      }
    }
  })
}

if (findings.length) {
  console.error(`✗ ${findings.length} banned-claim match(es) in public marketing surfaces:\n`)
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.label}]\n    ${f.text}`)
  }
  process.exit(1)
}

console.log(`✓ no banned public claims across ${files.length} marketing/SEO files`)
