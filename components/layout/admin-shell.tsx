"use client"

import type { ReactNode } from "react"

import { Logo, MonoTag } from "@/components/brand"
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
import { adminNavItems } from "./console-nav"

const supportStatusItems = [
  "Service-role readbacks",
  "Audited support actions",
  "MFA-aware access",
]

export function AdminShell({
  children,
  operatorEmail,
  mfaRequired = false,
  activePath,
}: {
  children: ReactNode
  operatorEmail?: string
  mfaRequired?: boolean
  activePath?: string
}) {
  return (
    <SidebarProvider
      className="min-h-svh bg-background"
      style={CONSOLE_SIDEBAR_STYLE}
    >
      <Sidebar collapsible="offcanvas">
        <SidebarHeader className="border-b-2 border-ink p-4">
          <Logo href="/admin" label="Nabaperks Admin" />
        </SidebarHeader>
        <SidebarContent className="px-2 py-3">
          <ConsoleSidebarNav
            ariaLabel="Admin navigation"
            items={adminNavItems}
            activePath={activePath}
          />
        </SidebarContent>
        <SidebarFooter className="border-t-2 border-ink p-4">
          {operatorEmail ? (
            <MonoTag tone="ink" className="max-w-full truncate">
              Operator: {operatorEmail}
            </MonoTag>
          ) : null}
          {supportStatusItems.map((item) => (
            <MonoTag
              key={item}
              tone="plain"
              className="max-w-full truncate border-ink bg-background text-muted-foreground"
            >
              {item}
            </MonoTag>
          ))}
          <MonoTag tone="leaf" className="max-w-full truncate">
            {mfaRequired ? "AAL2 verified" : "Admin verified"}
          </MonoTag>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 border-b-2 border-ink bg-card px-4 py-2 md:hidden">
          <SidebarTrigger className="size-11 shrink-0" />
          <Logo
            href="/admin"
            label="Nabaperks Admin"
            wordmarkClassName="hidden sm:inline"
          />
        </header>
        {mfaRequired ? (
          <div
            role="status"
            className="border-b-2 border-ink bg-reward/12 px-4 py-3 text-sm font-semibold text-reward-foreground sm:px-6"
          >
            MFA enforcement is enabled for this admin session.
          </div>
        ) : null}
        <div className="w-full px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-7xl">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { adminNavItems } from "./console-nav"
