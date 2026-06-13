import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const designSystemRoot = "docs/design-system/honey-ink"
const sourceRoot = join(designSystemRoot, "source")

function readDesignSource(path: string) {
  return readFileSync(join(sourceRoot, path), "utf8")
}

describe("Wet Ink design-system source import", () => {
  it("keeps the Honey & Ink package in a stable repo-owned reference folder", () => {
    const designGuide = readFileSync("DESIGN.md", "utf8")
    const eslintConfig = readFileSync("eslint.config.mjs", "utf8")
    const tsConfig = readFileSync("tsconfig.json", "utf8")

    for (const path of [
      "README.md",
      "source/SKILL.md",
      "source/readme.md",
      "source/styles.css",
      "source/_ds_manifest.json",
      "source/_ds_bundle.js",
      "source/_adherence.oxlintrc.json",
      "source/assets/favicon.ico",
    ]) {
      expect(existsSync(join(designSystemRoot, path)), path).toBe(true)
    }

    expect(readFileSync(join(designSystemRoot, "README.md"), "utf8")).toContain(
      "Verbatim source mirror"
    )
    expect(designGuide).toContain("docs/design-system/honey-ink/source")
    expect(eslintConfig).toContain("docs/design-system/honey-ink/source/**")
    expect(tsConfig).toContain("docs/design-system/honey-ink/source/**")
    expect(readDesignSource("readme.md")).toContain("Wet Ink")
    expect(readDesignSource("SKILL.md")).toContain("nabaperks-design")
  })

  it("preserves required tokens, component specimens, templates, and v2 prototype files", () => {
    for (const path of [
      "tokens/fonts.css",
      "tokens/colors.css",
      "tokens/typography.css",
      "tokens/spacing.css",
      "tokens/base.css",
      "tokens/components.css",
      "components/core/InkButton.jsx",
      "components/core/InkButton.d.ts",
      "components/core/InkButton.prompt.md",
      "components/forms/PinPad.jsx",
      "components/forms/OtpBoxes.jsx",
      "components/loyalty/StampRow.jsx",
      "components/loyalty/Seal.jsx",
      "components/surfaces/ReceiptCard.jsx",
      "components/surfaces/Sheet.jsx",
      "components/core/core.card.html",
      "components/forms/forms.card.html",
      "components/loyalty/loyalty.card.html",
      "components/surfaces/surfaces.card.html",
      "templates/customer-stamp-card/CustomerStampCard.dc.html",
      "templates/marketing-hero/MarketingHero.dc.html",
      "templates/merchant-today/MerchantToday.dc.html",
      "ui_kits/customer-app/index.html",
      "ui_kits/marketing/index.html",
      "ui_kits/merchant-app/index.html",
      "v2/README.md",
      "v2/index.html",
      "v2/shared.jsx",
      "v2/customer.jsx",
      "v2/merchant.jsx",
      "v2/marketing.jsx",
      "v2/app.jsx",
      "v2/tweaks-panel.jsx",
      "v2/v2.css",
    ]) {
      expect(existsSync(join(sourceRoot, path)), path).toBe(true)
    }

    expect(readdirSync(join(sourceRoot, "guidelines"))).toHaveLength(11)
    expect(readDesignSource("styles.css")).toContain('@import "./tokens/colors.css"')
  })

  it("keeps transient design-tool byproducts out of the repo mirror", () => {
    for (const path of [".thumbnail", "scraps", "uploads"]) {
      expect(existsSync(join(sourceRoot, path)), path).toBe(false)
    }
  })
})
