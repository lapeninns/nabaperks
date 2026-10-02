"use client"

import Link from "next/link"
import type { ComponentProps } from "react"

// Keep the server-rendered navigation links in their own client entry. A direct
// server reference to Next Link can resolve to a sibling page's merged chunk
// list, preloading dashboard controls on the camera scanner screen.
export function NavigationLink(props: ComponentProps<typeof Link>) {
  return <Link {...props} />
}
