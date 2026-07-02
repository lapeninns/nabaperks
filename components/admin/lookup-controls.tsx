import Link from "next/link"
import Form from "next/form"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { AdminField } from "@/components/admin/support"
import { Icon } from "@/components/brand"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminLookupState, AdminPageMeta } from "@/lib/admin/lookup-query"
import { nextPage, previousPage } from "@/lib/admin/lookup-query"

const numberFormat = new Intl.NumberFormat("en-GB")

/**
 * Member lookup form (MS-admin-member-lookup): venue and contact fragments as
 * GET query params, so every result view is linkable and the server does the
 * filtering. Submitting resets to page 1 by design; `next/form` keeps the
 * navigation client-side with full progressive enhancement.
 */
export function AdminLookupControls({
  basePath,
  lookup,
  label = "Member lookup",
}: {
  readonly basePath: string
  readonly lookup: AdminLookupState
  readonly label?: string
}) {
  const active = Boolean(lookup.venue || lookup.contact)

  return (
    <Form
      action={basePath}
      role="search"
      aria-label={label}
      className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
    >
      <AdminField label="Venue">
        <Input
          type="search"
          name="venue"
          defaultValue={lookup.venue ?? ""}
          placeholder="Business name"
          autoComplete="off"
        />
      </AdminField>
      <AdminField label="Member contact">
        <Input
          type="search"
          name="contact"
          defaultValue={lookup.contact ?? ""}
          placeholder="Email or phone fragment"
          autoComplete="off"
        />
      </AdminField>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">
          <Icon icon={Search01Icon} size={16} />
          Search
        </Button>
        {active ? (
          <Button asChild variant="ghost">
            <Link href={basePath}>Clear</Link>
          </Button>
        ) : null}
      </div>
    </Form>
  )
}

/**
 * Pagination for the admin lookup lists: a readable total plus Previous/Next
 * links built from query params, so any record beyond the first page stays
 * reachable and linkable (R2).
 */
export function AdminLookupPagination({
  label,
  unit,
  meta,
  hrefForPage,
}: {
  readonly label: string
  readonly unit: string
  readonly meta: AdminPageMeta
  readonly hrefForPage: (page: number) => string
}) {
  if (meta.total === 0) return null

  const previous = previousPage(meta)
  const next = nextPage(meta)
  if (previous === null && next === null && meta.pageCount <= 1) {
    return (
      <p className="text-sm text-muted-foreground">
        <span className="numeric-tabular">
          {numberFormat.format(meta.total)}
        </span>{" "}
        {unit}
      </p>
    )
  }

  return (
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground">
        <span className="numeric-tabular">
          {numberFormat.format(meta.total)}
        </span>{" "}
        {unit} · page{" "}
        <span className="numeric-tabular">
          {numberFormat.format(meta.page)}
        </span>{" "}
        of{" "}
        <span className="numeric-tabular">
          {numberFormat.format(meta.pageCount)}
        </span>
      </p>
      <div className="flex gap-2">
        {previous !== null ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={hrefForPage(previous)} rel="prev">
              Previous
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
        )}
        {next !== null ? (
          <Button asChild variant="secondary" size="sm">
            <Link href={hrefForPage(next)} rel="next">
              Next
            </Link>
          </Button>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </nav>
  )
}

/**
 * Inline themed read-failure state (R4): a lookup that fails server-side
 * renders this inside its panel instead of throwing into the segment error
 * boundary, so the console shell and the other panels stay usable.
 */
export function AdminLookupErrorState({
  title,
  children,
}: {
  readonly title: string
  readonly children?: string
}) {
  return (
    <StatusBanner tone="error" title={title}>
      {children ??
        "The lookup could not be loaded safely. Adjust the search or retry; other console panels stay available."}
    </StatusBanner>
  )
}
