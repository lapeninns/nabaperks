"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu03Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

import type { MarketingNavLink } from "./marketing-layout"

/**
 * Marketing header actions — secondary links collapse into a sheet below `md`
 * so the sticky bar stays one row on narrow phones. Path links carry
 * `aria-current="page"` plus an ink underline on the active route (anchor
 * links on the homepage never match a pathname, so they stay plain).
 */
export function MarketingHeaderNav({ links }: { links: MarketingNavLink[] }) {
  const pathname = usePathname()
  const isActive = (href: string) => href === pathname

  return (
    <nav
      aria-label="Marketing"
      className="flex shrink-0 items-center gap-1.5 md:gap-2"
    >
      <div className="hidden items-center gap-2 md:flex">
        {links.map((item) => (
          <Button
            key={item.href}
            asChild
            variant="ghost"
            size="sm"
            className={cn(
              isActive(item.href) &&
                "font-extrabold underline decoration-ink decoration-2 underline-offset-4"
            )}
          >
            <Link
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
            >
              {item.label}
            </Link>
          </Button>
        ))}
      </div>

      <Button asChild size="sm">
        <Link href="/signup">Start free pilot</Link>
      </Button>

      <Sheet>
        <SheetTrigger asChild>
          <Button
            variant="outline"
            size="icon-sm"
            className="md:hidden"
            aria-label="Open menu"
          >
            <Icon icon={Menu03Icon} size={18} strokeWidth={2.25} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-[min(100%,18rem)] gap-0 border-l-2 border-ink p-0"
        >
          <SheetHeader className="border-b border-ink/10 px-6 py-5 text-left">
            <SheetTitle className="font-heading text-lg">Menu</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col p-3">
            {links.map((item) => (
              <SheetClose key={item.href} asChild>
                <Button
                  asChild
                  variant="ghost"
                  className={cn(
                    "h-11 w-full justify-start",
                    isActive(item.href) &&
                      "font-extrabold underline decoration-ink decoration-2 underline-offset-4"
                  )}
                >
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                  >
                    {item.label}
                  </Link>
                </Button>
              </SheetClose>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
