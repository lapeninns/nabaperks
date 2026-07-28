#!/usr/bin/env node
/**
 * check-banned-claims — static guardrail for the PDF-grounded SEO/GEO pass.
 *
 * Scans surviving public and SEO surfaces for banned public claims and
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

/** Curated public/SEO roots (files or dirs). */
const SCAN = [
  "app/layout.tsx",
  "app/page.tsx",
  "app/sitemap.ts",
  "app/robots.ts",
  "app/(auth)/signup",
  "app/how-it-works",
  "app/faq",
  "app/pricing",
  "app/demo",
  "app/about",
  "app/loyalty-for-pubs",
  "app/loyalty-for-cafes",
  "app/loyalty-for-bars",
  "app/loyalty-for-takeaways",
  "app/guides",
  "app/privacy",
  "app/terms",
  "app/cookies",
  "app/merchant-terms",
  "app/data-processing",
  "app/opengraph-image.tsx",
  "components/marketing",
  "components/layout/marketing-layout.tsx",
  "components/layout/marketing-header-nav.tsx",
  "components/seo",
  "lib/marketing",
  "lib/seo",
  "lib/legal",
  "public/llms.txt",
]

const SKIP = /(\.test\.|\.spec\.|node_modules|\.next)/

/**
 * Banned patterns. `re` is a case-insensitive regex; `substr` is a literal,
 * case-insensitive substring match (used for URL-shaped patterns so we never run
 * an unanchored URL regex — content scan, not URL sanitisation).
 */
/**
 * Internal review-voice wording must never render on any public or product
 * surface: the product must not self-label its legal wording as unreviewed
 * (production-polish rows MKT-P0-01/02, CUS-P1-03/04). Scanned wider than
 * SCAN — all rendered source under app/, components/, and lib/ — because the
 * customer legal sheet and per-venue terms page live outside the marketing
 * roots. Legal sign-off itself is an ops matter outside the repo; this guard
 * only keeps the self-labelling out of rendered copy.
 */
const REVIEW_VOICE_SCAN = ["app", "components", "lib"]

/** Text-only rendered-source extensions for the review-voice tier. */
const REVIEW_VOICE_FILES = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|mdx|txt)$/i

const REVIEW_VOICE = [
  { label: "review-voice: 'review required'", re: /review required/i },
  {
    label: "review-voice: 'not final legal wording'",
    re: /not final legal wording/i,
  },
  { label: "review-voice: 'human review'", re: /human review/i },
  {
    label: "review-voice: 'pilot operation only'",
    re: /pilot operation only/i,
  },
  {
    label: "review-voice: 'review(ed) before launch'",
    re: /review(ed)?\s+before\s+(public\s+)?launch/i,
  },
]

const BANNED = [
  {
    label: "deprecated counter-verification claim",
    re: /counter-verified\s+stamps?/i,
  },
  {
    label: "impossible-fraud claim",
    re: /can(?:not|'t) be faked|fraud is designed out/i,
  },
  { label: "self-stamping prevention claim", re: /stops self-stamping/i },
  { label: "invented 'spots left' availability", re: /\bspots?\s+left\b/i },
  {
    label: "invented numeric onboarding capacity",
    re: /onboard\s+\d+\s+new venues/i,
  },
  {
    label: "unsupported five-minute setup",
    re: /about five minutes|set up in minutes/i,
  },
  { label: "unsupported same-afternoon setup", re: /same afternoon/i },
  {
    label: "unsupported afternoon setup",
    re: /set up your venue this afternoon/i,
  },
  {
    label: "unsupported first-week outcome",
    re: /first repeat visit inside the first week/i,
  },
  { label: "chippy targeting", re: /\bchipp(y|ies)\b/i },
  { label: "bubble tea targeting", re: /bubble\s*tea/i },
  { label: "Companies House", re: /companies house/i },
  { label: "company number", re: /company number/i },
  { label: "registered office", re: /registered office/i },
  { label: "founding date", re: /founding date|\bfounded in\b/i },
  { label: "named founder/person", re: /\bfounder\b|\bSubodh\b/i },
  { label: "personal LinkedIn", substr: "linkedin.com/in/" },
  {
    label: "hard UK-GDPR/ICO compliance claim",
    re: /uk[\s-]*gdpr[\s/-]*ico[\s-]*compliant|ico[\s-]*compliant/i,
  },
  { label: "fully compliant", re: /fully compliant/i },
  { label: "GDPR guaranteed", re: /gdpr guaranteed/i },
  { label: "legally approved", re: /legally approved/i },
  { label: "certified claim", re: /\bcertified\b/i },
  {
    label: "production-records claim",
    re: /reproducible from production records|figures reproducible from production/i,
  },
  { label: "embed-calculator surface", re: /embed this calculator/i },
  {
    label: "deprecated product term 'Browser Card'",
    re: /Browser Card|Open-Browser Loyalty Card/,
  },
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

const findings = []

async function scanFiles(files, patterns) {
  for (const file of files) {
    const text = await readFile(file, "utf8")
    const lines = text.split("\n")
    lines.forEach((line, i) => {
      for (const { label, re, substr } of patterns) {
        const hit = re ? re.test(line) : line.toLowerCase().includes(substr)
        if (hit) {
          findings.push({
            file: relative(ROOT, file),
            line: i + 1,
            label,
            text: line.trim(),
          })
        }
      }
    })
  }
}

const files = (await Promise.all(SCAN.map(collectFiles))).flat()
await scanFiles(files, BANNED)

const reviewVoiceFiles = (
  await Promise.all(REVIEW_VOICE_SCAN.map(collectFiles))
)
  .flat()
  .filter((file) => REVIEW_VOICE_FILES.test(file))
await scanFiles(reviewVoiceFiles, REVIEW_VOICE)

if (findings.length) {
  console.error(
    `✗ ${findings.length} banned-claim match(es) in public marketing surfaces:\n`
  )
  for (const f of findings) {
    console.error(`  ${f.file}:${f.line}  [${f.label}]\n    ${f.text}`)
  }
  process.exit(1)
}

console.log(
  `✓ no banned public claims across ${files.length} marketing/SEO files, no review-voice wording across ${reviewVoiceFiles.length} rendered-source files`
)
