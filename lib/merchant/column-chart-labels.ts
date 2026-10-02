export function selectColumnCaptions({
  width,
  columnGap,
  labelWidths,
  captionGap = 8,
}: {
  readonly width: number
  readonly columnGap: number
  readonly labelWidths: readonly number[]
  readonly captionGap?: number
}): readonly number[] {
  const total = labelWidths.length
  if (total === 0) return []
  if (total === 1) return [0]

  const lastIndex = total - 1
  const lastLeft = width - (labelWidths[lastIndex] ?? 0)
  const columnWidth = (width - columnGap * lastIndex) / total
  const visible = [0]
  let previousRight = labelWidths[0] ?? 0

  for (let index = 1; index < lastIndex; index += 1) {
    const centre = index * (columnWidth + columnGap) + columnWidth / 2
    const halfLabel = (labelWidths[index] ?? 0) / 2
    const left = centre - halfLabel
    const right = centre + halfLabel
    if (left >= previousRight + captionGap && right + captionGap <= lastLeft) {
      visible.push(index)
      previousRight = right
    }
  }

  // At unsupported sub-caption widths, favour the last day over a collision.
  if (lastLeft < previousRight + captionGap) return [lastIndex]
  return [...visible, lastIndex]
}
