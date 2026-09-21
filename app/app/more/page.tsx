import Link from "next/link"
import { redirect } from "next/navigation"
import { Logout01Icon } from "@hugeicons/core-free-icons"

import { signOutAction } from "@/app/(auth)/actions"
import { Icon } from "@/components/brand"
import {
  merchantAccountItems,
  merchantNavItems,
} from "@/components/layout/console-nav"
import { Button } from "@/components/ui/button"
import { getCurrentMerchant } from "@/lib/auth/session"

export const dynamic = "force-dynamic"

/**
 * More — the tab bar's fourth destination: every rail destination as a plain
 * list plus log out, so nothing the sidebar used to reach is unreachable
 * below 900px. The More lane replaces this with live subtitles.
 */
export default async function MerchantMorePage() {
  const merchant = await getCurrentMerchant()

  if (!merchant) {
    redirect("/app/onboarding")
  }

  const rows = [...merchantNavItems, ...merchantAccountItems].filter(
    (item) => item.href !== "/app"
  )

  return (
    <div className="mx-auto grid w-full max-w-[35rem] gap-5">
      <h1 className="text-xl leading-tight font-extrabold">More</h1>
      <nav aria-label="More">
        <ul className="surface-card divide-y-2 divide-dashed divide-line overflow-hidden p-0">
          {rows.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                prefetch={false}
                className="focus-ring flex min-h-[3.625rem] items-center gap-3 px-4 py-2 text-sm font-extrabold"
              >
                {item.icon ? <Icon icon={item.icon} size={16} /> : null}
                <span className="flex-1">{item.label}</span>
                <span aria-hidden="true" className="mono-meta text-ink-soft">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <form action={signOutAction} className="surface-card p-3">
        <Button
          type="submit"
          variant="secondary"
          size="lg"
          className="w-full justify-start"
        >
          <Icon icon={Logout01Icon} size={18} />
          Log out
        </Button>
      </form>
    </div>
  )
}
