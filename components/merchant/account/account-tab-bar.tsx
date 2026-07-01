import Link from "next/link"

import {
  ACCOUNT_TABS,
  type AccountTab,
} from "@/components/merchant/account/account-tabs"
import { cn } from "@/lib/utils"

export function AccountTabBar({ activeTab }: { activeTab: AccountTab }) {
  return (
    <nav aria-label="Account sections">
      <ul className="inline-flex list-none rounded-lg border-2 border-ink bg-card p-1 shadow-sm">
        {ACCOUNT_TABS.map((tab) => {
          const isActive = tab.id === activeTab

          return (
            <li key={tab.id}>
              <Link
                href={`/app/account?tab=${tab.id}`}
                prefetch={false}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-md px-4 py-2 text-sm font-extrabold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                )}
              >
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
