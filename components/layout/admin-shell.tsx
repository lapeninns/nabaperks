"use client"

import Link from "next/link"
import type { ComponentProps, ReactNode } from "react"
import {
  Logout01Icon,
  SquareLockPasswordIcon,
} from "@hugeicons/core-free-icons"

import { Icon, Logo, MonoTag } from "@/components/brand"
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
import { adminNavGroups } from "./console-nav"
import { SkipLink } from "./skip-link"

export function AdminShell({
  children,
  operatorEmail,
  mfaRequired = false,
  activePath,
  signOutAction,
  defaultSidebarOpen = true,
}: {
  children: ReactNode
  operatorEmail?: string
  mfaRequired?: boolean
  activePath?: string
  /** Ends the admin session from inside the console (shared-machine safety). */
  signOutAction?: ComponentProps<"form">["action"]
  /** Seeds the desktop expanded/collapsed state from the persisted cookie. */
  defaultSidebarOpen?: boolean
}) {
  return (
    <SidebarProvider
      className="min-h-svh bg-background"
      style={CONSOLE_SIDEBAR_STYLE}
      defaultOpen={defaultSidebarOpen}
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
            groups={adminNavGroups}
            activePath={activePath}
          />
        </SidebarContent>
        {/* Identity and session controls, not product copy. Footer tags
            truncate at sidebar width; each carries `title` (via a wrapper,
            MonoTag exposes no title prop) so a long operator email is still
            readable on hover, and both collapse away in icon mode. */}
        <SidebarFooter className="border-t-2 border-ink p-4">
          {operatorEmail ? (
            <span
              data-collapse-hide
              title={`Operator: ${operatorEmail}`}
              className="grid min-w-0"
            >
              <MonoTag tone="ink" className="max-w-full truncate">
                Operator: {operatorEmail}
              </MonoTag>
            </span>
          ) : null}
          <span
            data-collapse-hide
            title={mfaRequired ? "AAL2 verified" : "Admin verified"}
            className="grid min-w-0"
          >
            <MonoTag tone="leaf" className="max-w-full truncate">
              {mfaRequired ? "AAL2 verified" : "Admin verified"}
            </MonoTag>
          </span>
          <Button
            asChild
            variant="ghost"
            data-collapse-center
            className="w-full justify-start"
          >
            <Link href="/admin/security" prefetch={false}>
              <Icon icon={SquareLockPasswordIcon} size={16} />
              <span data-collapse-label>Security</span>
            </Link>
          </Button>
          {/* An operator on a shared machine must be able to end the admin
              session from inside the console (mirrors the merchant shell). */}
          {signOutAction ? (
            <form action={signOutAction}>
              <Button
                type="submit"
                variant="secondary"
                data-collapse-center
                className="w-full justify-start"
              >
                <Icon icon={Logout01Icon} size={16} />
                <span data-collapse-label>Log out</span>
              </Button>
            </form>
          ) : null}
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
        <div className="w-full px-4 py-8 sm:px-6">
          <div className="mx-auto w-full max-w-merchant">{children}</div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export { adminNavItems } from "./console-nav"
