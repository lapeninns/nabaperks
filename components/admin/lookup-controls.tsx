import type { ReactNode } from "react"

import Link from "next/link"
import Form from "next/form"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"

import { AdminField } from "@/components/admin/support"
import { Icon } from "@/components/brand"
import { SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty/status-banner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { SelectField } from "@/components/forms"
import type { AdminLookupState, AdminPageMeta } from "@/lib/admin/lookup-query"
import {
  ADMIN_LOOKUP_PAGE_SIZE,
  ADMIN_LOOKUP_PAGE_SIZES,
  buildLookupHref,
  nextPage,
  previousPage,
} from "@/lib/admin/lookup-query"

const numberFormat = new Intl.NumberFormat("en-GB")

/** The first rows-per-page choice, i.e. the smallest window on offer. */
const SMALLEST_PAGE_SIZE = ADMIN_LOOKUP_PAGE_SIZES[0]

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
  sticky,
  withDateRange = false,
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
  /**
   * Keep the search reachable while a long list scrolls (ADM 04#6). At 100 rows
   * the shared DataTable is roughly 6,900px — about 7.7 viewport heights — so a
   * search that only exists at the top of the page is a search an operator has
   * to scroll back to.
   *
   * Sticky, not a shell-level bar: the admin shell's SidebarInset declares no
   * overflow, so the nearest scrollport is the viewport and this sticks against
   * it. Verified in a browser before shipping, because 04#26 is a standing
   * reminder that sticky inside an `overflow-hidden` ancestor silently does
   * nothing.
   */
  readonly sticky?: "flush" | "padded"
  /**
   * Add an inclusive `from`/`to` date pair (04#26). Off by default, so the
   * five lists that do not ask a date question render exactly the form they
   * rendered before. An audit trail is the one that cannot do without it:
   * "what did operator X do to venue Y last Tuesday" is unanswerable with a
   * name fragment alone.
   */
  readonly withDateRange?: boolean
}) {
  const withVenue = fields !== "contact"
  const withContact = fields !== "venue"
  const active = Boolean(
    (withVenue && lookup.venue) ||
      (withContact && lookup.contact) ||
      (withDateRange && (lookup.from || lookup.to))
  )

  return (
    <Form
      action={basePath}
      role="search"
      aria-label={label}
      className={cn(
        // The date pair makes the row four controls wide, which does not fit
        // the fixed two/three-column template; it wraps on its own axis
        // instead of squeezing the search fields to nothing.
        withDateRange
          ? "flex flex-wrap items-end gap-3"
          : withVenue && withContact
            ? "grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
            : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end",
        // Must be a DIRECT child of the AdminPanel: sticky is bound by its
        // containing block, so inside the ~174px AdminPanelHeader the bar
        // unsticks almost immediately (measured at -1225px).
        //
        // `flush` panels have no padding, so the bar supplies its own.
        // `padded` panels already have p-5, so the bar cancels the horizontal
        // padding to stay full-bleed rather than sitting in a 40px inset.
        sticky && "sticky top-0 z-20 border-b-2 border-ink bg-card py-4",
        sticky === "flush" && "px-5",
        sticky === "padded" && "-mx-5 px-5"
      )}
    >
      {Object.entries(hiddenParams ?? {}).map(([name, value]) =>
        value ? (
          <input key={name} type="hidden" name={name} value={value} />
        ) : null
      )}
      {/* A next/form submit rebuilds the query string from this form's own
          fields, so a non-default rows-per-page would be silently reset by
          every search. The default stays out of the URL. */}
      {lookup.size !== ADMIN_LOOKUP_PAGE_SIZE ? (
        <input type="hidden" name="size" value={String(lookup.size)} />
      ) : null}
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
      {withDateRange ? (
        <>
          {/* Native date inputs: this form is a plain GET that works with no
              JavaScript, and the browser's own picker is the one control an
              operator already knows. `max`/`min` cross-bind the pair so the
              picker itself refuses a backwards range; the server swaps one
              anyway, because a typed URL is not bound by the widget. */}
          <AdminField label="From">
            <Input
              type="date"
              name="from"
              defaultValue={lookup.from ?? ""}
              max={lookup.to ?? undefined}
              className="w-44"
            />
          </AdminField>
          <AdminField label="To">
            <Input
              type="date"
              name="to"
              defaultValue={lookup.to ?? ""}
              min={lookup.from ?? undefined}
              className="w-44"
            />
          </AdminField>
        </>
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
            <Link
              href={buildLookupHref(basePath, {
                ...hiddenParams,
                size: lookup.size,
              })}
            >
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
    { key: "from" as const, label: "From", value: lookup.from },
    { key: "to" as const, label: "To", value: lookup.to },
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
              from: term.key === "from" ? undefined : lookup.from,
              to: term.key === "to" ? undefined : lookup.to,
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
  // The rows-per-page control has to stay reachable at 50 or 100 rows on a
  // list that now fits one page — otherwise the operator cannot get back to
  // 25. So the plain-count branch is only taken when the smallest page size
  // would also be one page.
  if (
    previous === null &&
    next === null &&
    meta.pageCount <= 1 &&
    meta.total <= SMALLEST_PAGE_SIZE
  ) {
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
    // Count and controls sit together on the right rather than at opposite
    // ends of a panel that can be 900px wide — the eye had to cross the whole
    // panel to confirm the page after every press.
    <nav
      aria-label={label}
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2"
    >
      <p className="mr-auto text-sm text-muted-foreground">
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
      <div className="flex flex-wrap items-center gap-2">
        {/* First/last matter here: 25 rows per page against a 999-page ceiling
            meant reaching the end of a list took one round trip per page. */}
        <PageLink
          href={hrefForPage(1)}
          disabled={meta.page <= 1}
          label="First page"
        >
          First
        </PageLink>
        <PageLink
          href={previous !== null ? hrefForPage(previous) : "#"}
          disabled={previous === null}
          rel="prev"
          label="Previous page"
        >
          Previous
        </PageLink>
        <PageLink
          href={next !== null ? hrefForPage(next) : "#"}
          disabled={next === null}
          rel="next"
          label="Next page"
        >
          Next
        </PageLink>
        <PageLink
          href={hrefForPage(meta.pageCount)}
          disabled={meta.page >= meta.pageCount}
          label="Last page"
        >
          Last
        </PageLink>
        {/* Jump straight to a page. First/Last cut the worst case, but with 25
            rows against a 999-page ceiling the middle of a long list was still
            a walk (04#56).

            A plain GET `next/form` rather than a client control: this is a
            server component, the destination is the same link these buttons
            already produce, and the page number belongs in the URL. It works
            with JS off, like AdminConfirmCheck.

            The other params ride as hidden fields because a next/form submit
            rebuilds the query string from the form's own inputs — the same
            reason AdminLookupForm takes `hiddenParams`. They are derived from
            the href the pagination is already given, so there is no new prop
            and nothing for a caller to forget. */}
        {meta.pageCount > 2 ? (
          <Form
            action={pageFormAction(hrefForPage)}
            className="flex items-center gap-2"
          >
            {pageFormHiddenParams(hrefForPage).map(([name, value]) => (
              <input key={name} type="hidden" name={name} value={value} />
            ))}
            <label
              htmlFor="admin-page-jump"
              className="mono-meta whitespace-nowrap text-muted-foreground"
            >
              Go to
            </label>
            <Input
              id="admin-page-jump"
              type="number"
              name="page"
              min={1}
              max={meta.pageCount}
              defaultValue={meta.page}
              aria-label={`Go to page, 1 to ${meta.pageCount}`}
              className="numeric-tabular h-9 w-20"
            />
            <Button type="submit" size="sm" variant="secondary">
              Go
            </Button>
          </Form>
        ) : null}
        <RowsPerPage meta={meta} hrefForPage={hrefForPage} />
      </div>
    </nav>
  )
}

/**
 * Rows per page (04#56), as a `size` query param on the same GET/link model
 * as the rest of this paginator: a plain `next/form` that works with JS off,
 * with a no-JS submit button rather than an onChange handler.
 *
 * It resets EVERY page param, not just this list's. A page can carry several
 * independent paginators (merchants: `page` + `qrPage`; privacy: `page` +
 * `consentPage` + `unaffiliatedPage`), and page 7 of the other list is not
 * page 7 once the window changes size.
 */
function RowsPerPage({
  meta,
  hrefForPage,
}: {
  readonly meta: AdminPageMeta
  readonly hrefForPage: (page: number) => string
}) {
  const selectId = `admin-rows-per-page-${pageFormAction(hrefForPage).replaceAll("/", "-")}`

  return (
    <Form
      action={pageFormAction(hrefForPage)}
      className="flex items-center gap-2"
    >
      {pageFormHiddenParams(hrefForPage)
        .filter(([name]) => !/page$/i.test(name) && name !== "size")
        .map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      <label
        htmlFor={selectId}
        className="mono-meta whitespace-nowrap text-muted-foreground"
      >
        Rows
      </label>
      <SelectField
        id={selectId}
        name="size"
        defaultValue={String(meta.pageSize)}
        aria-label="Rows per page"
        className="numeric-tabular h-9 w-24 pr-9 pl-3"
      >
        {ADMIN_LOOKUP_PAGE_SIZES.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </SelectField>
      <Button type="submit" size="sm" variant="secondary">
        Apply
      </Button>
    </Form>
  )
}

/**
 * The path a page link points at, without its query string — the action for the
 * page-jump form. Derived from `hrefForPage` so the pagination needs no extra
 * prop and cannot be pointed at the wrong route by a caller.
 */
function pageFormAction(hrefForPage: (page: number) => string): string {
  return hrefForPage(1).split("?")[0] ?? ""
}

/** Every query param except `page`, to re-submit as hidden fields. */
function pageFormHiddenParams(
  hrefForPage: (page: number) => string
): ReadonlyArray<readonly [string, string]> {
  const query = hrefForPage(1).split("?")[1] ?? ""

  return Array.from(new URLSearchParams(query).entries()).filter(
    ([name]) => name !== "page"
  )
}

function PageLink({
  href,
  disabled,
  rel,
  label,
  children,
}: {
  readonly href: string
  readonly disabled: boolean
  readonly rel?: string
  /** Accessible name — "Next" alone is ambiguous with several paginators. */
  readonly label: string
  readonly children: ReactNode
}) {
  if (disabled) {
    return (
      <Button variant="secondary" size="sm" disabled aria-label={label}>
        {children}
      </Button>
    )
  }

  return (
    <Button asChild variant="secondary" size="sm">
      <Link href={href} rel={rel} aria-label={label}>
        {children}
      </Link>
    </Button>
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
