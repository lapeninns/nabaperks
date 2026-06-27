"use client"

import Link from "next/link"
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

import type { MarketingNavLink } from "./marketing-layout"

/**
 * Marketing header actions — secondary links collapse into a sheet below `md`
 * so the sticky bar stays one row on narrow phones.
 */
export function MarketingHeaderNav({ links }: { links: MarketingNavLink[] }) {
  return (
    <nav
      aria-label="Marketing"
      className="flex shrink-0 items-center gap-1.5 md:gap-2"
    >
      <div className="hidden items-center gap-2 md:flex">
        {links.map((item) => (
          <Button key={item.href} asChild variant="ghost" size="sm">
            <Link href={item.href}>{item.label}</Link>
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
            <SheetTitle className="font-heading text-lg font-extrabold">
              Menu
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col p-3">
            {links.map((item) => (
              <SheetClose key={item.href} asChild>
                <Button
                  asChild
                  variant="ghost"
                  className="h-11 w-full justify-start"
                >
                  <Link href={item.href}>{item.label}</Link>
                </Button>
              </SheetClose>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  )
}
