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
import { SkipLink } from "./skip-link"

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
      <SkipLink />
      {/* `icon`, not `offcanvas`: offcanvas has no desktop affordance, so a
          1280px laptop was permanently pinned to ~960px of content while the
          DataTable switches to table mode at exactly that width. Mirrors the
          merchant console's header trigger. */}
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b-2 border-ink p-4">
          <div
            data-sidebar-header-row
            className="flex items-center justify-between gap-2"
          >
            <span data-collapse-hide className="inline-flex min-w-0">
              <Logo href="/admin" label="Nabaperks Admin" />
            </span>
            <SidebarTrigger
              className="hidden shrink-0 md:flex"
              aria-label="Toggle navigation"
              title="Toggle navigation"
            />
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-3">
          <ConsoleSidebarNav
            ariaLabel="Admin navigation"
            items={adminNavItems}
            activePath={activePath}
          />
        </SidebarContent>
        {/* Footer tags truncate at sidebar width; each carries `title` (via a
            wrapper, MonoTag exposes no title prop) so a long operator email is
            still readable on hover. */}
        <SidebarFooter className="border-t-2 border-ink p-4">
          {operatorEmail ? (
            <span title={`Operator: ${operatorEmail}`} className="grid min-w-0">
              <MonoTag tone="ink" className="max-w-full truncate">
                Operator: {operatorEmail}
              </MonoTag>
            </span>
          ) : null}
          <span
            title={mfaRequired ? "AAL2 verified" : "Admin verified"}
            className="grid min-w-0"
          >
            <MonoTag tone="leaf" className="max-w-full truncate">
              {mfaRequired ? "AAL2 verified" : "Admin verified"}
            </MonoTag>
          </span>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset id="main" tabIndex={-1} className="min-w-0">
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
            // `text-foreground` on the 12% leaf wash: `--reward-foreground`
            // is white in light mode (near-black in dark), which is illegible
            // over a tint of paper in both themes.
            className="border-b-2 border-ink bg-reward/12 px-4 py-3 text-sm font-semibold text-foreground sm:px-6"
          >
            MFA enforcement is enabled for this admin session.
          </div>
        ) : null}
        <div className="w-full px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-merchant">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { adminNavItems } from "./console-nav"
