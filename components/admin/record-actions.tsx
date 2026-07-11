import type { ReactNode } from "react"

import { Disclosure } from "@/components/merchant/launch/disclosure"

/**
 * Collapsed action panel for a single admin record. Dense console lists used
 * to repeat every support form inside every record, which pushed phone pages
 * past ten thousand pixels; folding the forms behind a native disclosure keeps
 * each record a compact summary. Sharing a `group` name makes the browser
 * close the previous record's panel when the next opens (native exclusive
 * accordion), so at most one action panel is expanded at a time.
 */
export function AdminRecordActions({
  label = "Actions",
  group,
  children,
}: {
  label?: ReactNode
  /** Exclusive-accordion group — one open panel per group per page. */
  group: string
  children: ReactNode
}) {
  return (
    <Disclosure label={label} name={group} summaryClassName="min-h-11">
      {children}
    </Disclosure>
  )
}
