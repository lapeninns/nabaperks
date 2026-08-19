"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, type ComponentProps, type ReactNode } from "react"
import { Building02Icon, Logout01Icon } from "@hugeicons/core-free-icons"

import {
  isMerchantSetupPath,
  isPosterPrintPath,
} from "@/lib/navigation/merchant-shell"

import { Icon, Logo } from "@/components/brand"
import { Button } from "@/components/ui/button"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { clearCompletedMerchantOnboardingDraft } from "@/lib/merchant/onboarding-draft-storage"
import { CONSOLE_SIDEBAR_STYLE, ConsoleSidebarNav } from "./console-sidebar-nav"
import { merchantAccountItems, merchantNavItems } from "./console-nav"
import { MerchantSignOutForm } from "./merchant-sign-out-form"

export function MerchantAppShell({
  children,
  signOutAction,
  activePath: activePathProp,
  variant: variantProp,
  defaultSidebarOpen = true,
  hideMobileChrome: hideMobileChromeProp,
  draftUserId,
}: {
  children: ReactNode
  signOutAction: ComponentProps<"form">["action"]
  /** Override the nav highlight target. Defaults to the live pathname. */
  activePath?: string
  /** Force a chrome variant. Defaults to deriving it from the live pathname. */
  variant?: "full" | "setup"
  /** Seeds the desktop expanded/collapsed state from the persisted cookie. */
  defaultSidebarOpen?: boolean
  /** Drops the mobile sticky header + bottom tab bar for full-bleed surfaces
   *  like the poster print preview, which carry their own focused chrome.
   *  Defaults to deriving it from the live pathname. */
  hideMobileChrome?: boolean
  draftUserId?: string
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

  useEffect(() => {
    if (pathname.endsWith("/launch")) {
      clearCompletedMerchantOnboardingDraft(
        window.localStorage,
        window.sessionStorage
      )
    }
  }, [pathname])

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
              <MerchantSignOutForm
                action={signOutAction}
                draftUserId={draftUserId}
              >
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
              </MerchantSignOutForm>
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

  return (
    <SidebarProvider
      className="min-h-svh bg-background"
      style={CONSOLE_SIDEBAR_STYLE}
      defaultOpen={defaultSidebarOpen}
    >
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b-2 border-ink p-4">
          <div
            data-sidebar-header-row
            className="flex items-center justify-between gap-2"
          >
            <span data-collapse-hide className="inline-flex min-w-0">
              <Logo href="/app" prefetch={false} />
            </span>
            <SidebarTrigger
              className="hidden shrink-0 md:flex"
              aria-label="Toggle navigation"
              title="Toggle navigation"
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="flex flex-1 flex-col px-2 py-3">
          <ConsoleSidebarNav
            ariaLabel="Merchant navigation"
            items={merchantNavItems}
            secondaryItems={merchantAccountItems}
            secondaryLabel="Account"
            activePath={activePath}
          />
        </SidebarContent>
        <SidebarFooter className="border-t-2 border-ink p-4">
          <MerchantSignOutForm action={signOutAction} draftUserId={draftUserId}>
            <Button
              type="submit"
              variant="secondary"
              data-collapse-center
              className="w-full justify-start"
            >
              <Icon icon={Logout01Icon} size={16} />
              <span data-collapse-label>Log out</span>
            </Button>
          </MerchantSignOutForm>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        {hideMobileChrome ? null : (
          <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b-2 border-ink bg-card px-4 py-2 pt-[calc(0.5rem_+_env(safe-area-inset-top))] md:hidden">
            <SidebarTrigger
              className="size-11 shrink-0"
              aria-label="Open menu"
            />
            <Logo href="/app" prefetch={false} />
          </header>
        )}
        {/* hideMobileChrome strips ALL content padding for the full-bleed
            poster sheet. Contract: any non-poster surface reachable under a
            chromeless path must self-pad — app/app/error.tsx and the scoped
            app/app/qr/poster/[template]/not-found.tsx both carry px-6 py-10
            for exactly this reason. */}
        <div
          className={
            hideMobileChrome
              ? "w-full min-w-0"
              : "w-full px-4 py-8 pb-16 sm:px-6 md:pb-10"
          }
        >
          <div
            className={
              hideMobileChrome
                ? "w-full min-w-0"
                : "mx-auto w-full max-w-merchant"
            }
          >
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { merchantNavItems, merchantAccountItems } from "./console-nav"
