import { Toaster } from "nabaperks"

export const Default = () => (
  <div className="relative h-40 max-w-md overflow-hidden rounded-2xl border bg-background p-4">
    <p className="text-sm text-muted-foreground">
      Toast region for Bridge Street Coffee. Notifications like &ldquo;Stamp
      added&rdquo; or &ldquo;Free flat white redeemed&rdquo; appear here when
      triggered from the counter.
    </p>
    <Toaster position="bottom-right" />
  </div>
)

export const TopCenter = () => (
  <div className="relative h-40 max-w-md overflow-hidden rounded-2xl border bg-background p-4">
    <p className="text-sm text-muted-foreground">
      Redemption confirmations surface at the top so a barista sees them across
      the counter.
    </p>
    <Toaster position="top-center" richColors />
  </div>
)
