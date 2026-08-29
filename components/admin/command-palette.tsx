"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { Dialog as DialogPrimitive } from "radix-ui"
import { Search01Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { adminNavItems } from "@/components/layout/console-nav"
import { buildLookupHref } from "@/lib/admin/lookup-query"
import { cn } from "@/lib/utils"

/**
 * Cmd-K over the admin console (ADM 04#6).
 *
 * The finding's other clauses are done — every list route has a lookup, a
 * paginator and a total, and the five with a lookup keep it on screen while the
 * list scrolls. This is the last one: "add a Cmd-K palette over the same query
 * params".
 *
 * Two deliberate limits:
 *
 * - The routes come from `adminNavItems`, the same array the sidebar renders,
 *   so the palette cannot list a route that does not exist or miss one that
 *   does. No second source of truth.
 * - Typing a term and choosing a venue-searchable route carries the term
 *   through as `?venue=`, which is what "over the same query params" means. The
 *   routes that have no venue dimension just navigate.
 */
const VENUE_SEARCHABLE = new Set([
  "/admin/merchants",
  "/admin/audit",
  "/admin/billing",
  "/admin/referrals",
  "/admin/evidence",
])

export function AdminCommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const listRef = useRef<HTMLUListElement>(null)
  // A keystroke can shrink the list below the stored index for one render, so
  // clamp at read time rather than trusting the stored value.
  const safeActive = (count: number) => Math.min(active, Math.max(0, count - 1))

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "k") return
      if (!event.metaKey && !event.ctrlKey) return
      event.preventDefault()
      setOpen((wasOpen) => !wasOpen)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  const matches = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return adminNavItems
    return adminNavItems.filter((item) =>
      item.label.toLowerCase().includes(term)
    )
  }, [query])

  /**
   * Real hrefs, not `router.push`. An anchor is middle-clickable, shows its
   * destination in the status bar, and — the reason it changed — is assertable:
   * every admin route redirects to /login, so a harness can never prove a push
   * went anywhere, but it can read the href the palette computed.
   */
  function hrefFor(item: (typeof adminNavItems)[number]) {
    const term = query.trim()
    return term && VENUE_SEARCHABLE.has(item.href)
      ? buildLookupHref(item.href, { venue: term })
      : item.href
  }

  function go(index: number) {
    const anchor = document.getElementById(`admin-palette-${index}`)
    if (anchor instanceof HTMLAnchorElement) anchor.click()
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/60" />
        <DialogPrimitive.Content
          aria-label="Admin command palette"
          className="fixed top-[12vh] left-1/2 z-50 grid w-[min(92vw,32rem)] -translate-x-1/2 gap-0 overflow-hidden rounded-lg border-2 border-ink bg-card shadow-lg"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            const input = document.getElementById("admin-palette-input")
            if (input instanceof HTMLInputElement) input.focus()
          }}
        >
          <DialogPrimitive.Title className="sr-only">
            Jump to an admin page
          </DialogPrimitive.Title>
          <div className="flex items-center gap-2 border-b-2 border-ink px-4">
            <Icon
              icon={Search01Icon}
              size={18}
              className="shrink-0 text-muted-foreground"
            />
            <input
              id="admin-palette-input"
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls="admin-palette-list"
              aria-activedescendant={
                matches.length > 0
                  ? `admin-palette-${safeActive(matches.length)}`
                  : undefined
              }
              autoComplete="off"
              placeholder="Jump to a page, or type a venue name"
              value={query}
              onChange={(event) => {
                // Reset the highlight here rather than in an effect keyed on
                // `query`: setState inside an effect triggers a cascading
                // render, which eslint rejects and which would make the
                // highlight flicker on every keystroke.
                setQuery(event.target.value)
                setActive(0)
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  setActive((index) => Math.min(index + 1, matches.length - 1))
                } else if (event.key === "ArrowUp") {
                  event.preventDefault()
                  setActive((index) => Math.max(index - 1, 0))
                } else if (event.key === "Enter") {
                  event.preventDefault()
                  go(safeActive(matches.length))
                }
              }}
              className="min-h-11 w-full bg-transparent py-3 text-base outline-none placeholder:text-muted-foreground"
            />
          </div>
          <ul
            id="admin-palette-list"
            ref={listRef}
            role="listbox"
            aria-label="Admin pages"
            className="max-h-[50vh] overflow-y-auto p-2"
          >
            {matches.length === 0 ? (
              <li className="px-3 py-3 text-sm text-muted-foreground">
                No page matches that.
              </li>
            ) : (
              matches.map((item, index) => (
                <li key={item.href}>
                  <Link
                    href={hrefFor(item)}
                    id={`admin-palette-${index}`}
                    role="option"
                    aria-selected={index === safeActive(matches.length)}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => {
                      setOpen(false)
                      setQuery("")
                    }}
                    className={cn(
                      "focus-ring flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-left text-sm font-bold",
                      index === safeActive(matches.length)
                        ? "bg-secondary text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon icon={item.icon} size={18} className="shrink-0" />
                    {item.label}
                    {query.trim() && VENUE_SEARCHABLE.has(item.href) ? (
                      <span className="mono-meta ml-auto text-muted-foreground">
                        venue: {query.trim()}
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))
            )}
          </ul>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
