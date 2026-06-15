import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const scannedLocalFiles = [".vercel/project.json"] as const
const testFilePath = "tests/micro-specs/no-legacy-naming.test.ts"
const activeSourcePrefixes = [
  "app/",
  "components/",
  "lib/",
  "micro-specs/",
  "scripts/",
  "supabase/tests/",
] as const
const activeSourceFiles = [
  "AGENTS.md",
  "DESIGN.md",
  "docs/ARCHITECTURE.md",
  "docs/CUSTOMER_FLOW.md",
  "docs/CUSTOMER_FLOW_SCREENSHOT_RUNBOOK.md",
  "docs/PROJECT_SPEC.md",
  "docs/ENV_KEYS.md",
  "supabase/README.md",
  ".env.example",
  "config/env-contract.json",
] as const
const excludedActivePaths = [
  testFilePath,
  "tests/micro-specs/self-service-stamping.test.ts",
  "scripts/verify-supabase-schema.mjs",
] as const
const retiredProductPattern = new RegExp(
  [
    ["stamp", "iee"].join(""),
    ["stamp", "ie"].join(""),
    ["stam", "pee"].join(""),
    ["stamp", "y"].join(""),
  ].join("|"),
  "i"
)

const bannedNamingPatterns = [
  {
    label: "retired product naming",
    pattern: retiredProductPattern,
  },
  {
    label: "shared PIN naming",
    pattern: /shared[-\s]?pins?/i,
  },
  {
    label: "customer phone handover wording",
    pattern:
      /hands?\s+over\s+(?:an\s+)?unlocked\s+phone|hand(?:ed)?\s+(?:the\s+)?phone|phone\s+handover|handover/i,
  },
  {
    label: "customer-device PIN wording",
    pattern:
      /customer[-\s]?device\s+pins?|pins?\s+(?:on|typed\s+on)\s+(?:a\s+)?customer[-\s]?device|customer\s+phones?.*pins?|pins?.*customer\s+phones?/i,
  },
  {
    label: "venue-wide PIN wording",
    pattern:
      /venue\s+pins?|merchant\s+pins?|daily\s+shared\s+pins?|revealable\s+shared/i,
  },
  {
    label: "staff typing PIN on the customer surface",
    pattern:
      /staff\s+types?\s+(?:a\s+)?(?:4[-\s]?digit\s+)?pins?|types?\s+(?:the\s+)?(?:venue|merchant)\s+pins?/i,
  },
  {
    label: "retired station approval wording",
    pattern:
      /counter\s+handshake|staff\s+stations?|counter\s+stations?|station\s+pairing|paired\s+stations?|approved\s+(?:visit|stamp)s?|customer\s+approval|browser[-\s]?approval|staff\s+sessions?/i,
  },
  {
    label: "retired token approval naming",
    pattern:
      /verification\s+tokens?|stamp\s+codes?|redemption\s+codes?|approve_stamp_token|redeem_reward_token|create_verification_token|lookup_verification_code/i,
  },
  {
    label: "retired direct staff route",
    pattern: /(?<!app)\/staff\b/i,
  },
] as const

function projectFiles() {
  const result = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    {
      cwd: process.cwd(),
      encoding: "utf8",
    }
  )

  expect(result.status, result.stderr).toBe(0)

  return result.stdout
    .split("\n")
    .filter((path) => path.length > 0)
    .filter((path) => !excludedActivePaths.some((excluded) => excluded === path))
    .filter((path) => existsSync(path))
    .filter(
      (path) =>
        activeSourceFiles.some((file) => file === path) ||
        activeSourcePrefixes.some((prefix) => path.startsWith(prefix))
    )
    .filter(
      (path) =>
        !path.startsWith("supabase/migrations/") &&
        !path.startsWith("docs/design-system/") &&
        !path.startsWith("docs/merchant-app-frontend-")
    )
}

describe("no legacy naming guard", () => {
  it("keeps retired product and browser-approval language out of project artifacts", () => {
    const paths = [
      ...projectFiles(),
      ...scannedLocalFiles.filter((path) => existsSync(path)),
    ]

    for (const path of paths) {
      const source = readFileSync(path, "utf8")

      for (const { label, pattern } of bannedNamingPatterns) {
        expect(source, `${path} still contains ${label}`).not.toMatch(pattern)
      }
    }
  })
})
