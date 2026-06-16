"use client"

import Link, { useLinkStatus } from "next/link"

import { cn } from "@/lib/utils"
import { ACCOUNT_TABS, type AccountTab } from "./account-tabs"

/**
 * In-page tab switcher for the Account hub. Wet Ink pill bar mirroring the
 * shell navigation: active tab is an ink fill, others are muted ink.
 */
export function AccountTabBar({ activeTab }: { activeTab: AccountTab }) {
  return (
    <nav
      aria-label="Account sections"
      className="flex items-center gap-1 self-start rounded-full border-2 border-ink bg-card p-1"
    >
      {ACCOUNT_TABS.map((tab) => {
        const active = tab.id === activeTab

        return (
          <Link
            key={tab.id}
            href={`/app/account?tab=${tab.id}`}
            aria-current={active ? "page" : undefined}
            data-active={active}
            className={cn(
              "inline-flex items-center rounded-full px-4 py-1.5 text-sm font-bold transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
              active
                ? "bg-ink text-paper"
                : "text-ink-soft hover:bg-accent hover:text-foreground"
            )}
          >
            <span className="truncate">{tab.label}</span>
            <TabPendingIndicator />
          </Link>
        )
      })}
    </nav>
  )
}

function TabPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      className="ml-1 size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity delay-100 duration-150 data-[pending=true]:opacity-60"
    />
  )
}
