"use client"

import { useState } from "react"
import { toast } from "sonner"

import { Eyebrow } from "@/components/brand"
import { FormField, SubmitButton } from "@/components/forms"
import { StatusBanner } from "@/components/loyalty"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"

/**
 * Forms & feedback — the states where production defects hide: inputs in
 * every state (including invalid via real aria-invalid), the aria-wired
 * FormField, one-time-code input, the SubmitButton pending recipe, live toast
 * triggers, and bare Alert beside its StatusBanner face.
 */
export function FormsFeedbackDemo() {
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Input states</Eyebrow>
          <div className="grid gap-3">
            <Input
              placeholder="Default — focus me"
              aria-label="Default input"
            />
            <Input
              placeholder="Disabled"
              disabled
              aria-label="Disabled input"
            />
            <Input
              defaultValue="not-a-postcode"
              aria-invalid="true"
              aria-label="Invalid input"
            />
            <Textarea
              placeholder="Textarea — same ink well"
              aria-label="Demo textarea"
            />
          </div>
        </div>

        <div className="grid content-start gap-4 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>FormField · description + error wiring</Eyebrow>
          <FormField
            id="demo-venue-name"
            label="Venue name"
            description="Printed on your posters and customer cards."
          >
            <Input defaultValue="The Old Crown" />
          </FormField>
          <FormField
            id="demo-venue-postcode"
            label="Postcode"
            error="Enter a full UK postcode, e.g. CB3 0QQ."
          >
            <Input defaultValue="CB3" />
          </FormField>
          <div className="grid gap-2">
            <Eyebrow>One-time passcode</Eyebrow>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label="One-time passcode"
              className="font-mono tracking-[0.18em]"
            />
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <PendingFormDemo />

        <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Toasts · themed cn-toast slot</Eyebrow>
          <p className="text-sm leading-6 text-muted-foreground">
            2px ink border, hard shadow, StatusBanner tone washes — richColors
            is forced off in the Toaster wrapper.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                toast.success("Estimate copied — show it to the team")
              }
            >
              Success
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.error("Could not copy — try again")}
            >
              Error
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.warning("Almost out of poster credit")}
            >
              Warning
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.info("Your card lives on this phone")}
            >
              Info
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Bare alert · 2px ink slot</Eyebrow>
          <Alert>
            <AlertTitle>Card saved</AlertTitle>
            <AlertDescription>
              The bare primitive now carries the ink contract.
            </AlertDescription>
          </Alert>
          <Alert variant="destructive">
            <AlertTitle>Could not reach the venue</AlertTitle>
            <AlertDescription>
              Destructive text on the same ink-bordered surface.
            </AlertDescription>
          </Alert>
          <StatusBanner tone="info" title="New member joined">
            The cobalt info tone — joins and neutral system notes.
          </StatusBanner>
        </div>

        <div className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5">
          <Eyebrow>Sheet · 18px top radius, weight-800 title</Eyebrow>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline">Open bottom sheet</Button>
            </SheetTrigger>
            <SheetContent side="bottom">
              <SheetHeader>
                <SheetTitle>The counter moment</SheetTitle>
                <SheetDescription>
                  Ink scrim below, no blur, title at weight 800 from the
                  sheet-title slot.
                </SheetDescription>
              </SheetHeader>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </>
  )
}

/** Real pending state: a client form action that takes a moment to settle. */
function PendingFormDemo() {
  const [saved, setSaved] = useState(false)

  return (
    <form
      action={async () => {
        setSaved(false)
        await new Promise((resolve) => setTimeout(resolve, 1400))
        setSaved(true)
      }}
      className="grid content-start gap-3 rounded-lg border-2 border-ink bg-card p-5"
    >
      <Eyebrow>SubmitButton · the pending recipe</Eyebrow>
      <p className="text-sm leading-6 text-muted-foreground">
        Disables itself, announces aria-busy, swaps to Spinner + pendingLabel
        while the form action runs.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        {saved ? (
          <span className="mono-id text-muted-foreground">Saved</span>
        ) : null}
      </div>
    </form>
  )
}
