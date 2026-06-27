import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from "nabaperks"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  DashboardSquare01Icon,
  Coffee02Icon,
  GiftIcon,
  UserGroupIcon,
  Settings02Icon,
} from "@hugeicons/core-free-icons"

export const Default = () => (
  <div
    className="h-[28rem] overflow-hidden rounded-2xl border"
    style={{ "--sidebar-width": "16rem" } as React.CSSProperties}
  >
    <SidebarProvider className="min-h-full">
      <Sidebar collapsible="none">
        <SidebarHeader>
          <div className="px-2 py-1 font-heading text-sm font-medium">
            Bridge Street Coffee
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Console</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <HugeiconsIcon icon={DashboardSquare01Icon} strokeWidth={2} />
                    Overview
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon icon={Coffee02Icon} strokeWidth={2} />
                    Stamps
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon icon={GiftIcon} strokeWidth={2} />
                    Rewards
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon icon={UserGroupIcon} strokeWidth={2} />
                    Members
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton>
                <HugeiconsIcon icon={Settings02Icon} strokeWidth={2} />
                Settings
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset className="p-6">
        <div className="font-heading text-lg font-medium">Today at the counter</div>
        <p className="mt-1 text-sm text-muted-foreground">
          142 stamps issued, 11 rewards redeemed since open.
        </p>
      </SidebarInset>
    </SidebarProvider>
  </div>
)

export const NavOnly = () => (
  <div
    className="h-[26rem] overflow-hidden rounded-2xl border"
    style={{ ["--sidebar-width" as string]: "15rem" }}
  >
    <SidebarProvider className="min-h-full">
      <Sidebar collapsible="none">
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Loyalty</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton isActive>
                    <HugeiconsIcon icon={Coffee02Icon} strokeWidth={2} />
                    Stamp cards
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon icon={GiftIcon} strokeWidth={2} />
                    Free flat white
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <HugeiconsIcon icon={GiftIcon} strokeWidth={2} />
                    Free pastry
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
    </SidebarProvider>
  </div>
)
