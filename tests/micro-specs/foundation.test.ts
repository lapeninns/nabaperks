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

function sourceFiles(...prefixes: readonly string[]) {
  const listing = spawnSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: projectDir, encoding: "utf8" }
  )
  expect(listing.status, listing.stderr).toBe(0)

  return listing.stdout
    .split("\n")
    .filter(
      (path) =>
        (path.endsWith(".ts") || path.endsWith(".tsx")) &&
        prefixes.some((prefix) => path.startsWith(prefix))
    )
    .filter((path) => existsSync(path))
}

function readMerchantDashboardSurface() {
  return `${readProjectFile("app/app/page.tsx")}\n${readProjectFile(
    "components/merchant/dashboard-home-streams.tsx"
  )}`
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
    expect(packageJson.dependencies.next).toBe("16.2.9")
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

  it("keeps obsolete Druto captures and venue-code reveal surfaces out of the repo", () => {
    for (const path of [
      "druto-screenshots",
      "druto-mock-demo-screenshots",
      "druto-complete-mock-demo-screenshots",
      "druto-httrack-style-capture",
      "components/merchant/staff-pin-settings-form.tsx",
      "components/merchant/staff-pin-reveal.tsx",
      "lib/merchant/staff-pin.ts",
      "lib/merchant/staff-pin-rotation.ts",
      "lib/security/pin-cipher.ts",
      "app/api/cron/staff-pin-rotation/route.ts",
    ]) {
      expect(existsSync(path), path).toBe(false)
    }

    const bannedNeedles = [
      "STAFF_PIN_ENCRYPTION_KEY",
      "staff_pin_revealed",
      "get_merchant_staff_pin_ciphertext",
      "upsert_merchant_staff_pin",
      "rotate_staff_pin_system",
      "staff-pin-rotation",
    ]
    const currentSourcePaths = [
      ".env.example",
      "config/env-contract.json",
      "docs/ENV_KEYS.md",
      "docs/ARCHITECTURE.md",
      "docs/PROJECT_SPEC.md",
      "scripts/verify-supabase-schema.mjs",
      "supabase/README.md",
      "vercel.json",
      "lib/merchant/activity.ts",
      "lib/merchant/dashboard.ts",
    ]

    for (const path of currentSourcePaths) {
      if (!existsSync(path)) continue

      const source = readProjectFile(path)

      for (const needle of bannedNeedles) {
        expect(source, `${path} still contains ${needle}`).not.toContain(needle)
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
      "04-staff-rewards/01-self-service-stamp-issuing.md",
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

    expect(button).toContain("pressable")
    expect(button).toContain("stamp:")
    expect(button).toContain("reward:")
    expect(button).toContain("rounded-full")
    expect(button).toContain("h-11")
    expect(button).toContain("motion-safe:active:scale-[0.96]")
    expect(button).toContain("focus-visible:ring-3")
    expect(button).toContain("asChild")
    expect(button).toContain("Slot.Root")
    expect(button).toContain("buttonVariants")
  })

  it("applies tactile and brand hierarchy primitives on representative real surfaces", () => {
    const logo = readProjectFile("components/brand/logo.tsx")
    const homePage = readProjectFile("app/page.tsx")
    const merchantDashboard = readMerchantDashboardSurface()
    const adminHome = readProjectFile("app/admin/page.tsx")
    const activityPage = readProjectFile("app/app/activity/page.tsx")
    const auditPage = readProjectFile("app/admin/audit/page.tsx")
    const qrPage = readProjectFile("app/q/[qrId]/page.tsx")
    const merchantCustomersPage = readProjectFile("app/app/customers/page.tsx")
    const adminPilotPage = readProjectFile("app/admin/pilot/page.tsx")
    const adminPrivacyPage = readProjectFile("app/admin/privacy/page.tsx")
    const adminFraudPage = readProjectFile("app/admin/fraud/page.tsx")
    const adminBillingPage = readProjectFile("app/admin/billing/page.tsx")
    const adminCustomersPage = readProjectFile("app/admin/customers/page.tsx")
    const adminMerchantsPage = readProjectFile("app/admin/merchants/page.tsx")

    expect(logo).toContain("pressable")
    expect(homePage).toContain("PageTitle")
    expect(homePage).toContain("SectionHeader")
    expect(homePage).toContain("pressable")

    for (const source of [merchantDashboard, adminHome]) {
      expect(source).toContain("PageTitle")
      expect(source).toContain("SectionHeader")
      expect(source).toContain("MetricTile")
    }

    for (const source of [merchantDashboard, activityPage, auditPage, qrPage]) {
      expect(source).toContain("EmptyState")
    }

    for (const source of [
      merchantCustomersPage,
      adminPilotPage,
      adminPrivacyPage,
      adminFraudPage,
      adminBillingPage,
      adminCustomersPage,
      adminMerchantsPage,
    ]) {
      expect(source).toContain("PageTitle")
      expect(source).toContain("EmptyState")
      expect(source).not.toContain("function Header(")
    }

    for (const source of [
      adminPilotPage,
      adminPrivacyPage,
      adminFraudPage,
      adminCustomersPage,
      adminMerchantsPage,
    ]) {
      expect(source).toContain("SectionHeader")
    }
  })

  it("keeps dashboard status and pilot checklist hierarchy centralized", () => {
    const merchantBillingStatus = readProjectFile(
      "components/merchant/billing-status.tsx"
    )
    const adminPilotPage = readProjectFile("app/admin/pilot/page.tsx")

    const billingNotice = merchantBillingStatus.match(
      /export function MerchantBillingNotice[\s\S]*?(?=\nexport function MerchantBillingAccessNote)/
    )?.[0]
    expect(billingNotice).toBeDefined()
    expect(billingNotice).toContain("<SectionHeader")
    expect(billingNotice).not.toContain("<h2")

    const pilotChecklist = adminPilotPage.match(
      /report\.checklist\.map\(\(item\) => \([\s\S]*?\)\)}/
    )?.[0]
    expect(pilotChecklist).toBeDefined()
    expect(pilotChecklist).toContain("<MetricTile")
    expect(pilotChecklist).toContain("label={item.item}")
    expect(pilotChecklist).toContain("value={item.value}")
    expect(pilotChecklist).toContain("item.target")
    expect(pilotChecklist).toContain("item.source")
    expect(pilotChecklist).not.toContain("<article")
    expect(pilotChecklist).not.toContain("text-2xl font-extrabold")
  })

  it("constrains motion imports and keeps @hugeicons as the icon set", () => {
    const packageFile = readProjectFile("package.json")

    expect(packageJson.dependencies.motion).toBeDefined()
    // @hugeicons is the official icon library (see DESIGN.md "Iconography").
    expect(packageJson.dependencies["@hugeicons/react"]).toBeDefined()
    expect(packageJson.dependencies["@hugeicons/core-free-icons"]).toBeDefined()
    expect(packageFile).not.toContain('"framer-motion"')

    // Scan source in-process so the guard does not depend on ripgrep being
    // installed (CI runners do not ship it). Mirrors no-legacy-naming.test.ts.
    const sourcePaths = sourceFiles("app/", "components/", "lib/")
    const bannedImportPattern = /framer-motion|from ['"]motion['"]/
    const motionSubpathPattern = /from ['"]motion\/([\w./-]+)['"]/g

    const bannedImports = sourcePaths.filter((path) =>
      bannedImportPattern.test(readProjectFile(path))
    )
    expect(bannedImports, bannedImports.join("\n")).toHaveLength(0)

    const disallowedMotionSubpaths = sourcePaths.flatMap((path) =>
      [...readProjectFile(path).matchAll(motionSubpathPattern)]
        .filter((match) => match[1] !== "react")
        .map((match) => `${path}: motion/${match[1]}`)
    )
    expect(
      disallowedMotionSubpaths,
      disallowedMotionSubpaths.join("\n")
    ).toHaveLength(0)
  })

  it("keeps root locale, typography, theme provider, and non-blocking toaster wired", () => {
    const layout = readProjectFile("app/layout.tsx")
    const sonner = readProjectFile("components/ui/sonner.tsx")

    expect(layout).toContain('lang="en-GB"')
    expect(layout).toContain('variable: "--font-bricolage-grotesque"')
    expect(layout).toContain('variable: "--font-space-mono"')
    expect(layout).toContain(
      "className={`${bricolageGrotesque.variable} ${spaceMono.variable} antialiased`}"
    )
    expect(layout).toContain('<body className="font-sans">')
    expect(layout).toContain("<ThemeProvider>")
    expect(layout).toContain("<Toaster")
    expect(sonner).toContain('theme={theme as ToasterProps["theme"]}')
    expect(sonner).toContain("--normal-bg")
  })

  it("exposes shared layout shells while preserving server access gates", () => {
    for (const shell of [
      "components/layout/marketing-layout.tsx",
      "components/layout/merchant-app-shell.tsx",
      "components/layout/admin-shell.tsx",
      "components/layout/customer-shell.tsx",
    ]) {
      expect(existsSync(shell)).toBe(true)
    }

    const merchantLayout = readProjectFile("app/app/layout.tsx")
    expect(merchantLayout).toContain("getCurrentUser")
    expect(merchantLayout).toContain('redirect("/login?next=/app")')
    expect(merchantLayout).toContain("MerchantAppShell")
    expect(merchantLayout).toContain("signOutAction")
    expect(merchantLayout).not.toContain('"use client"')

    const merchantShell = readProjectFile(
      "components/layout/merchant-app-shell.tsx"
    )
    for (const href of [
      'href: "/app"',
      'href: "/app/launch"',
      'href: "/app/customers"',
      'href: "/app/billing"',
      'href: "/app/settings"',
    ]) {
      expect(merchantShell).toContain(href)
    }
    expect(merchantShell).toContain("<form action={signOutAction}>")

    const launchHub = readProjectFile("app/app/launch/page.tsx")
    for (const marker of [
      "CardPanel",
      "VenuePanel",
      "QrPanel",
      'id: "card"',
      'id: "venue"',
      'id: "qr"',
      "/app/launch?tab=",
    ]) {
      expect(launchHub).toContain(marker)
    }
    for (const deletedPage of [
      "app/app/card/page.tsx",
      "app/app/staff/page.tsx",
      "app/app/qr/page.tsx",
    ]) {
      expect(existsSync(deletedPage)).toBe(false)
    }

    const nextConfigSource = readProjectFile("next.config.ts")
    for (const fragment of [
      "async redirects()",
      'source: "/app/card"',
      'destination: "/app/launch?tab=card"',
      'source: "/app/qr"',
      "permanent: true",
    ]) {
      expect(nextConfigSource).toContain(fragment)
    }

    expect(nextConfigSource).not.toContain('source: "/app/staff"')

    const adminLayout = readProjectFile("app/admin/layout.tsx")
    expect(adminLayout).toContain("getAdminAccess")
    expect(adminLayout).toContain('access.status !== "allowed"')
    expect(adminLayout).toContain("AdminShell")
    expect(adminLayout).not.toContain('"use client"')

    const adminShell = readProjectFile("components/layout/admin-shell.tsx")
    for (const href of [
      'href: "/admin/pilot"',
      'href: "/admin/merchants"',
      'href: "/admin/customers"',
      'href: "/admin/billing"',
      'href: "/admin/privacy"',
      'href: "/admin/fraud"',
      'href: "/admin/audit"',
    ]) {
      expect(adminShell).toContain(href)
    }
    expect(adminShell).toContain(
      "MFA enforcement is enabled for this admin session."
    )

    const shellNavigation = readProjectFile(
      "components/layout/shell-navigation.tsx"
    )
    expect(shellNavigation).toContain("SheetTitle")
    expect(shellNavigation).toContain("aria-current")
    expect(shellNavigation).toContain("usePathname")
  })

  it("centralizes brand hierarchy and initial domain primitives", () => {
    const brandIndex = readProjectFile("components/brand/index.ts")
    for (const component of [
      "Logo",
      "Eyebrow",
      "PageTitle",
      "SectionHeader",
      "MetricTile",
      "EmptyState",
    ]) {
      expect(brandIndex).toContain(component)
    }

    const brandTypography = readProjectFile("components/brand/typography.tsx")
    expect(brandTypography).toContain("numeric-tabular")
    expect(brandTypography).toContain("<h1")
    expect(brandTypography).toContain("<h2")
    expect(brandTypography).toContain("EmptyTitle")

    const loyaltyIndex = readProjectFile("components/loyalty/index.ts")
    for (const component of [
      "StampGrid",
      "StampDot",
      "ProgressTrack",
      "RewardTeaser",
      "QrFrame",
      "StatusBanner",
    ]) {
      expect(loyaltyIndex).toContain(component)
    }
    expect(readProjectFile("components/loyalty/qr-frame.tsx")).toContain(
      "bg-white"
    )
    expect(readProjectFile("components/loyalty/stamp-grid.tsx")).toContain(
      "aria-label"
    )

    const formIndex = readProjectFile("components/forms/index.ts")
    expect(formIndex).toContain("FormField")
    expect(formIndex).toContain("FormMessage")
    expect(formIndex).toContain("OtpInput")

    const dataIndex = readProjectFile("components/data/index.ts")
    expect(dataIndex).toContain("DataTable")
    expect(dataIndex).toContain("ActivityFeed")
    expect(dataIndex).toContain("FunnelChart")
  })
})
