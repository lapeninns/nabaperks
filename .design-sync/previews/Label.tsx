import { Label, Input } from "nabaperks"

export const Default = () => <Label>Customer phone number</Label>

export const WithInput = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="customer-phone">Customer phone number</Label>
    <Input id="customer-phone" placeholder="(212) 555-0147" />
  </div>
)

export const Pair = () => (
  <div className="grid max-w-sm gap-4">
    <div className="grid gap-2">
      <Label htmlFor="venue-name">Venue name</Label>
      <Input id="venue-name" placeholder="Bridge Street Coffee" />
    </div>
    <div className="grid gap-2">
      <Label htmlFor="reward-name">Reward</Label>
      <Input id="reward-name" placeholder="Free flat white" />
    </div>
  </div>
)
