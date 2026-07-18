import { FormField, Input, SubmitButton } from "nabaperks"

export const Default = () => (
  <form className="grid max-w-xs gap-3">
    <FormField id="venue-name" label="Venue name">
      <Input id="venue-name" defaultValue="Bridge Street Coffee" />
    </FormField>
    <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
  </form>
)

export const Variants = () => (
  <form className="flex max-w-md flex-wrap items-center gap-3">
    <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
    <SubmitButton variant="reward" pendingLabel="Redeeming…">
      Redeem reward
    </SubmitButton>
    <SubmitButton variant="outline" size="sm" pendingLabel="Sending…">
      Email me the poster
    </SubmitButton>
  </form>
)

export const DisabledUntilValid = () => (
  <form className="grid max-w-xs gap-3">
    <FormField
      id="join-email"
      label="Email"
      description="We only use this to keep your stamps safe."
    >
      <Input id="join-email" type="email" placeholder="you@example.com" />
    </FormField>
    <SubmitButton disabled>Join the card</SubmitButton>
  </form>
)
