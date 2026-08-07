"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { CSSProperties, MouseEvent } from "react"

import { Icon } from "@/components/brand"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  isActiveNavItem,
  type ShellNavGroup,
  type ShellNavItem,
} from "./console-nav"

export const CONSOLE_SIDEBAR_STYLE: CSSProperties &
  Record<"--sidebar-width" | "--sidebar-width-icon", string> = {
  "--sidebar-width": "17rem",
  "--sidebar-width-icon": "4.5rem",
}

type ConsoleSidebarNavProps = {
  secondaryItems?: readonly ShellNavItem[]
  secondaryLabel?: string
  activePath?: string
  ariaLabel: string
} & (
  | { items: readonly ShellNavItem[]; groups?: never }
  /** Labelled groups instead of one flat list (the admin console). */
  | { groups: readonly ShellNavGroup[]; items?: never }
)

export function ConsoleSidebarNav({
  items,
  groups,
  secondaryItems,
  secondaryLabel = "Account",
  activePath,
  ariaLabel,
}: ConsoleSidebarNavProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentPath = activePath ?? pathname
  const currentTab = searchParams.get("tab")
  const secondaryNavItems = secondaryItems ?? []
  const navGroups: readonly ShellNavGroup[] = groups ?? [
    { label: "", items: items ?? [] },
  ]

  return (
    <nav aria-label={ariaLabel} className="flex min-h-0 flex-1 flex-col gap-2">
      {navGroups.map((group) => (
        <ConsoleSidebarGroup
          key={group.label || "primary"}
          items={group.items}
          label={group.label || undefined}
          currentPath={currentPath}
          currentTab={currentTab}
        />
      ))}
      {secondaryNavItems.length > 0 ? (
        <div className="mt-auto">
          <ConsoleSidebarGroup
            items={secondaryNavItems}
            currentPath={currentPath}
            currentTab={currentTab}
            label={secondaryLabel}
          />
        </div>
      ) : null}
    </nav>
  )
}

function ConsoleSidebarGroup({
  items,
  currentPath,
  currentTab,
  label,
}: {
  items: readonly ShellNavItem[]
  currentPath: string
  currentTab: string | null
  label?: string
}) {
  const { isMobile, setOpenMobile } = useSidebar()

  function handleLinkClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }

    if (isMobile) {
      setOpenMobile(false)
    }
  }

  return (
    <SidebarGroup>
      {label ? (
        <SidebarGroupLabel data-collapse-hide>{label}</SidebarGroupLabel>
      ) : null}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = isActiveNavItem(currentPath, currentTab, item.href)
            const prefetchProps =
              item.prefetch === "auto" ? {} : { prefetch: false }

            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton asChild isActive={active} size="lg">
                  <Link
                    href={item.href}
                    {...prefetchProps}
                    aria-current={active ? "page" : undefined}
                    data-active={active}
                    className="gap-3"
                    onClick={handleLinkClick}
                  >
                    {item.icon ? <Icon icon={item.icon} size={16} /> : null}
                    <span data-collapse-label>{item.label}</span>
                    <NavPendingIndicator />
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}

function NavPendingIndicator() {
  const { pending } = useLinkStatus()

  return (
    <span
      aria-hidden="true"
      data-pending={pending}
      data-collapse-hide
      className="ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-0 transition-opacity delay-100 duration-[var(--w-dur-fast)] ease-[var(--w-ease)] data-[pending=true]:opacity-60 motion-reduce:transition-none"
    />
  )
}
