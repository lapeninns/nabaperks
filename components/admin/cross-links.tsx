import Link from "next/link"

import { Button } from "@/components/ui/button"

export type AdminCrossLink = {
  readonly label: string
  readonly href: string
}

/**
 * Row-level cross-links for the admin tables (merchants, billing). Both pages
 * previously hand-rolled the same string — `text-xs` primary underline with
 * `focus-ring rounded-sm` and a `color-mix` hover — giving four adjacent ~16px
 * targets with no coarse-pointer floor, in the one column that should read as
 * identity. `Button variant="link" size="xs"` already carries the 44px coarse
 * floor, the focus recipe and the hover treatment, so the links are real
 * controls and the recipe lives in one place.
 */
export function AdminCrossLinks({
  label,
  links,
}: {
  /** Accessible name for the group, e.g. "The Old Crown related records". */
  readonly label: string
  readonly links: readonly AdminCrossLink[]
}) {
  return (
    <span
      role="group"
      aria-label={label}
      className="-mx-3 flex flex-wrap items-center"
    >
      {links.map((link) => (
        <Button key={link.href} asChild variant="link" size="xs">
          <Link href={link.href}>{link.label}</Link>
        </Button>
      ))}
    </span>
  )
}
