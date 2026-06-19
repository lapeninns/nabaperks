import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"

import {
  buildCustomerFlowPreviewLinks,
  CustomerFlowPreviewScreen,
} from "@/app/dev/customer-flow/preview/screens"
import {
  CUSTOMER_FLOW_PREVIEW_STEPS,
  customerFlowPreviewPath,
  isCustomerFlowPreviewStepId,
} from "@/lib/dev/customer-flow-preview"

describe("customer flow mock preview harness", () => {
  it("defines a preview route and screenshot for every journey capture", () => {
    expect(CUSTOMER_FLOW_PREVIEW_STEPS.length).toBeGreaterThanOrEqual(13)

    for (const step of CUSTOMER_FLOW_PREVIEW_STEPS) {
      expect(isCustomerFlowPreviewStepId(step.id)).toBe(true)
      expect(customerFlowPreviewPath(step.id)).toBe(
        `/dev/customer-flow/preview/${step.id}`
      )
      expect(step.screenshot).toMatch(/\.png$/)
    }
  })

  it("builds unlocked mock preview links for the playbook", () => {
    const links = buildCustomerFlowPreviewLinks()

    expect(links.joinHero).toContain("/dev/customer-flow/preview/join-hero")
    expect(links.cardThree).toContain("card-3-of-3-unlocked")
    expect(links.rewardReady).toContain("reward-ready")
    expect(links.redeemedCard).toContain("card-redeemed")
  })

  it("models stamp confirmation primary actions as preview state transitions", () => {
    const day3 = renderToStaticMarkup(
      createElement(CustomerFlowPreviewScreen, {
        stepId: "stamp-day-3-confirm",
      })
    )

    expect(day3).toContain("/dev/customer-flow/preview/card-3-of-3-unlocked")
  })
})
