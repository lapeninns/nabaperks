import { existsSync, readFileSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { describe, expect, it } from "vitest"

import packageJson from "@/package.json" with { type: "json" }
import envContract from "@/config/env-contract.json" with { type: "json" }
import {
  assertValidEnv,
  EnvConfigError,
  type EnvContractEntry,
} from "@/lib/env/validate"

const projectDir = process.cwd()
const contract = envContract as readonly EnvContractEntry[]

function readProjectFile(path: string) {
  return readFileSync(path, "utf8")
}

function runScript(path: string) {
  return spawnSync(process.execPath, [path], {
    cwd: projectDir,
    encoding: "utf8",
  })
}

describe("00/01 foundation micro-specs", () => {
  it("keeps the project shell wired for build, lint, typecheck, env, security, db, and tests", () => {
    expect(packageJson.scripts).toMatchObject({
      build: "next build",
      "db:migrate": "node scripts/run-supabase-sql.mjs --apply",
      "db:seed": "node scripts/run-supabase-sql.mjs --seed",
      "db:setup": "node scripts/run-supabase-sql.mjs --apply --seed --test",
      "db:test:rls": "node scripts/run-supabase-sql.mjs --test",
      lint: "eslint",
      typecheck: "tsc --noEmit",
      "env:check": "node scripts/check-env.mjs",
      "db:verify": "node scripts/verify-supabase-schema.mjs",
      "security:verify": "node scripts/verify-security.mjs",
      test: "vitest run",
    })
    expect(packageJson.dependencies.next).toBe("16.2.6")
    expect(packageJson.dependencies["@supabase/supabase-js"]).toBeDefined()
    expect(packageJson.dependencies.stripe).toBeDefined()
  })

  it("validates required env keys, public prefixes, server-only prefixes, and URLs", () => {
    const validValues = Object.fromEntries(
      contract.map((entry) => [
        entry.name,
        entry.kind === "url" ? "https://example.test" : "configured",
      ])
    )

    expect(() => assertValidEnv(contract, validValues)).not.toThrow()

    expect(() =>
      assertValidEnv(
        [
          {
            name: "APP_URL",
            visibility: "public",
            kind: "url",
            description: "bad public key",
          },
          {
            name: "NEXT_PUBLIC_SECRET_KEY",
            visibility: "server",
            kind: "string",
            description: "bad server key",
          },
          {
            name: "NEXT_PUBLIC_BAD_URL",
            visibility: "public",
            kind: "url",
            description: "bad URL",
          },
        ] satisfies EnvContractEntry[],
        {
          APP_URL: "ftp://example.test",
          NEXT_PUBLIC_SECRET_KEY: "secret",
          NEXT_PUBLIC_BAD_URL: "not a url",
        }
      )
    ).toThrow(EnvConfigError)
  })

  it("keeps .env.example aligned with the env contract without leaking server keys as public keys", () => {
    const example = readFileSync(".env.example", "utf8")

    for (const entry of contract) {
      expect(example).toContain(`${entry.name}=`)
      if (entry.visibility === "server") {
        expect(entry.name.startsWith("NEXT_PUBLIC_")).toBe(false)
      }
    }
  })

  it("passes schema/RLS/audit verification for the Supabase backbone", () => {
    const result = runScript("scripts/verify-supabase-schema.mjs")

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("Supabase schema verification passed.")
  })

  it("passes security verification for secrets, rate limits, fraud, and webhook guards", () => {
    const result = runScript("scripts/verify-security.mjs")

    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain("Security verification passed.")
  })

  it("tracks every MVP micro-spec as an executable test target", () => {
    const readme = readFileSync("micro-specs/README.md", "utf8")
    const expectedSpecs = [
      "00-mvp-scope/01-scope-and-release-gates.md",
      "01-foundation/01-project-shell-and-environments.md",
      "01-foundation/02-supabase-schema-rls-and-audit.md",
      "02-merchant/01-merchant-auth-onboarding-and-business-profile.md",
      "02-merchant/02-loyalty-card-builder.md",
      "02-merchant/03-dynamic-qr-generation-and-downloads.md",
      "03-customer/01-qr-resolver-and-customer-join.md",
      "03-customer/02-digital-stamp-card.md",
      "04-staff-rewards/01-staff-pin-stamp-issuing.md",
      "04-staff-rewards/02-reward-unlock-and-redemption.md",
      "05-merchant-value/01-merchant-dashboard-activity-and-roi.md",
      "06-admin-billing/01-stripe-billing-and-access-control.md",
      "06-admin-billing/02-internal-admin-support-console.md",
      "07-observability-compliance/01-events-analytics-and-funnels.md",
      "07-observability-compliance/02-consent-legal-pages-and-data-requests.md",
      "07-observability-compliance/03-security-fraud-and-rate-limits.md",
      "08-pilot/01-pilot-readiness-and-validation.md",
    ]

    for (const spec of expectedSpecs) {
      expect(readme).toContain(spec)
    }
  })

  it("exposes Honey & Ink tokens, tactile utilities, and reduced-motion safeguards", () => {
    const globals = readProjectFile("app/globals.css")

    for (const token of [
      "--paper-cream",
      "--espresso-ink",
      "--soft-mint",
      "--fresh-green",
      "--stamp",
      "--reward",
      "--qr",
      "--ease-stamp",
      "--duration-fast: 150ms",
      "--duration-reveal: 400ms",
    ]) {
      expect(globals).toContain(token)
    }

    for (const utility of [
      ".pressable",
      ".surface-card",
      ".eyebrow",
      ".numeric-tabular",
      "prefers-reduced-motion: reduce",
    ]) {
      expect(globals).toContain(utility)
    }
  })

  it("installs approved shadcn primitives for the foundation layer", () => {
    const primitives = [
      "alert",
      "badge",
      "card",
      "empty",
      "field",
      "input",
      "input-group",
      "input-otp",
      "label",
      "progress",
      "separator",
      "sheet",
      "skeleton",
      "sonner",
      "spinner",
      "table",
      "tabs",
      "textarea",
    ]

    for (const primitive of primitives) {
      expect(existsSync(`components/ui/${primitive}.tsx`)).toBe(true)
    }

    expect(packageJson.dependencies.sonner).toBeDefined()
    expect(packageJson.dependencies["input-otp"]).toBeDefined()
  })

  it("keeps Button stamp/reward variants, shadcn compatibility, and tactile sizing", () => {
    const button = readProjectFile("components/ui/button.tsx")

    expect(button).toContain("stamp:")
    expect(button).toContain("reward:")
    expect(button).toContain('rounded-full')
    expect(button).toContain('h-11')
    expect(button).toContain('motion-safe:active:scale-[0.96]')
    expect(button).toContain("focus-visible:ring-3")
    expect(button).toContain("asChild")
    expect(button).toContain("Slot.Root")
    expect(button).toContain("buttonVariants")
  })

  it("constrains motion and icon imports to approved packages", () => {
    const packageFile = readProjectFile("package.json")
    const sourceFiles = [
      "app/layout.tsx",
      "components/ui/button.tsx",
      "components/ui/sheet.tsx",
      "components/ui/sonner.tsx",
    ]
      .map((path) => readProjectFile(path))
      .join("\n")

    expect(packageJson.dependencies.motion).toBeDefined()
    expect(packageFile).not.toContain('"framer-motion"')
    expect(sourceFiles).not.toContain("@hugeicons/react/core-free-icons")

    const bannedImportScan = spawnSync(
      "rg",
      [
        "--glob",
        "{app,components,lib}/**/*.{ts,tsx}",
        "framer-motion|@hugeicons/react/core-free-icons|from ['\"]motion['\"]",
      ],
      { cwd: projectDir, encoding: "utf8" }
    )
    const motionImportScan = spawnSync(
      "rg",
      ["--glob", "{app,components,lib}/**/*.{ts,tsx}", "from ['\"]motion/"],
      { cwd: projectDir, encoding: "utf8" }
    )

    expect(
      bannedImportScan.status,
      bannedImportScan.stdout + bannedImportScan.stderr
    ).toBe(1)
    if (motionImportScan.status === 0) {
      expect(motionImportScan.stdout).toMatch(/motion\/react/)
      expect(motionImportScan.stdout).not.toMatch(/motion\/(?!react)/)
    } else {
      expect(motionImportScan.status).toBe(1)
    }
  })

  it("keeps root locale, typography, theme provider, and non-blocking toaster wired", () => {
    const layout = readProjectFile("app/layout.tsx")
    const sonner = readProjectFile("components/ui/sonner.tsx")

    expect(layout).toContain('lang="en-GB"')
    expect(layout).toContain('variable: "--font-nunito-sans"')
    expect(layout).toContain('variable: "--font-geist-mono"')
    expect(layout).toContain('className={`${nunitoSans.variable} ${geistMono.variable} antialiased`}')
    expect(layout).toContain('<body className="font-sans">')
    expect(layout).toContain("<ThemeProvider>")
    expect(layout).toContain("<Toaster")
    expect(sonner).toContain('theme={theme as ToasterProps["theme"]}')
    expect(sonner).toContain("--normal-bg")
  })
})
