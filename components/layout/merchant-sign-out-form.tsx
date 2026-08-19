"use client"

import type { ComponentProps, ReactNode } from "react"

import { clearOnboardingDraft } from "@/lib/merchant/onboarding-draft-storage"

export function MerchantSignOutForm({
  action,
  draftUserId,
  children,
}: {
  action: ComponentProps<"form">["action"]
  draftUserId?: string
  children: ReactNode
}) {
  return (
    <form
      action={action}
      onSubmit={() => {
        if (!draftUserId) return
        try {
          clearOnboardingDraft(window.localStorage, draftUserId)
        } catch (error) {
          if (error instanceof DOMException) return
          throw error
        }
      }}
    >
      {children}
    </form>
  )
}
