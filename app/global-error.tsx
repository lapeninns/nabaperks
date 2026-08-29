"use client"

import "./globals.css"

/**
 * Global error boundary — the last resort when the root layout itself fails.
 * It must render its own <html>/<body>, so it stays deliberately minimal
 * (no brand component imports — each one is another failure surface) while
 * still speaking Wet Ink through the token classes from globals.css.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en-GB">
      <body className="font-sans">
        <main className="grid min-h-svh place-items-center bg-background px-6 py-10 text-foreground">
          {/* role="alert" and autoFocus are inline rather than shared: this
              boundary catches a failing root layout, so every import is another
              surface that can fail. `.surface-card` is a plain globals.css
              class, not a component, so it is safe here — and it keeps this
              screen on the same elevation vocabulary as the rest of the
              product instead of a hand-rolled shadow-xs. */}
          <section
            autoFocus
            tabIndex={-1}
            role="alert"
            className="surface-card focus-ring w-full max-w-sm p-6 text-center"
          >
            <h1 className="text-xl font-extrabold">Something went wrong</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Nabaperks hit a snag loading this page. Nothing you saved has been
              lost.
            </p>
            <button
              type="button"
              onClick={() => reset()}
              className="focus-ring mt-5 inline-flex h-11 w-full items-center justify-center rounded-lg border-2 border-ink bg-primary px-4 font-bold text-primary-foreground"
            >
              Try again
            </button>
          </section>
        </main>
      </body>
    </html>
  )
}
