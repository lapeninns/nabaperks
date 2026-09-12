/** Exact excerpts only; the complete merchant text is always rendered as well.
 * Unknown wording stays in the full terms rather than acquiring an inferred rule.
 */
export function offerTermExcerpts(terms: string | null | undefined) {
  const sentences =
    terms?.match(/[^.!?\n]+(?:[.!?]+|$)/g)?.map((part) => part.trim()) ?? []
  return {
    scope: sentences
      .filter((sentence) => /\b(?:shared|group) bill\b/i.test(sentence))
      .join(" "),
    identification: sentences
      .filter((sentence) => /\b(?:student|students|staff)\b/i.test(sentence))
      .join(" "),
  }
}

export function offerClaimHeadline(
  stamps: number | null,
  percent: number | null
): string {
  if (stamps && percent)
    return `${offerStampWord(stamps)} and ${percent}% off to start with`
  if (stamps) return `${offerStampWord(stamps)} to start your card`
  if (percent) return `${percent}% off when you join`
  return "An offer for joining"
}

export function offerStampWord(count: number): string {
  return count === 1 ? "One bonus stamp" : `${count} bonus stamps`
}
