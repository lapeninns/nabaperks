import { Eyebrow } from "nabaperks"

export const Default = () => <Eyebrow>Loyalty</Eyebrow>

export const Labels = () => (
  <div className="flex flex-col gap-3">
    <Eyebrow>Merchant console</Eyebrow>
    <Eyebrow>Your stamp card</Eyebrow>
    <Eyebrow>This week at Bridge Street</Eyebrow>
  </div>
)

export const AboveHeading = () => (
  <div className="grid gap-2">
    <Eyebrow>Welcome back</Eyebrow>
    <h2 className="text-2xl font-extrabold text-foreground">
      Two stamps from a free flat white
    </h2>
  </div>
)
