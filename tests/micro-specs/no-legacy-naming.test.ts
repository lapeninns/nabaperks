import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

const scannedLocalFiles = [".vercel/project.json"] as const
const testFilePath = "tests/micro-specs/no-legacy-naming.test.ts"
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
] as const

function trackedProjectFiles() {
  const result = spawnSync("git", ["ls-files"], {
    cwd: process.cwd(),
    encoding: "utf8",
  })

  expect(result.status, result.stderr).toBe(0)

  return result.stdout
    .split("\n")
    .filter((path) => path.length > 0 && path !== testFilePath)
}

describe("no legacy naming guard", () => {
  it("keeps retired product and browser-approval language out of project artifacts", () => {
    const paths = [
      ...trackedProjectFiles(),
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
