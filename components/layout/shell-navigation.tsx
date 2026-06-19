"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { Menu01Icon } from "@hugeicons/core-free-icons"

import { Icon, type IconGlyph } from "@/components/brand"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

export type ShellNavItem = {
  href: string
  label: string
  icon?: IconGlyph
}

/**
 * Pure active-state predicate for a nav item, given the current path. The
 * console roots (`/app`, `/admin`) match exactly so a nested page never lights
 * up the root tab; every nested route matches itself or any deeper child. This
 * is exported so the resolution can be asserted in isolation and reused by the
 * `/dev` preview harness via the `activePath` override.
 */
export function isActivePath(currentPath: string, href: string) {
  if (href === "/app" || href === "/admin") {
    return currentPath === href
  }

  return currentPath === href || currentPath.startsWith(`${href}/`)
}

export function ShellNavigation({
  items,
  secondaryItems,
  secondaryLabel = "Account",
  mobileTitle,
  mobileDescription,
  desktopClassName,
  mobileTriggerClassName = "md:hidden",
  activePath,
}: {
  items: ShellNavItem[]
  secondaryItems?: ShellNavItem[]
  secondaryLabel?: string
  mobileTitle: string
  mobileDescription: string
  desktopClassName?: string
  /**
   * Width at which the mobile Sheet trigger hides — must mirror the breakpoint
   * the caller reveals `desktopClassName` at, so the bar and the trigger swap at
   * the same width. Merchant keeps the `md:hidden` default; admin passes
   * `lg:hidden` to match its `lg:` desktop bar.
   */
  mobileTriggerClassName?: string
  /**
   * Override the path used to compute the active nav item. Defaults to the live
   * `usePathname()`, so the real authenticated shells are unchanged; the `/dev`
   * console previews pass the surface's real route here so the preview
   * highlights the correct item without navigating there.
   */
  activePath?: string
}) {
  const pathname = usePathname()
  const currentPath = activePath ?? pathname
  const secondaryNavItems = secondaryItems ?? []
  const hasSecondary = secondaryNavItems.length > 0

  return (
    <>
      {/*
        Breakpoint contract (kept asymmetric per console, deliberately):
        the desktop pill bars are `hidden` by default and revealed by the
        caller's `desktopClassName` — merchant at `md:` (4 short tabs fit a
        tablet), admin at `lg:` (7 tabs plus operator/MFA chrome need a wider
        rail). The mobile Sheet trigger is the inverse: `mobileTriggerClassName`
        hides it once the matching desktop bar appears, so each console swaps
        between bar and Sheet at the same width and primary nav is never hidden
        behind an unreachable control in the in-between range.
      */}
      {/* Wet Ink pill tab bar — active = ink pill / paper text. */}
      <nav
        aria-label={mobileTitle}
        className={cn(
          "hidden items-center gap-1 rounded-full border-2 border-ink bg-card p-1",
          desktopClassName
        )}
      >
        {items.map((item) => {
          const active = isActivePath(currentPath, item.href)

          return (
            <ShellNavLink
              key={item.href}
              item={item}
              active={active}
              className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
            />
          )
        })}
      </nav>

      {/* Secondary (account) group — visually demoted: dashed chrome, muted ink. */}
      {hasSecondary ? (
        <nav
          aria-label={secondaryLabel}
          className={cn(
            "hidden items-center gap-1 rounded-full border-2 border-dashed border-ink/30 bg-card/60 p-1",
            desktopClassName
          )}
        >
          {secondaryNavItems.map((item) => {
            const active = isActivePath(currentPath, item.href)

            return (
              <ShellNavLink
                key={item.href}
                item={item}
                active={active}
                className="inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
              />
            )
          })}
        </nav>
      ) : null}

      <Sheet>
        <SheetTrigger asChild>
          {/*
            Default `size` keeps the trigger at h-11 (44px) for a comfortable
            thumb target; the visible "Menu" text is the accessible name (the
            leading glyph is decorative via the Icon wrapper). Radix Dialog wires
            the trigger's keyboard activation and the Escape-to-close itself.
          */}
          <Button variant="secondary" className={mobileTriggerClassName}>
            <Icon icon={Menu01Icon} size={16} />
            Menu
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="gap-0">
          <SheetHeader>
            <SheetTitle>{mobileTitle}</SheetTitle>
            <SheetDescription>{mobileDescription}</SheetDescription>
          </SheetHeader>
          <nav aria-label={`${mobileTitle} mobile`} className="grid gap-1 px-6">
            {items.map((item) => {
              const active = isActivePath(currentPath, item.href)

              return (
                <SheetClose key={item.href} asChild>
                  <ShellNavLink
                    item={item}
                    active={active}
                    className="inline-flex min-h-11 w-full items-center justify-start rounded-full px-4 text-sm font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
                    mobile
                  />
                </SheetClose>
              )
            })}
          </nav>

          {hasSecondary ? (
            <nav
              aria-label={`${secondaryLabel} mobile`}
              className="mt-4 grid gap-1 border-t-2 border-ink/15 px-6 pt-4"
            >
              <p className="px-4 pb-1 font-mono text-[11px] font-bold tracking-wide text-muted-foreground uppercase">
                {secondaryLabel}
              </p>
              {secondaryNavItems.map((item) => {
                const active = isActivePath(currentPath, item.href)

                return (
                  <SheetClose key={item.href} asChild>
                    <ShellNavLink
                      item={item}
                      active={active}
                      className="inline-flex min-h-11 w-full items-center justify-start rounded-full px-4 text-sm font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none"
                      mobile
                    />
                  </SheetClose>
                )
              })}
            </nav>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  )
}

function ShellNavLink({
  item,
  active,
  className,
  mobile = false,
}: {
  item: ShellNavItem
  active: boolean
  className: string
  mobile?: boolean
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      data-active={active}
      className={cn(
        className,
        active
          ? "bg-ink text-paper"
          : "text-ink-soft hover:bg-accent hover:text-foreground",
        (mobile || item.icon) && "gap-2"
      )}
    >
      {item.icon ? <Icon icon={item.icon} size={16} /> : null}
      <span className="truncate">{item.label}</span>
      <NavPendingIndicator />
    </Link>
  )
}

function NavPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      className="ml-1 size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity delay-100 duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[pending=true]:opacity-60 motion-reduce:transition-none"
    />
  )
}
