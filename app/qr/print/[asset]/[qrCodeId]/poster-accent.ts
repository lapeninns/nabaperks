import { createHash } from "node:crypto"

// ---------------------------------------------------------------------------
// Accent inks
// ---------------------------------------------------------------------------

// Internal — consumers use PosterAccent / resolvePosterAccent, never the key union.
type PosterAccentKey = "vermillion" | "cobalt" | "leaf" | "sun" | "ink"

export type PosterAccent = {
  key: PosterAccentKey
  accent: string
  accentDeep: string
  accentSoft: string
}

// The five Wet Ink spot inks, each resolved to deterministic light-theme hex so
// the printed asset never depends on the reader's theme (the route renders
// outside the themed tree, and the worker has no theme cookie). Base values are
// the repo's --w-* tokens; the codebase ships no -deep/-soft accent tokens, so
// deep is a darker mix and soft is a ~12% tint over paper, in the house manner.
export const POSTER_ACCENTS: Record<PosterAccentKey, PosterAccent> = {
  vermillion: {
    key: "vermillion",
    accent: "#cf330a",
    accentDeep: "#a62908",
    accentSoft: "#f1dacc",
  },
  cobalt: {
    key: "cobalt",
    accent: "#2b43c8",
    accentDeep: "#2236a0",
    accentSoft: "#dedce2",
  },
  leaf: {
    key: "leaf",
    accent: "#16733c",
    accentDeep: "#125c30",
    accentSoft: "#dbe2d2",
  },
  sun: {
    key: "sun",
    accent: "#f5a623",
    accentDeep: "#c4851c",
    accentSoft: "#f6e8cf",
  },
  ink: {
    key: "ink",
    accent: "#211c16",
    accentDeep: "#1a1612",
    accentSoft: "#dcd7cd",
  },
}

// Every ink is selectable via the explicit ?accent= preview override.
const POSTER_ACCENT_KEYS: PosterAccentKey[] = [
  "vermillion",
  "cobalt",
  "leaf",
  "sun",
  "ink",
]

// The per-merchant rotation excludes sun: as an action accent it tints the
// surfaces gold-on-gold (colliding with the fixed reward seal) and its small
// mono eyebrow fails contrast on cream. Sun stays the fixed reward ink, reached
// only via a deliberate ?accent=sun preview. Four inks → 256 % 4 == 0, so the
// hash is perfectly uniform.
const POSTER_ACCENT_HASH_POOL: PosterAccentKey[] = [
  "vermillion",
  "cobalt",
  "leaf",
  "ink",
]

// Stable per-merchant accent: hash the merchant id and index into the rotation,
// mirroring how stored assets derive identity-stable content versions. A
// read-only ?accent= override (any of the five keys) wins for on-demand preview.
export function resolvePosterAccent(
  merchantId: string,
  override?: string | string[]
): PosterAccent {
  // searchParams can deliver string[] for a repeated key; take the first.
  const raw = Array.isArray(override) ? override[0] : override
  const requested =
    typeof raw === "string" ? raw.trim().toLowerCase() : undefined
  if (requested && isPosterAccentKey(requested)) {
    return POSTER_ACCENTS[requested]
  }
  const digest = createHash("sha256").update(merchantId).digest()
  const index = digest[0] % POSTER_ACCENT_HASH_POOL.length
  return POSTER_ACCENTS[POSTER_ACCENT_HASH_POOL[index]]
}

function isPosterAccentKey(value: string): value is PosterAccentKey {
  return (POSTER_ACCENT_KEYS as string[]).includes(value)
}
