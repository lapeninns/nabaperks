import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { AdminRecordCard } from "@/components/admin/record-card"

describe("AdminRecordCard", () => {
  it("renders the title, eyebrow, status, every field label/value, and the action", () => {
    const html = renderToStaticMarkup(
      createElement(AdminRecordCard, {
        eyebrow: "QR-1A2B",
        title: "Old Crown Girton",
        status: createElement("span", { "data-status": "active" }, "active"),
        fields: [
          { label: "Merchant", value: "Old Crown Girton" },
          { label: "Created", value: "6 Jun 2026", mono: true },
        ],
        action: createElement(
          "button",
          { "data-action": "regenerate" },
          "Regenerate QR"
        ),
      })
    )

    // Primary identifier.
    expect(html).toContain("Old Crown Girton")
    // Eyebrow / code above the title.
    expect(html).toContain("QR-1A2B")
    // Status node.
    expect(html).toContain('data-status="active"')
    expect(html).toContain("active")
    // Every field label is present.
    expect(html).toContain("Merchant")
    expect(html).toContain("Created")
    // Every field value is present.
    expect(html).toContain("6 Jun 2026")
    // The action node is rendered (reachable without horizontal scroll).
    expect(html).toContain('data-action="regenerate"')
    expect(html).toContain("Regenerate QR")
  })

  it("renders without crashing when status and action are omitted, keeping title and fields", () => {
    const html = renderToStaticMarkup(
      createElement(AdminRecordCard, {
        title: "The Eagle",
        fields: [{ label: "Account", value: "active" }],
      })
    )

    expect(html).toContain("The Eagle")
    expect(html).toContain("Account")
    expect(html).toContain("active")
  })
})
