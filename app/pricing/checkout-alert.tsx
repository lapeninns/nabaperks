"use client"

import { useSearchParams } from "next/navigation"

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

const successMessage = {
  title: "Checkout complete",
  body: "Your Growth Plan setup can continue from the merchant billing page.",
} as const

const cancelledMessage = {
  title: "Checkout cancelled",
  body: "No payment details were changed. You can start checkout again whenever you are ready.",
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
      <AlertDescription>{checkoutMessage.body}</AlertDescription>
    </Alert>
  )
}
