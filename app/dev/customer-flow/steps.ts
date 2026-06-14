import type { CustomerFlowPreviewLinks } from "@/app/dev/customer-flow/preview/screens"

type JourneyStepTone = "scan" | "join" | "stamp" | "reward" | "ready"

export type JourneyStep = {
  readonly number: string
  readonly lane: "Customer"
  readonly screenLabel: string
  readonly label: string
  readonly detail: string
  readonly actionHint: string
  readonly href: string | null
  readonly glyph: string
  readonly tone: JourneyStepTone
}

export function customerFlowJourneySteps(
  links: CustomerFlowPreviewLinks
): readonly JourneyStep[] {
  return [
    {
      number: "01",
      lane: "Customer",
      screenLabel: "Scan",
      label: "First stamp waiting",
      detail: "The QR opens the value-first landing before asking for phone.",
      actionHint: "Start from the venue QR.",
      href: links.joinHero,
      glyph: "QR",
      tone: "scan",
    },
    {
      number: "02",
      lane: "Customer",
      screenLabel: "Join",
      label: "Phone, OTP, terms",
      detail: "Claim the first stamp with phone verification and consent.",
      actionHint: "Use the demo phone and OTP from the brief.",
      href: links.join,
      glyph: "OTP",
      tone: "join",
    },
    {
      number: "03",
      lane: "Customer",
      screenLabel: "Stamp",
      label: "Day-one stamp",
      detail:
        "The card opens on the stamp confirmation screen with QR context kept.",
      actionHint: "Add the first self-service stamp.",
      href: links.stampConfirm,
      glyph: "+1",
      tone: "stamp",
    },
    {
      number: "04",
      lane: "Customer",
      screenLabel: "Card",
      label: "Stamped card",
      detail:
        "The live card shows one of three stamps and the sealed mystery reward.",
      actionHint: "Check the card state after day one.",
      href: links.card,
      glyph: "1/3",
      tone: "stamp",
    },
    {
      number: "05",
      lane: "Customer",
      screenLabel: "Return",
      label: "Day-two scan",
      detail: "Reopen the permanent QR after advancing the demo to one stamp.",
      actionHint: "Run Advance 1, then open the QR.",
      href: links.qrStampConfirm,
      glyph: "QR",
      tone: "scan",
    },
    {
      number: "06",
      lane: "Customer",
      screenLabel: "Progress",
      label: "Two stamps down",
      detail: "The same card readout proves progress without a new account.",
      actionHint: "Check the 2 of 3 card state.",
      href: links.cardTwo,
      glyph: "2/3",
      tone: "stamp",
    },
    {
      number: "07",
      lane: "Customer",
      screenLabel: "Unlock",
      label: "Day-three scan",
      detail: "The final QR scan unlocks the mystery reward.",
      actionHint: "Run Advance 2, then open the QR.",
      href: links.qrStampConfirmDay3,
      glyph: "+3",
      tone: "reward",
    },
    {
      number: "08",
      lane: "Customer",
      screenLabel: "Card",
      label: "Reward unlocked",
      detail: "The card shows all stamps and links into the reward screen.",
      actionHint: "Confirm the unlocked card state.",
      href: links.cardThree,
      glyph: "3/3",
      tone: "reward",
    },
    {
      number: "09",
      lane: "Customer",
      screenLabel: "Waiting",
      label: "Reward waiting",
      detail:
        "The next-day redeem rule keeps the reward sealed until the date lands.",
      actionHint: "Open the reward while it is still waiting.",
      href: links.reward,
      glyph: "24H",
      tone: "reward",
    },
    {
      number: "10",
      lane: "Customer",
      screenLabel: "Ready",
      label: "Reward ready",
      detail: "The reward becomes redeemable once the demo clock is moved.",
      actionHint: "Open the redeemable reward screen.",
      href: links.rewardReady,
      glyph: "GO",
      tone: "ready",
    },
    {
      number: "11",
      lane: "Customer",
      screenLabel: "Redeemed",
      label: "Redeemed cycle",
      detail: "The card can be shown with the reward already redeemed.",
      actionHint: "Open the redeemed card view.",
      href: links.redeemedCard,
      glyph: "OK",
      tone: "ready",
    },
  ]
}
