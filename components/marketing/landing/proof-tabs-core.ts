export type ProofTabLike = {
  id: string
}

/** Resolve which proof panel is active from chip selection and optional hash. */
export function resolveProofActiveId({
  panels,
  selection,
  hash,
  hashPanelId,
  honorHash = true,
}: {
  panels: readonly ProofTabLike[]
  selection: { forHash: string; id: string } | null
  hash: string
  hashPanelId: string | null
  /** False during SSR/first paint so server and client both default to panel 0. */
  honorHash?: boolean
}): string | null {
  if (panels.length === 0) return null

  const selected =
    selection &&
    selection.forHash === hash &&
    panels.some((panel) => panel.id === selection.id)
      ? selection.id
      : null

  if (selected) return selected

  if (honorHash && hashPanelId) {
    return hashPanelId
  }

  return panels[0]?.id ?? null
}

export function proofPanelIdFromHash(
  panels: readonly ProofTabLike[],
  hash: string
): string | null {
  if (!hash) return null
  return panels.find((panel) => panel.id === hash)?.id ?? null
}
