import { existsSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const designSystemRoot = "docs/design-system/honey-ink"

describe("Wet Ink design-system source import", () => {
  it("keeps production runtime files as the authoritative design system", () => {
    const designGuide = readFileSync("DESIGN.md", "utf8")
    const eslintConfig = readFileSync("eslint.config.mjs", "utf8")
    const tsConfig = readFileSync("tsconfig.json", "utf8")

    for (const path of [
      designSystemRoot,
      `${designSystemRoot}/README.md`,
      "DESIGN.md",
      "app/globals.css",
      "components/customer/customer-flow-system.tsx",
      "components/customer/customer-card-experience.tsx",
      "components/brand/index.ts",
    ]) {
      expect(existsSync(path), path).toBe(true)
    }

    expect(readFileSync(`${designSystemRoot}/README.md`, "utf8")).toContain(
      "source/` mirror was removed"
    )
    expect(designGuide).toContain("production tokens, wrappers, and route composition")
    expect(designGuide).not.toContain("docs/design-system/honey-ink/source")
    expect(eslintConfig).not.toContain("docs/design-system/honey-ink/source/**")
    expect(tsConfig).not.toContain("docs/design-system/honey-ink/source/**")
  })

  it("does not require the old downloaded source mirror", () => {
    expect(existsSync(`${designSystemRoot}/source`)).toBe(false)

    for (const path of [
      "source/_ds_bundle.js",
      "source/_ds_manifest.json",
      "source/readme.md",
      "source/styles.css",
      "source/ui_kits/customer-app/index.html",
    ]) {
      expect(existsSync(`${designSystemRoot}/${path}`), path).toBe(false)
    }
  })

  it("keeps transient design-tool byproducts out of the repo mirror", () => {
    for (const path of [".thumbnail", "scraps", "uploads"]) {
      expect(existsSync(`${designSystemRoot}/${path}`), path).toBe(false)
    }
  })
})
