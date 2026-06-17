"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Activity03Icon,
  GiftIcon,
  QrCode01Icon,
  UserCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

type TabItem = {
  href: string
  label: string
  icon: typeof Home01Icon
}

const tabs: TabItem[] = [
  { href: "/home", label: "Home", icon: Home01Icon },
  { href: "/home/rewards", label: "Rewards", icon: GiftIcon },
  { href: "/scan", label: "Scan", icon: QrCode01Icon },
  { href: "/home/activity", label: "Activity", icon: Activity03Icon },
  { href: "/home/profile", label: "Profile", icon: UserCircleIcon },
]

function isActive(pathname: string, href: string) {
  if (href === "/home") {
    return (
      pathname === "/home" ||
      pathname.startsWith("/card/") ||
      pathname.startsWith("/reward/")
    )
  }

  if (href === "/scan") {
    return pathname === "/scan"
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Fixed bottom tab bar for the customer home — the mobile-first equivalent of
 * the merchant top pill nav. Active = ink fill / paper text, same Wet Ink
 * vocabulary as `ShellNavigation`.
 */
export function CustomerTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Home navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              data-active={active}
              className={cn(
                "group flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] outline-none motion-reduce:transition-none focus-visible:ring-3 focus-visible:ring-ring/35",
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
                <HugeiconsIcon icon={tab.icon} size={20} strokeWidth={2} />
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
