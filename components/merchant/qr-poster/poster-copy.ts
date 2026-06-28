export type PosterCopy = {
  readonly unlockLine: string
  readonly mysteryLine: string
  readonly compactLine: string
  readonly firstStampLine: string
  readonly progressLabel: string
  readonly secondStepTitle: string
  readonly secondStepBody: string
  readonly revealBody: string
  readonly ticketVisitLabel: string
}

export const FALLBACK_URL = "join.nabaperks.com"

const REFERENCE_COPY: PosterCopy = {
  unlockLine: "Collect three stamps and a reward unlocks",
  mysteryLine:
    "Could be small. Could be a proper treat. You won't know till it opens.",
  compactLine:
    "Three stamps unlocks a reward — and every card wins. Could be small. Could be a proper treat.",
  firstStampLine: "Your first stamp is on us",
  progressLabel: "One of three · the first is free",
  secondStepTitle: "Visit twice more",
  secondStepBody: "One tap a visit. We keep the count for you.",
  revealBody: "Three visits and the seal breaks.",
  ticketVisitLabel: "Visit three times",
}

export function getPosterCopy(stampsRequired: number): PosterCopy {
  const stampCount = Math.max(1, stampsRequired)

  if (stampCount === 3) {
    return REFERENCE_COPY
  }

  const stampCopy = stampCount === 1 ? "one stamp" : `${stampCount} stamps`
  return {
    unlockLine: `Collect ${stampCopy} and a reward unlocks`,
    mysteryLine:
      "Could be small. Could be a proper treat. You won't know till it opens.",
    compactLine: `${capitalize(stampCopy)} unlocks a reward — and every card wins. Could be small. Could be a proper treat.`,
    firstStampLine: "Your first stamp is on us",
    progressLabel: `One of ${stampCount} · the first is free`,
    secondStepTitle: stampCount === 1 ? "Break the seal" : "Visit again",
    secondStepBody: "One tap a visit. We keep the count for you.",
    revealBody: `${capitalize(stampCopy)} and the seal breaks.`,
    ticketVisitLabel: `Visit ${stampCount} times`,
  }
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}
