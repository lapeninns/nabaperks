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
  mobileTitle,
  mobileDescription,
  desktopClassName,
}: {
  items: ShellNavItem[]
  mobileTitle: string
  mobileDescription: string
  desktopClassName?: string
}) {
  const pathname = usePathname()

  return (
    <>
      <nav
        aria-label={mobileTitle}
        className={cn("hidden items-center gap-1", desktopClassName)}
      >
        {items.map((item) => {
          const active = isActivePath(pathname, item.href)

          return (
            <Button
              key={item.href}
              asChild
              variant={active ? "secondary" : "ghost"}
              size="sm"
              aria-current={active ? "page" : undefined}
            >
              <Link href={item.href}>{item.label}</Link>
            </Button>
          )
        })}
      </nav>

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
          <nav aria-label={`${mobileTitle} mobile`} className="grid gap-2 px-6">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href)

              return (
                <SheetClose key={item.href} asChild>
                  <Button
                    asChild
                    variant={active ? "secondary" : "ghost"}
                    className="justify-start"
                    aria-current={active ? "page" : undefined}
                  >
                    <Link href={item.href}>{item.label}</Link>
                  </Button>
                </SheetClose>
              )
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  )
}
