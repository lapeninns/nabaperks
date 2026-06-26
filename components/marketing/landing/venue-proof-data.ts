export type VenueProofEntry = {
  name: string
  postcode: string
  review: string
}

/** Lapen Inns venue network — operator quotes for the landing proof ribbon. */
export const venueProofPool: readonly VenueProofEntry[] = [
  {
    name: "The Prince of Wales",
    postcode: "MK43 8PE",
    review:
      "A counter-friendly card customers can save before the coffee cools.",
  },
  {
    name: "Old School House",
    postcode: "MK11 1JA",
    review: "A simple way to bring regulars back without another app.",
  },
  {
    name: "Barley Mow",
    postcode: "PE29 1XU",
    review:
      "Printed QR on the bar, stamps checked server-side, reward terms clear.",
  },
  {
    name: "The Queen Elizabeth",
    postcode: "PE30 4EL",
    review:
      "A loyalty card that suits food-led pub trade, not generic CRM work.",
  },
  {
    name: "The Railway",
    postcode: "PE7 1UF",
    review: "Quick enough for busy service and clear enough for regulars.",
  },
  {
    name: "The Bell",
    postcode: "PE28 5UY",
    review: "One venue QR for the bar, tables, and takeaway counter.",
  },
  {
    name: "Old Crown",
    postcode: "CB3 0QD",
    review: "Receipts, stamps, and rewards that feel like the venue.",
  },
  {
    name: "The Corner House",
    postcode: "CB5 8JE",
    review: "A repeat-visit nudge customers understand without a download.",
  },
  {
    name: "White Horse",
    postcode: "CB25 9HP",
    review: "Local loyalty that keeps the phone in the customer's hand.",
  },
] as const

export const VENUE_PROOF_POOL_SIZE = venueProofPool.length

export const VENUE_PROOF_VISIBLE_COUNT = 3

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
