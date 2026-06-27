import { Input, Label } from "nabaperks"

export const Default = () => (
  <div className="max-w-sm">
    <Input placeholder="Enter your phone number" />
  </div>
)

export const States = () => (
  <div className="grid max-w-sm gap-3">
    <Input placeholder="Enter your phone number" />
    <Input placeholder="Already enrolled" disabled />
    <Input aria-invalid placeholder="Invalid code" defaultValue="000000" />
  </div>
)

export const Labelled = () => (
  <div className="grid max-w-sm gap-2">
    <Label htmlFor="venue-code">Venue code</Label>
    <Input id="venue-code" placeholder="e.g. BRIDGE-ST" />
  </div>
)
