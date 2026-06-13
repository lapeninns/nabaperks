"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

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
}

function isActivePath(pathname: string, href: string) {
  if (href === "/app" || href === "/admin") {
    return pathname === href
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

export function ShellNavigation({
  items,
  secondaryItems,
  secondaryLabel = "Account",
  mobileTitle,
  mobileDescription,
  desktopClassName,
}: {
  items: ShellNavItem[]
  secondaryItems?: ShellNavItem[]
  secondaryLabel?: string
  mobileTitle: string
  mobileDescription: string
  desktopClassName?: string
}) {
  const pathname = usePathname()
  const hasSecondary = Boolean(secondaryItems && secondaryItems.length > 0)

  return (
    <>
      {/* Wet Ink pill tab bar — active = ink pill / paper text. */}
      <nav
        aria-label={mobileTitle}
        className={cn(
          "hidden items-center gap-1 rounded-full border-2 border-ink bg-card p-1",
          desktopClassName
        )}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                active
                  ? "bg-ink text-paper"
                  : "text-ink-soft hover:bg-accent hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
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
          {secondaryItems!.map((item) => {
            const active = isActivePath(pathname, item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
                  active
                    ? "bg-ink text-paper"
                    : "text-ink-soft hover:bg-accent hover:text-foreground"
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <Sheet>
        <SheetTrigger asChild>
          <Button variant="secondary" className="md:hidden">
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
              const active = isActivePath(pathname, item.href)

              return (
                <SheetClose key={item.href} asChild>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    data-active={active}
                    className="justify-start inline-flex min-h-11 w-full items-center rounded-full px-4 text-sm font-bold text-ink-soft transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 data-[active=true]:bg-ink data-[active=true]:text-paper"
                  >
                    {item.label}
                  </Link>
                </SheetClose>
              )
            })}
          </nav>

          {hasSecondary ? (
            <nav
              aria-label={`${secondaryLabel} mobile`}
              className="mt-4 grid gap-1 border-t-2 border-ink/15 px-6 pt-4"
            >
              <p className="px-4 pb-1 font-mono text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                {secondaryLabel}
              </p>
              {secondaryItems!.map((item) => {
                const active = isActivePath(pathname, item.href)

                return (
                  <SheetClose key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      data-active={active}
                      className="justify-start inline-flex min-h-11 w-full items-center rounded-full px-4 text-sm font-bold text-ink-soft transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/35 data-[active=true]:bg-ink data-[active=true]:text-paper"
                    >
                      {item.label}
                    </Link>
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
