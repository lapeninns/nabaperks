"use client"

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
}: {
  children: ReactNode
  signOutAction: ComponentProps<"form">["action"]
  activePath?: string
}) {
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
