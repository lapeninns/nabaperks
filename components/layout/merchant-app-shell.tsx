"use client"

import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import { Logout01Icon } from "@hugeicons/core-free-icons"

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
import { CONSOLE_SIDEBAR_STYLE, ConsoleSidebarNav } from "./console-sidebar-nav"
import { merchantAccountItems, merchantNavItems } from "./console-nav"

export function MerchantAppShell({
  children,
  signOutAction,
  activePath,
  variant = "full",
}: {
  children: ReactNode
  signOutAction: ComponentProps<"form">["action"]
  activePath?: string
  variant?: "full" | "setup"
}) {
  if (variant === "setup") {
    return (
      <div className="min-h-svh bg-background [--setup-header-h:3.5rem] sm:[--setup-header-h:4rem]">
        <header className="fixed inset-x-0 top-0 z-40 border-b-2 border-ink bg-card/95 backdrop-blur-sm supports-[backdrop-filter]:bg-card/90">
          <div className="mx-auto flex h-(--setup-header-h) w-full max-w-6xl min-w-0 items-center justify-between gap-x-3 px-4 sm:px-6">
            <Logo
              href="/app/launch"
              wordmarkClassName="hidden sm:inline"
              className="shrink-0 gap-0 pr-0 sm:gap-3 sm:pr-3"
            />
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <Button asChild variant="secondary" size="sm">
                <Link href="/app">Dashboard</Link>
              </Button>
              <form action={signOutAction}>
                <Button type="submit" variant="outline" size="sm">
                  <Icon icon={Logout01Icon} size={16} />
                  Log out
                </Button>
              </form>
            </div>
          </div>
        </header>
        <main className="w-full min-w-0 overflow-x-clip px-4 pb-16 pt-[calc(var(--setup-header-h)+0.75rem)] sm:px-6 sm:pb-10 sm:pt-[calc(var(--setup-header-h)+2rem)]">
          <div className="mx-auto w-full min-w-0 max-w-6xl">{children}</div>
        </main>
      </div>
    )
  }

  return (
    <SidebarProvider
      className="min-h-svh bg-background"
      style={CONSOLE_SIDEBAR_STYLE}
    >
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b-2 border-ink p-4">
          <Logo href="/app" />
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
          <form action={signOutAction}>
            <Button
              type="submit"
              variant="secondary"
              className="w-full justify-start"
            >
              <Icon icon={Logout01Icon} size={16} />
              Log out
            </Button>
          </form>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b-2 border-ink bg-card px-4 py-2 md:hidden">
          <SidebarTrigger className="size-11 shrink-0" />
          <Logo href="/app" wordmarkClassName="hidden sm:inline" />
        </header>
        <div className="w-full px-4 py-8 pb-32 sm:px-6 sm:pb-10">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { merchantNavItems, merchantAccountItems } from "./console-nav"
