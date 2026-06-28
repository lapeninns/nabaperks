"use client"

import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"

import { isMerchantTabActive, merchantTabBarItems } from "./console-nav"
import { cn } from "@/lib/utils"

export function MerchantTabBar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentTab = searchParams.get("tab")

  return (
    <nav
      aria-label="Merchant navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid w-full max-w-lg grid-cols-5">
        {merchantTabBarItems.map((tab) => {
          const active = isMerchantTabActive(pathname, currentTab, tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              data-active={active}
              className={cn(
                "group relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 text-center text-[0.6875rem] leading-tight font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none focus-visible:ring-3 focus-visible:ring-ring/35 motion-reduce:transition-none",
                active ? "text-foreground" : "text-ink-soft hover:text-foreground"
              )}
            >
              {active ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-5 top-0 h-1 rounded-b-full bg-primary"
                />
              ) : null}
              <span
                className={cn(
                  "grid size-10 place-items-center rounded-full border-2 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                  active
                    ? "border-ink bg-primary text-primary-foreground shadow-xs"
                    : "border-transparent text-ink-soft group-hover:border-ink/30"
                )}
              >
                {tab.icon ? (
                  <HugeiconsIcon icon={tab.icon} size={20} strokeWidth={2} />
                ) : null}
              </span>
              <span className="max-w-full truncate">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
