import type { ReactNode } from "react"

/**
 * One ✱-led benefit line — the vermillion star (the brand signature, used here as
 * a list mark exactly as the marquee uses it as a separator) plus a bold claim
 * and a plain-spoken explanation. Shared by the venue-benefits and trust lists.
 */
export function BenefitPoint({
  title,
  children,
}: {
  title: ReactNode
  children: ReactNode
}) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-lg leading-snug font-extrabold text-primary"
      >
        ✱
      </span>
      <div>
        <p className="text-[1.05rem] leading-snug font-extrabold">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {children}
        </p>
      </div>
    </li>
  )
}
