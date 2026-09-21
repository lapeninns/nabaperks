"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { ComponentProps } from "react"
import { Logout01Icon } from "@hugeicons/core-free-icons"

import { recordConsoleEventAction } from "@/app/app/console-events"
import { Icon, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  isActiveNavItem,
  merchantAccountItems,
  merchantNavItems,
  merchantTabItems,
  resolveMerchantTab,
  type ShellNavItem,
} from "./console-nav"

/**
 * The merchant console's navigation, sibling of {@link CustomerTabBar}.
 *
 * Two forms of one component: below the 900px rail breakpoint the four
 * `merchantTabItems` render as a bottom tab bar; from 900px the same
 * component renders its rail form with the full seven `merchantNavItems`
 * plus the account items and log out. Both are `<nav aria-label="Console">`
 * with `aria-current="page"` — these are links to real routes, not tabs.
 * No vermillion here: the accent budget belongs to the screen.
 */
export function MerchantTabBar({
  form,
  activePath,
  signOutAction,
  className,
}: {
  form: "tabs" | "rail"
  /** Override the highlight target. Defaults to the live pathname. */
  activePath?: string
  /** Required by the rail, which carries the log out form. */
  signOutAction?: ComponentProps<"form">["action"]
  className?: string
}) {
  const pathname = usePathname() ?? ""
  const searchParams = useSearchParams()
  const currentPath = activePath ?? pathname
  const currentTab = searchParams.get("tab")

  if (form === "rail") {
    return (
      <nav
        aria-label="Console"
        data-console-nav="rail"
        className={cn(
          "flex min-h-0 flex-col border-r-2 border-ink bg-card",
          className
        )}
      >
        <div className="border-b-2 border-ink px-4 py-3">
          <Logo href="/app" prefetch={false} />
        </div>
        <RailGroup
          items={merchantNavItems}
          currentPath={currentPath}
          currentTab={currentTab}
        />
        <div className="mt-auto">
          <RailGroup
            items={merchantAccountItems}
            currentPath={currentPath}
            currentTab={currentTab}
            label="Account"
          />
          {signOutAction ? (
            <form action={signOutAction} className="border-t-2 border-ink p-3">
              <Button
                type="submit"
                variant="secondary"
                className="w-full justify-start"
              >
                <Icon icon={Logout01Icon} size={16} />
                Log out
              </Button>
            </form>
          ) : null}
        </div>
      </nav>
    )
  }

  const fromTab = resolveMerchantTab(currentPath, currentTab)

  return (
    <nav
      aria-label="Console"
      data-console-nav="tabs"
      className={cn(
        "border-t-2 border-ink bg-card pb-[env(safe-area-inset-bottom)]",
        className
      )}
    >
      <ul className="grid grid-cols-4">
        {merchantTabItems.map((item) => {
          const active = isActiveNavItem(currentPath, currentTab, item.href)
          const prefetchProps =
            item.prefetch === "auto" ? {} : { prefetch: false }

          return (
            <li key={item.href} className="min-w-0">
              <Link
                href={item.href}
                {...prefetchProps}
                aria-current={active ? "page" : undefined}
                data-active={active}
                onClick={() => {
                  if (item.tab === fromTab) return
                  void recordConsoleEventAction({
                    name: "console_tab_selected",
                    properties: { tab: item.tab, from_tab: fromTab },
                  })
                }}
                className={cn(
                  "focus-ring flex min-h-14 flex-col items-center justify-center gap-1 border-t-[3px] px-1 text-[0.6875rem] font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                  active
                    ? "border-t-ink bg-paper-deep text-foreground"
                    : "border-t-transparent text-ink-soft hover:text-foreground"
                )}
              >
                <Icon icon={item.icon} size={22} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function RailGroup({
  items,
  currentPath,
  currentTab,
  label,
}: {
  items: readonly ShellNavItem[]
  currentPath: string
  currentTab: string | null
  label?: string
}) {
  return (
    <div className="grid gap-1 px-2 py-3">
      {label ? <p className="eyebrow px-3 pb-1">{label}</p> : null}
      <ul className="grid gap-1">
        {items.map((item) => {
          const active = isActiveNavItem(currentPath, currentTab, item.href)
          const prefetchProps =
            item.prefetch === "auto" ? {} : { prefetch: false }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                {...prefetchProps}
                aria-current={active ? "page" : undefined}
                data-active={active}
                className={cn(
                  "focus-ring flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-bold transition-colors duration-[var(--w-dur-fast)] ease-[var(--w-ease)] motion-reduce:transition-none",
                  active
                    ? "bg-paper-deep text-foreground"
                    : "text-ink-soft hover:bg-paper-deep/60 hover:text-foreground"
                )}
              >
                {item.icon ? <Icon icon={item.icon} size={16} /> : null}
                <span className="min-w-0 truncate">{item.label}</span>
                <NavPendingIndicator />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function NavPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      className="ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity delay-100 duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[pending=true]:opacity-60 motion-reduce:transition-none"
    />
  )
}
