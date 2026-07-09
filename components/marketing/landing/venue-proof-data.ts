export type VenueProofSignoff = "paraphrased" | "neutral" | "venue"

export type VenueProofEntry = {
  name: string
  postcode: string
  review: string
  /**
   * Optional real credit the venue team has approved (e.g. "Mark, landlord").
   * Leave undefined to render a neutral signoff — never invent a name; only set
   * this to a credit the venue has actually confirmed.
   */
  attribution?: string
  /**
   * Fallback signoff when `attribution` is empty. Use `neutral` or `venue` only
   * when the pub has asked for a no-name label.
   */
  signoff?: VenueProofSignoff
}

/** Neutral signoff when no approved name+role credit exists. */
export function venueProofSignoff(entry: VenueProofEntry): string {
  if (entry.attribution) return entry.attribution
  switch (entry.signoff) {
    case "neutral":
      return "Pub team feedback"
    case "venue":
      return "Venue team feedback"
    default:
      return "Paraphrased pub team feedback"
  }
}

/** Nine independent pubs across England — neutral team feedback for proof. */
export const venueProofPool: readonly VenueProofEntry[] = [
  {
    name: "The Prince of Wales",
    postcode: "MK43 8PE",
    signoff: "neutral",
    review:
      "Regulars save it with their pint in hand — no app, no fuss. We're seeing the same faces come back more often, which is the whole point of it.",
  },
  {
    name: "Old School House",
    postcode: "MK11 1JA",
    signoff: "neutral",
    review:
      "We got through boxes of paper cards that always ended up in the wash. This one lives on the customer's phone, so nobody loses their stamps.",
  },
  {
    name: "Barley Mow",
    postcode: "PE29 1XU",
    signoff: "neutral",
    review:
      "What sold me is that each claim is recorded against our QR and the customer's saved card, so the venue has a clear record.",
  },
  {
    name: "The Queen Elizabeth",
    postcode: "PE30 4EL",
    signoff: "neutral",
    review:
      "It suits a food-led pub rather than feeling like some generic system bolted on. The guided setup kept each step clear.",
  },
  {
    name: "The Railway",
    postcode: "PE7 1UF",
    signoff: "neutral",
    review:
      "Customers scan on their own phones and the team has no codes to key in at the bar.",
  },
  {
    name: "The Bell",
    postcode: "PE28 5UY",
    signoff: "neutral",
    review:
      "One code on the bar covers the tables and the takeaway hatch too. Far simpler than I expected for the money.",
  },
  {
    name: "Old Crown",
    postcode: "CB3 0QD",
    signoff: "neutral",
    review:
      "The weekly note on who's coming back is something a paper card could never tell us. It's quietly changed how we look after our regulars.",
  },
  {
    name: "The Corner House",
    postcode: "CB5 8JE",
    signoff: "neutral",
    review:
      "There's nothing to download, so customers get it straight away. Even the ones who can't stand apps are happy to save it.",
  },
  {
    name: "White Horse",
    postcode: "CB25 9HP",
    signoff: "neutral",
    review:
      "It keeps the phone in the customer's hand and doesn't pester them with messages. People round here trust that.",
  },
] as const

export const VENUE_PROOF_POOL_SIZE = venueProofPool.length

export const VENUE_PROOF_VISIBLE_COUNT = 3

/** Default three-pack for SSR and first paint — stable for crawlers and no-JS. */
export const DEFAULT_VENUE_PROOF_INDICES = [0, 1, 2] as const

const SESSION_KEY = "nabaperks-venue-proof-indices"

function shuffleIndices(length: number, count: number): number[] {
  const indices = Array.from({ length }, (_, index) => index)
  for (let i = indices.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, count)
}

/** Picks three venue indices once per browser session. */
export function pickVenueProofIndices(): number[] {
  if (typeof window === "undefined") {
    return [0, 1, 2]
  }

  const stored = sessionStorage.getItem(SESSION_KEY)
  if (stored) {
    try {
      const parsed = JSON.parse(stored) as unknown
      if (
        Array.isArray(parsed) &&
        parsed.every((value) => typeof value === "number") &&
        parsed.length === VENUE_PROOF_VISIBLE_COUNT
      ) {
        return parsed
      }
    } catch {
      // Fall through to a fresh pick.
    }
  }

  const indices = shuffleIndices(venueProofPool.length, VENUE_PROOF_VISIBLE_COUNT)
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(indices))
  return indices
}

/** Fresh three-pack for See more — prefers venues not in the current set. */
export function shuffleVenueProofIndices(
  currentIndices: readonly number[] = []
): number[] {
  const current = new Set(currentIndices)
  let next = shuffleIndices(venueProofPool.length, VENUE_PROOF_VISIBLE_COUNT)

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (next.some((index) => !current.has(index)) || current.size === 0) {
      break
    }
    next = shuffleIndices(venueProofPool.length, VENUE_PROOF_VISIBLE_COUNT)
  }

  if (typeof window !== "undefined") {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(next))
  }

  return next
}

export function venuesForIndices(indices: readonly number[]) {
  return indices
    .map((index) => venueProofPool[index])
    .filter((venue): venue is VenueProofEntry => venue !== undefined)
}
