"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { Icon } from "@/components/brand"
import { cn } from "@/lib/utils"
import { isActivePath, merchantTabBarItems } from "./console-nav"

/**
 * The counter tab bar. The merchant's four highest-frequency console surfaces
 * (Dashboard, Scan, Poster, Members) were previously two taps and a full-screen
 * drawer animation away on a phone held one-handed behind a bar. The drawer
 * still owns the long tail (Setup, Activity, Announce, Offers, Account).
 *
 * Vocabulary is the customer tab bar's: a 36px roundel that fills with ink when
 * active, an 11px bold label, a 56px tap row, and a safe-area inset.
 */
export function MerchantTabBar() {
  const pathname = usePathname() ?? ""

  return (
    <nav
      aria-label="Console shortcuts"
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="mx-auto grid w-full max-w-merchant grid-cols-4">
        {merchantTabBarItems.map((tab) => {
          const active = isActivePath(pathname, tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch={tab.prefetch === "auto" ? undefined : false}
              aria-current={active ? "page" : undefined}
              data-active={active}
              className={cn(
                "group focus-ring flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                active
                  ? "text-foreground"
                  : "text-ink-soft hover:text-foreground"
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-full border-2 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                  active
                    ? "border-ink bg-ink text-paper shadow-xs"
                    : "border-transparent text-ink-soft group-hover:border-ink/30"
                )}
              >
                {tab.icon ? <Icon icon={tab.icon} size={20} /> : null}
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
