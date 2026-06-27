import { StatusBanner } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <StatusBanner title="Stamp added">
      That's stamp 6 of 8 at Bridge Street Coffee — two to go.
    </StatusBanner>
  </div>
)

export const Tones = () => (
  <div className="grid max-w-md gap-3">
    <StatusBanner tone="success" title="Reward redeemed">
      Enjoy your free flat white. Your card has reset for the next one.
    </StatusBanner>
    <StatusBanner tone="warning" title="Reward expires soon">
      Redeem your free flat white before Sunday or it'll lapse.
    </StatusBanner>
    <StatusBanner tone="error" title="Couldn't add stamp">
      That QR code has already been scanned today. Try again on your next visit.
    </StatusBanner>
    <StatusBanner tone="neutral" title="New card started">
      You're collecting stamps at Bridge Street Coffee. Reward at 8.
    </StatusBanner>
  </div>
)
