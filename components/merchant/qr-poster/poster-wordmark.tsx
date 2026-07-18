import { POSTER_BRAND_WORDMARK } from "@/lib/qr/poster-brand"

export { POSTER_BRAND_WORDMARK }

/**
 * Print wordmark for posters. Middle *a* carries the Wet Ink accent.
 */
export function PosterWordmark({
  className,
  accentClassName,
}: {
  readonly className?: string
  readonly accentClassName?: string
}) {
  return (
    <span className={className}>
      Nab <span className={accentClassName}>a</span> Perks
    </span>
  )
}
