"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Activity03Icon,
  GiftIcon,
  QrCode01Icon,
  UserCircleIcon,
  Home01Icon,
} from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
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

export function CustomerTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Home navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)]"
    >
      {/* One customer column: the shared 410px token (CUS-P2-12/16). */}
      <div className="mx-auto grid w-full max-w-customer grid-cols-5">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href)

          return (
            <Link
              key={tab.href}
              href={tab.href}
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
                <Icon icon={tab.icon} size={20} />
              </span>
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
