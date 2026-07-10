"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const successMessage = {
  title: "Checkout complete",
  body: "Your Growth Plan setup can continue from the merchant billing page.",
  // The highest-intent moment on the page: hand the merchant the next step
  // instead of leaving them to find the billing page themselves.
  action: { href: "/app/account?tab=billing", label: "Open merchant billing" },
} as const

const cancelledMessage = {
  title: "Checkout cancelled",
  body: "No payment details were changed. You can start checkout again whenever you are ready.",
  action: null,
} as const

export function PricingCheckoutAlert() {
  const checkout = useSearchParams().get("checkout")
  const checkoutMessage =
    checkout === "success"
      ? successMessage
      : checkout === "cancelled"
        ? cancelledMessage
        : null

  if (!checkoutMessage) return null

  return (
    <Alert className="mt-6 max-w-2xl border-primary/30 bg-primary/10">
      <AlertTitle>{checkoutMessage.title}</AlertTitle>
      <AlertDescription>
        {checkoutMessage.body}
        {checkoutMessage.action ? (
          <Link
            href={checkoutMessage.action.href}
            className="focus-ring mt-1 inline-block font-bold text-foreground underline underline-offset-4 hover:text-primary"
          >
            {checkoutMessage.action.label}
          </Link>
        ) : null}
      </AlertDescription>
    </Alert>
  )
}
