import { describe, expect, it } from "vitest"

import {
  solutionCardPanel,
  solutionPhaseToPhoneScreen,
  solutionPhaseToStepIndex,
  solutionStoryCopy,
  solutionStoryStepIndex,
  SOLUTION_SAVE_OTP_DIGIT_COUNT,
  SOLUTION_STAMP_TOTAL,
  SOLUTION_STORY_TIMING,
} from "@/components/marketing/use-solution-story-loop"

describe("use-solution-story-loop", () => {
  it("derives the card panel from phase", () => {
    expect(solutionCardPanel("stamping")).toBe("stamps")
    expect(solutionCardPanel("gift")).toBe("gift")
    expect(solutionCardPanel("collect")).toBe("gift")
  })

  it("keeps stamp copy until the gift phase", () => {
    const stamping = solutionStoryCopy({
      phase: "stamping",
      earnedCount: SOLUTION_STAMP_TOTAL,
      stampTotal: SOLUTION_STAMP_TOTAL,
    })

    expect(stamping.activeStep).toBe("stamp")
    expect(stamping.rewardNote).toContain("sealed")

    const gift = solutionStoryCopy({
      phase: "gift",
      earnedCount: SOLUTION_STAMP_TOTAL,
      stampTotal: SOLUTION_STAMP_TOTAL,
    })

    expect(gift.activeStep).toBe("collect")
    expect(gift.rewardNote).toContain("unlocked")
  })

  it("maps phases onto how-it-works steps and phone screens", () => {
    expect(solutionPhaseToStepIndex("scan")).toBe(0)
    expect(solutionPhaseToStepIndex("stamping")).toBe(2)
    expect(solutionPhaseToStepIndex("gift")).toBe(3)
    expect(solutionStoryStepIndex("stamp")).toBe(2)
    expect(solutionStoryStepIndex("collect")).toBe(3)
    expect(solutionPhaseToPhoneScreen("save")).toBe("save")
    expect(solutionPhaseToPhoneScreen("stamping")).toBe("card")
    expect(solutionPhaseToPhoneScreen("collect")).toBe("reward")
  })

  it("holds the save beat long enough for the OTP reveal", () => {
    const revealMs =
      SOLUTION_STORY_TIMING.saveOtpStartDelayMs +
      SOLUTION_SAVE_OTP_DIGIT_COUNT * SOLUTION_STORY_TIMING.saveOtpDigitMs

    expect(SOLUTION_STORY_TIMING.saveHoldMs).toBeGreaterThanOrEqual(revealMs + 240)
    expect(SOLUTION_STORY_TIMING.saveHoldMs).toBeGreaterThanOrEqual(
      SOLUTION_STORY_TIMING.scanHoldMs
    )
  })

  it("uses collection copy on the collect phase", () => {
    const collect = solutionStoryCopy({
      phase: "collect",
      earnedCount: SOLUTION_STAMP_TOTAL,
      stampTotal: SOLUTION_STAMP_TOTAL,
    })

    expect(collect.activeStep).toBe("collect")
    expect(collect.rewardNote).toContain("counter")
  })
})
