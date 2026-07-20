"use client"

import Link from "next/link"
import { forwardRef, type ComponentProps } from "react"

import { ROUTES } from "@/lib/marketing/facts"

import { captureMarketingFunnelEvent } from "./marketing-funnel-tracker"

type MarketingSignupLinkProps = Omit<ComponentProps<typeof Link>, "href">

/** Signup link with one privacy-safe acquisition milestone attached. */
export const MarketingSignupLink = forwardRef<
  HTMLAnchorElement,
  MarketingSignupLinkProps
>(function MarketingSignupLink({ onClick, ...props }, ref) {
  return (
    <Link
      {...props}
      ref={ref}
      href={ROUTES.signup}
      onClick={(event) => {
        onClick?.(event)
        if (!event.defaultPrevented) {
          void captureMarketingFunnelEvent("merchant_signup_clicked")
        }
      }}
    />
  )
})
