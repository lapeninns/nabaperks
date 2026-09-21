"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ComponentProps, ReactNode } from "react"
import { Building02Icon, Logout01Icon } from "@hugeicons/core-free-icons"

import {
  isMerchantSetupPath,
  isOfferPassScanPath,
  isPosterPrintPath,
  shouldShowMerchantSetupReminder,
} from "@/lib/navigation/merchant-shell"

import { Icon, Logo, VenueMark } from "@/components/brand"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { ConsoleOfflineStrip } from "./console-offline-strip"
import { ConsoleTopBarDate } from "./console-top-bar-date"
import { MerchantTabBar } from "./merchant-tab-bar"

/** Body gutters: 16px to 359, 20px from 360, 24px from 430 (handoff §8). */
const BODY_GUTTER = "px-4 min-[360px]:px-5 min-[430px]:px-6"

export function MerchantAppShell({
  children,
  setupReminder,
  billingNotice,
  signOutAction,
  activePath: activePathProp,
  variant: variantProp,
  hideMobileChrome: hideMobileChromeProp,
  venueName,
  todayLabel,
  liveDate = false,
}: {
  children: ReactNode
  /** Server-rendered readiness content; visibility follows the live route. */
  setupReminder?: ReactNode
  /** Server-rendered billing attention strip; shown on every tab. */
  billingNotice?: ReactNode
  signOutAction: ComponentProps<"form">["action"]
  /** Override the nav highlight target. Defaults to the live pathname. */
  activePath?: string
  /** Force a chrome variant. Defaults to deriving it from the live pathname. */
  variant?: "full" | "setup"
  /** Drops the top bar + bottom tab bar for full-bleed surfaces like the
   *  poster print preview, which carry their own focused chrome. The rail
   *  stays from 900px. Defaults to deriving it from the live pathname. */
  hideMobileChrome?: boolean
  /** The signed-in venue, named in the top bar so the operator knows which
   *  venue this phone is on. */
  venueName?: string
  /** Today's date in the receipt register, formatted server-side in
   *  Europe/London so hydration and harness screenshots stay stable. */
  todayLabel?: string
  /** Re-read the date on the client across midnight (production only). */
  liveDate?: boolean
}) {
  // Derive the chrome from the LIVE route, not a server prop. This shell lives
  // in a shared layout that the App Router preserves across soft navigations,
  // so a request-time `variant` computed server-side would go stale (e.g. stay
  // "full" after navigating poster -> /app/launch, or vice versa). `usePathname`
  // updates on every navigation. Explicit props still win — the /dev harness
  // uses them to pin a variant regardless of the actual URL.
  const pathname = usePathname() ?? ""
  const activePath = activePathProp ?? pathname
  const variant =
    variantProp ?? (isMerchantSetupPath(pathname) ? "setup" : "full")
  const hideMobileChrome = hideMobileChromeProp ?? isPosterPrintPath(pathname)

  // The counter is a focused scan journey; authentication remains in app/app/layout.tsx.
  if (isOfferPassScanPath(pathname)) {
    return <>{children}</>
  }

  if (variant === "setup") {
    return (
      <div className="min-h-svh bg-background [--setup-header-h:3.5rem] sm:[--setup-header-h:4rem]">
        <header className="fixed inset-x-0 top-0 z-40 border-b-2 border-ink bg-card">
          <div className="mx-auto flex h-(--setup-header-h) w-full max-w-merchant min-w-0 items-center justify-between gap-x-3 overflow-x-clip px-4 sm:px-6">
            <Logo
              href="/app/launch"
              prefetch={false}
              wordmarkClassName="hidden sm:inline"
              className="shrink-0 gap-0 pr-0 sm:gap-3 sm:pr-3"
            />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/app" prefetch={false}>
                  Dashboard
                </Link>
              </Button>
              <Button
                asChild
                variant="secondary"
                size="icon-sm"
                aria-label="Account profile"
                title="Account profile"
              >
                <Link href="/app/account?tab=profile" prefetch={false}>
                  <Icon icon={Building02Icon} size={16} />
                </Link>
              </Button>
              <form action={signOutAction}>
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  aria-label="Log out"
                  title="Log out"
                >
                  <Icon icon={Logout01Icon} size={16} />
                  <span className="hidden sm:inline">Log out</span>
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="w-full min-w-0 overflow-x-clip px-4 pt-[calc(var(--setup-header-h)+0.75rem)] pb-16 sm:px-6 sm:pt-[calc(var(--setup-header-h)+2rem)] sm:pb-10">
          <div className="mx-auto w-full max-w-merchant min-w-0">
            {children}
          </div>
        </main>
      </div>
    )
  }

  const showReminder = shouldShowMerchantSetupReminder(pathname)
  const name = venueName?.trim() || "Your venue"

  // Four-row application grid: top / body / nav below 900px, with a 200px
  // rail column from 900px. Only the body row scrolls; the pinned action row
  // is rendered by the owning screen inside the body (ConsolePinnedAction),
  // stuck to its foot, so nothing else here ever moves. Every child is
  // placed explicitly so a missing top bar or tab bar (poster print) leaves
  // its auto row collapsed instead of shifting the body into it.
  return (
    <div
      data-console-shell={hideMobileChrome ? "chromeless" : "full"}
      className="relative grid h-dvh min-h-dvh grid-cols-1 grid-rows-[auto_minmax(0,1fr)_auto] bg-background min-[900px]:grid-cols-[12.5rem_minmax(0,1fr)] min-[900px]:grid-rows-[auto_minmax(0,1fr)]"
    >
      <a
        href="#console-body"
        className="focus-ring absolute top-3 left-3 z-50 -translate-y-[200%] rounded-lg border-2 border-ink bg-card px-4 py-2 text-sm font-bold text-foreground opacity-0 shadow-xs transition-transform duration-[var(--w-dur-fast)] ease-[var(--w-ease)] focus:translate-y-0 focus:opacity-100 motion-reduce:transition-none"
      >
        Skip to content
      </a>

      {hideMobileChrome ? null : (
        <header
          data-console-top-bar
          className={cn(
            "col-start-1 row-start-1 flex min-h-[3.25rem] items-center gap-3 border-b-2 border-ink bg-card pt-[env(safe-area-inset-top)] min-[900px]:col-start-2 [@media(max-height:460px)]:min-h-[2.625rem]",
            BODY_GUTTER
          )}
        >
          <VenueMark name={name} size={32} className="shrink-0" />
          <p className="min-w-0 flex-1 truncate text-base leading-tight font-extrabold text-foreground">
            {name}
          </p>
          {todayLabel ? (
            <ConsoleTopBarDate initial={todayLabel} live={liveDate} />
          ) : null}
        </header>
      )}

      <main
        id="console-body"
        // A tab stop, not just a skip-link target: WebKit cannot scroll a
        // region from the keyboard unless it is focusable (axe
        // scrollable-region-focusable).
        tabIndex={0}
        data-console-body
        className="focus-ring col-start-1 row-start-2 min-h-0 overflow-x-clip overflow-y-auto min-[900px]:col-start-2"
      >
        {hideMobileChrome ? null : <ConsoleOfflineStrip />}
        {/* hideMobileChrome strips ALL content padding for the full-bleed
            poster sheet. Contract: any non-poster surface reachable under a
            chromeless path must self-pad — app/app/error.tsx and the scoped
            app/app/qr/poster/[template]/not-found.tsx both carry px-6 py-10
            for exactly this reason. */}
        <div
          className={
            hideMobileChrome
              ? "w-full min-w-0"
              : cn(
                  "mx-auto flex min-h-full w-full max-w-merchant min-w-0 flex-col pt-4 pb-6 min-[900px]:pt-6 min-[900px]:pb-10",
                  BODY_GUTTER
                )
          }
        >
          {hideMobileChrome ? null : billingNotice}
          {showReminder ? setupReminder : null}
          {children}
        </div>
      </main>

      {hideMobileChrome ? null : (
        <MerchantTabBar
          form="tabs"
          activePath={activePath}
          className="col-start-1 row-start-3 min-[900px]:hidden"
        />
      )}
      <MerchantTabBar
        form="rail"
        activePath={activePath}
        signOutAction={signOutAction}
        className="hidden min-[900px]:col-start-1 min-[900px]:row-span-2 min-[900px]:row-start-1 min-[900px]:flex"
      />
    </div>
  )
}

export { merchantNavItems, merchantAccountItems } from "./console-nav"
