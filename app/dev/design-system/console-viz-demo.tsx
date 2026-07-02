"use client"

import { useState } from "react"

import { FilterPills } from "@/components/brand"

/** Interactive FilterPills demo — state lives here so the page stays server. */
export function FilterPillsDemo() {
  const [value, setValue] = useState("all")

  return (
    <FilterPills
      aria-label="Demo activity filter"
      value={value}
      onValueChange={setValue}
      items={[
        { id: "all", label: "All", count: 24 },
        { id: "stamps", label: "Stamps", count: 18 },
        { id: "joins", label: "Joins", count: 4 },
        { id: "rewards", label: "Rewards", count: 2 },
      ]}
    />
  )
}
