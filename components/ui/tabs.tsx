"use client"

import * as React from "react"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Wet Ink tabs. The list is a mono-pill strip in the StepTrack/FilterPills
 * register — 1.5px ink-bordered pills, the active one ink-filled — and it
 * scrolls horizontally on narrow screens instead of wrapping. Triggers are
 * `.pressable` (44px tap floor lands on coarse pointers, the shared focus
 * recipe on every pointer); arrow-key/Home/End navigation comes from Radix.
 */
function Tabs({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      className={cn("grid min-w-0 gap-4", className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "flex [scrollbar-width:none] gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden",
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "pressable focus-ring mono-meta inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-ink bg-card px-3.5 py-1.5 whitespace-nowrap text-ink-soft outline-none",
        // Compact 36px pill on fine pointers; the .pressable 44px tap floor is
        // restored on coarse pointers, mirroring FilterPills.
        "min-h-9 [@media(pointer:coarse)]:min-h-11",
        "hover:bg-secondary disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:bg-ink data-[state=active]:text-paper data-[state=active]:forced-colors:underline data-[state=active]:forced-colors:underline-offset-4",
        "motion-reduce:transition-none",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("grid min-w-0 gap-4 outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
