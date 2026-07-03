import { notFound } from "next/navigation"

import { MonoTag, PageTitle, ReceiptCard } from "@/components/brand"
import { HomeBirthdayPrompt } from "@/components/customer/home-birthday-prompt"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Customer dashboard harness — proves the DOB birthday prompt renders in the
 * real customer shell with no auth/DB. `?dob=set` simulates a member who has
 * already stored a birthday (prompt suppressed); the default shows it.
 */
export default async function HomeHarnessHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ dob?: string }>
}) {
  if (process.env.NODE_ENV === "production") {
    notFound()
  }

  const params = searchParams ? await searchParams : {}
  const hasDob = params.dob === "set"

  return (
    <div className="grid gap-6">
      <PageTitle
        eyebrow="My Nabaperks"
        title="Your cards"
        description="Every card you've collected. Tap one to see its stamps and rewards."
      />

      {hasDob ? null : <HomeBirthdayPrompt />}

      <ReceiptCard className="grid gap-2">
        <MonoTag tone="leaf">Old Crown Girton</MonoTag>
        <h2 className="text-base leading-tight font-extrabold">
          Mystery Visit Card
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          2 of 3 stamps collected.
        </p>
      </ReceiptCard>
    </div>
  )
}
