"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"

import { MonoTag, ReceiptCard } from "@/components/brand"
import {
  HomeEmailPrompt,
  type EmailPromptReason,
} from "@/components/customer/home-email-prompt"
import {
  dismissedSuggestionsSnapshot,
  dismissSuggestion,
  parseDismissedSuggestions,
  subscribeSuggestionDismissals,
  SUGGESTIONS_UNHYDRATED,
  unhydratedSuggestionsSnapshot,
} from "@/components/customer/home-suggestion-store"
import { Button } from "@/components/ui/button"
import {
  HOME_SETUP_SUGGESTION_COPY,
  pickHomeSetupSuggestion,
  type HomeSetupSuggestionKind,
} from "@/lib/customer/home-setup-suggestion"

/**
 * Home's single optional setup slot. The server passes the candidates in
 * priority order (`homeSetupSuggestionCandidates`); this shows the first one
 * this viewer has not set aside, so two prompts can never render together.
 *
 * The email prompt stays mounted in this slot whatever is picked (reason null
 * when it is not the pick): confirming an email re-renders home without the
 * email ask, and the prompt must survive that render to show the confirmation.
 * While it is not asking, it renders the picked link suggestion instead.
 */
export function HomeSetupSuggestion({
  candidates,
  emailReason,
  initialEmail = null,
  codePending = false,
}: {
  candidates: readonly HomeSetupSuggestionKind[]
  emailReason: EmailPromptReason
  initialEmail?: string | null
  codePending?: boolean
}) {
  const snapshot = useSyncExternalStore(
    subscribeSuggestionDismissals,
    dismissedSuggestionsSnapshot,
    unhydratedSuggestionsSnapshot
  )
  const picked =
    snapshot === SUGGESTIONS_UNHYDRATED
      ? null
      : pickHomeSetupSuggestion(candidates, parseDismissedSuggestions(snapshot))

  // "Not now" unmounts the card holding the focused button. Once the next
  // suggestion (or nothing) has rendered, focus moves to its heading, or to
  // the page heading, so keyboard and screen-reader users keep their place.
  const slotRef = useRef<HTMLDivElement>(null)
  const [dismissals, setDismissals] = useState(0)
  const onDismissed = useCallback(() => setDismissals((count) => count + 1), [])
  useEffect(() => {
    if (dismissals > 0) focusAfterDismissal(slotRef.current)
  }, [dismissals])

  return (
    <div ref={slotRef} className="contents">
      <HomeEmailPrompt
        reason={picked === "email" ? emailReason : null}
        initialEmail={initialEmail}
        codePending={codePending}
        onDismissed={onDismissed}
        fallback={
          picked && picked !== "email" ? (
            <HomeLinkSuggestion kind={picked} onDismissed={onDismissed} />
          ) : null
        }
      />
    </div>
  )
}

/** The next suggestion's heading, else the page heading; never `<body>`. */
function focusAfterDismissal(slot: HTMLElement | null): void {
  const target =
    slot?.querySelector<HTMLElement>("h2") ??
    document.querySelector<HTMLElement>("main h1, h1")
  if (!target) return
  if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
  target.focus()
}

function HomeLinkSuggestion({
  kind,
  onDismissed,
}: {
  kind: Exclude<HomeSetupSuggestionKind, "email">
  onDismissed: () => void
}) {
  const copy = HOME_SETUP_SUGGESTION_COPY[kind]
  return (
    <ReceiptCard
      className="grid gap-3"
      padding="sm"
      data-testid="home-setup-suggestion"
      data-suggestion={kind}
    >
      <MonoTag tone="plain">Optional</MonoTag>
      <h2 className="text-base leading-tight font-extrabold">{copy.title}</h2>
      <p className="text-sm leading-6 text-muted-foreground">{copy.body}</p>
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="secondary">
          <Link href={copy.href}>{copy.action}</Link>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => {
            dismissSuggestion(kind)
            onDismissed()
          }}
        >
          Not now
        </Button>
      </div>
    </ReceiptCard>
  )
}
