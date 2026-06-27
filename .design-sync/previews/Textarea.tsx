import { Textarea, Label } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <Textarea placeholder="Add a note for your team about this campaign…" />
  </div>
)

export const WithValue = () => (
  <div className="max-w-md">
    <Textarea defaultValue="Double stamps all week to celebrate Bridge Street Coffee's third birthday. Reward unchanged: a free flat white at 8 stamps." />
  </div>
)

export const Labelled = () => (
  <div className="grid max-w-md gap-2">
    <Label htmlFor="reward-terms">Reward terms</Label>
    <Textarea
      id="reward-terms"
      placeholder="One free flat white per completed card. Dine-in only, not valid with other offers."
    />
  </div>
)
