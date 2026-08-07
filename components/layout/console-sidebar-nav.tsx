"use client"

import Link, { useLinkStatus } from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import type { CSSProperties, MouseEvent } from "react"

import { Icon } from "@/components/brand"
import { Spinner } from "@/components/ui/spinner"
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
                    <NavItemGlyph icon={item.icon} />
                    <span data-collapse-label>{item.label}</span>
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

/**
 * Every merchant route is `force-dynamic`, so a nav tap can sit for a second or
 * more on venue Wi-Fi. The previous signal was a 6px dot at 60% opacity in the
 * trailing slot, which `data-collapse-hide` also removed from the collapsed
 * icon rail — i.e. no signal at all on the surface with the least context.
 * Swapping the leading glyph for the shared `Spinner` puts the feedback at full
 * contrast in the one slot that renders in both rail states.
 */
function NavItemGlyph({ icon }: { icon?: ShellNavItem["icon"] }) {
  const { pending } = useLinkStatus()

  if (pending) {
    return <Spinner className="size-4 shrink-0" aria-label="Loading page" />
  }

  return icon ? <Icon icon={icon} size={16} /> : null
}
