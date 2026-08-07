import Link from "next/link"

import {
  ACCOUNT_TABS,
  type AccountTab,
} from "@/components/merchant/account/account-tabs"
import { cn } from "@/lib/utils"

export function AccountTabBar({ activeTab }: { activeTab: AccountTab }) {
  return (
    <nav aria-label="Account sections">
      {/* Underline tabs, not a segmented control (03#57). Filled vermillion is
          the action ink, so a full-width filled block at the top of the page
          read as "press me" rather than "you are here" — and with two tabs a
          full-width island was more chrome than the choice warrants. The row
          keeps a 2px ink base rule and the active tab overdraws it, so the
          "you are here" signal is ink weight rather than a colour fill. */}
      <ul className="flex w-full list-none gap-1 border-b-2 border-ink/15">
        {ACCOUNT_TABS.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <li key={tab.id} className="min-w-0">
              <Link
                href={`/app/account?tab=${tab.id}`}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring -mb-0.5 flex min-h-11 items-center justify-center rounded-t-md border-b-2 px-3 py-2 text-sm font-extrabold transition-colors sm:px-4",
                  isActive
                    ? "border-ink text-foreground"
                    : "border-transparent text-muted-foreground hover:border-ink/30 hover:text-foreground"
                )}
              >
                <span className="truncate">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
