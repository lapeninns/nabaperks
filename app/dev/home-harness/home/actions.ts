"use server"

import { notFound } from "next/navigation"
import type { EmailPromptState } from "@/app/home/(authed)/profile/actions"

export async function harnessLinkedEmailAction(
  state: EmailPromptState,
  data: FormData
): Promise<EmailPromptState> {
  if (process.env.NODE_ENV === "production") notFound()
  if (data.get("otp") !== "424242") {
    return {
      step: "code",
      email: state.email,
      errors: { otp: "That code was not accepted." },
    }
  }
  return {
    step: "verified",
    walletLinked: true,
    message: "Your stamps are together now.",
  }
}
