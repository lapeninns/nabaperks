"use client"

import Link, { useLinkStatus } from "next/link"
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

/**
 * Every scroll container that sits behind the fixed bar reserves its clearance
 * from here, so the reservation and the bar can never drift (CUS 02#1). The bar
 * is `min-h-14` (56px) plus its own 2px top rule; the extra 1rem is breathing
 * room under the last element. Declared beside the component it measures rather
 * than copied as `pb-28` / `pb-32` magic numbers into four different surfaces.
 */
export const TAB_BAR_CLEARANCE =
  "[--tab-bar-h:calc(3.5rem+2px)] pb-[calc(var(--tab-bar-h)+env(safe-area-inset-bottom)+1rem)]"

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
 * The tap feedback. `/home` and `/scan` are server-rendered with real I/O, so
 * between tap and route commit there can be hundreds of milliseconds with no
 * hover state to fall back on — which is what produced double taps. The roundel
 * therefore fills the moment the navigation starts (`useLinkStatus`), not when
 * it lands (CUS 02#4).
 */
function TabRoundel({
  active,
  icon,
}: {
  active: boolean
  icon: TabItem["icon"]
}) {
  const { pending } = useLinkStatus()

  return (
    <span
      data-state={active ? "active" : pending ? "pending" : "idle"}
      className={cn(
        "grid size-8 place-items-center rounded-full border-2 transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
        active
          ? "border-ink bg-ink text-paper shadow-xs"
          : "border-transparent text-ink-soft group-hover:border-line-strong group-active:border-ink group-active:bg-secondary group-active:text-foreground data-[state=pending]:border-ink data-[state=pending]:bg-secondary data-[state=pending]:text-foreground"
      )}
    >
      <Icon icon={icon} size={20} />
    </span>
  )
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
                // text-xs, not the hand-rolled 11px: below text-xs the contract
                // sanctions only .mono-meta / .mono-id, both Space Mono
                // (CUS 02#3). The roundel drops to size-8 to keep the 56px bar.
                "group focus-ring relative flex min-h-14 flex-col items-center justify-center gap-1 text-xs font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] active:translate-y-px motion-reduce:transition-none motion-reduce:active:translate-y-0",
                active
                  ? "text-foreground"
                  : "text-ink-soft hover:text-foreground"
              )}
            >
              {/* The active tab carries a 2px ink rule on the bar's own top
                  border, so the selected column reads without relying on the
                  roundel fill alone. */}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute inset-x-3 top-0 h-0.5",
                  active ? "bg-ink" : "bg-transparent"
                )}
              />
              <TabRoundel active={active} icon={tab.icon} />
              {tab.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
