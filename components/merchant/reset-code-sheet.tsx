"use client"

import {
  useActionState,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"

import {
  resetVenueCodeAction,
  type VenueCodeResetActionState,
} from "@/app/app/actions"
import { recordConsoleEventAction } from "@/app/app/console-events"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { Spinner } from "@/components/ui/spinner"

const initialState: VenueCodeResetActionState = {}

/**
 * The destructive confirmation for rotating today's team code. Three rows —
 * head, scrolling body, pinned footer — so a long warning can never push the
 * confirm out of reach. The sheet is the confirmation: no checkbox gate. In
 * flight the primary disables with a spinner and the sheet stays open; on
 * failure the server reason renders inline and the primary re-enables; on
 * success the sheet closes and the owner sees the new code at once.
 */
export function ResetCodeSheet({
  children,
  action = resetVenueCodeAction,
  onReset,
}: {
  /** The trigger — a text link on the team code panel. */
  children: ReactNode
  action?: typeof resetVenueCodeAction
  onReset: (state: VenueCodeResetActionState) => void
}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, pending] = useActionState(action, initialState)
  const handled = useRef<VenueCodeResetActionState | null>(null)

  useEffect(() => {
    if (!state.reset || handled.current === state) return
    handled.current = state
    onReset(state)
    setOpen(false)
    toast.success("Code reset", {
      description: "Today's code has changed. Tell the team the new one.",
    })
  }, [state, onReset])

  function handleOpenChange(next: boolean) {
    if (!next && pending) return
    if (!next && open && !state.reset) {
      void recordConsoleEventAction({
        name: "team_code_reset_cancelled",
        properties: {},
      })
    }
    setOpen(next)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>{children}</SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-modal="true"
        data-reset-code-sheet
        className="grid max-h-[86dvh] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 rounded-t-[var(--radius-sheet)] border-t-2 border-ink bg-card p-0 text-foreground"
      >
        <SheetHeader className="border-b-2 border-dashed border-line p-5">
          <SheetTitle className="text-xl font-extrabold">
            Reset today&apos;s code?
          </SheetTitle>
          <SheetDescription className="text-sm leading-6 text-muted-foreground">
            A new six-digit code replaces the current one for the rest of today.
          </SheetDescription>
        </SheetHeader>

        <div className="grid min-h-0 gap-3 overflow-y-auto p-5">
          {state.errors?.form && !state.reset ? (
            <Alert variant="destructive" className="border-2 border-ink">
              <AlertTitle>Code not reset</AlertTitle>
              <AlertDescription>{state.errors.form}</AlertDescription>
            </Alert>
          ) : null}
          <p className="text-sm leading-6 text-foreground">
            The old code stops working straight away. Anyone mid-way through
            typing it will have to start again — tell the team before you do
            this.
          </p>
        </div>

        <SheetFooter className="gap-2 border-t-2 border-ink p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          <form
            action={formAction}
            onSubmit={() => {
              void recordConsoleEventAction({
                name: "team_code_reset_confirmed",
                properties: {},
              })
            }}
          >
            <input type="hidden" name="confirmReset" value="true" />
            <Button
              type="submit"
              variant="destructive"
              size="lg"
              className="w-full"
              disabled={pending}
              aria-busy={pending}
            >
              {pending ? (
                <>
                  <Spinner aria-hidden="true" role={undefined} />
                  Resetting…
                </>
              ) : (
                "Reset the code now"
              )}
            </Button>
          </form>
          <SheetClose asChild>
            <Button
              type="button"
              variant="secondary"
              size="lg"
              className="w-full"
              disabled={pending}
            >
              Keep the current code
            </Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
