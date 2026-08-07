import Link from "next/link"
import Form from "next/form"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { AdminField } from "@/components/admin/support"
import { Icon } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { AdminLookupState, AdminPageMeta } from "@/lib/admin/lookup-query"
import {
  buildLookupHref,
  nextPage,
  previousPage,
} from "@/lib/admin/lookup-query"

const numberFormat = new Intl.NumberFormat("en-GB")

/**
 * Member lookup form (admin member lookup): venue and contact fragments as
 * GET query params, so every result view is linkable and the server does the
 * filtering. Submitting resets to page 1 by design; `next/form` keeps the
 * navigation client-side with full progressive enhancement.
 */
export function AdminLookupControls({
  basePath,
  lookup,
  label = "Member lookup",
  fields = "venue-and-contact",
  hiddenParams,
}: {
  readonly basePath: string
  readonly lookup: AdminLookupState
  readonly label?: string
  /**
   * Lists without a customer dimension (merchants) search by venue only;
   * lists with no venue dimension (unaffiliated customers) by contact only.
   */
  readonly fields?: "venue-and-contact" | "venue" | "contact"
  /**
   * Params the GET submit must carry through (e.g. the active view), since a
   * `next/form` submit rebuilds the query string from the form's own fields.
   */
  readonly hiddenParams?: Readonly<Record<string, string | undefined>>
}) {
  const withVenue = fields !== "contact"
  const withContact = fields !== "venue"
  const active = Boolean(
    (withVenue && lookup.venue) || (withContact && lookup.contact)
  )

  return (
    <Form
      action={basePath}
      role="search"
      aria-label={label}
      className={
        withVenue && withContact
          ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
          : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
      }
    >
      {Object.entries(hiddenParams ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null
      )}
      {withVenue ? (
        <AdminField label="Venue">
          <Input
            type="search"
            name="venue"
            defaultValue={lookup.venue ?? ""}
            placeholder="Business name"
            autoComplete="off"
          />
        </AdminField>
      ) : null}
      {withContact ? (
        <AdminField label="Member contact">
          <Input
            type="search"
            name="contact"
            defaultValue={lookup.contact ?? ""}
            placeholder="Email or phone fragment"
            autoComplete="off"
          />
        </AdminField>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {/* A service-role readback can take a second; without a pending
            affordance the operator re-submits. */}
        <SubmitButton pendingLabel="Searching…">
          <Icon icon={Search01Icon} size={16} />
          Search
        </SubmitButton>
        {/* Clear always occupies its slot — it used to appear and disappear
            with the filter, so the button row width changed as the operator
            searched. */}
        {active ? (
          <Button asChild variant="ghost">
            <Link href={buildLookupHref(basePath, hiddenParams ?? {})}>
              Clear
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" disabled>
            Clear
          </Button>
        )}
      </div>
    </Form>
  )
}

/**
 * The applied lookup, shown where the results are. The privacy page's second
 * list was filtered by a control thousands of pixels above it that visually
 * belonged to another panel — the only signpost was a sentence — so an empty
 * result read as "no such customer". Each chip removes just its own term.
 */
export function AdminAppliedFilters({
  basePath,
  lookup,
  extraParams,
}: {
  readonly basePath: string
  readonly lookup: AdminLookupState
  /** Params to preserve when a term is removed (e.g. the active view). */
  readonly extraParams?: Record<string, string | number | undefined>
}) {
  const terms = [
    { key: "venue" as const, label: "Venue", value: lookup.venue },
    { key: "contact" as const, label: "Contact", value: lookup.contact },
  ].filter((term) => Boolean(term.value))

  if (terms.length === 0) return null

  return (
    <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
      <span>Filtered by</span>
      {terms.map((term) => (
        <Button
          key={term.key}
          asChild
          variant="secondary"
          size="xs"
          title={`Remove the ${term.label.toLowerCase()} filter`}
        >
          <Link
            href={buildLookupHref(basePath, {
              ...extraParams,
              venue: term.key === "venue" ? undefined : lookup.venue,
              contact: term.key === "contact" ? undefined : lookup.contact,
            })}
          >
            <span className="min-w-0 truncate">
              {term.label}: {term.value}
            </span>
            <Icon icon={Cancel01Icon} size={14} />
          </Link>
        </Button>
      ))}
    </p>
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
