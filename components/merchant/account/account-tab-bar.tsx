import Link from "next/link"

import {
  ACCOUNT_TABS,
  type AccountTab,
} from "@/components/merchant/account/account-tabs"
import { cn } from "@/lib/utils"

export function AccountTabBar({ activeTab }: { activeTab: AccountTab }) {
  return (
    <nav aria-label="Account sections">
      {/* Distributes across the row on phones (equal columns derived from the
          tab count — a fixed column count leaves phantom empty tracks when
          tabs change; truncating labels guard ~320px) and collapses back to a
          compact inline island from sm up — the old inline-flex island hugged
          left on mobile. */}
      <ul className="grid w-full list-none auto-cols-fr grid-flow-col rounded-lg border-2 border-ink bg-card p-1 shadow-sm sm:inline-flex sm:w-auto">
        {ACCOUNT_TABS.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <li key={tab.id} className="min-w-0">
              <Link
                href={`/app/account?tab=${tab.id}`}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "focus-ring flex min-h-11 items-center justify-center rounded-md px-2 py-2 text-sm font-extrabold transition-colors sm:inline-flex sm:px-4",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
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
