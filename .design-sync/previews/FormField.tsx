import { FormField, Input } from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <FormField id="member-name" label="Name on the card">
      <Input id="member-name" placeholder="Maya Reyes" defaultValue="Maya Reyes" />
    </FormField>
  </div>
)

export const WithDescription = () => (
  <div className="max-w-md">
    <FormField
      id="member-phone"
      label="Mobile number"
      description="We text a one-time code so you can claim rewards on any device."
    >
      <Input
        id="member-phone"
        type="tel"
        inputMode="tel"
        placeholder="07700 900142"
      />
    </FormField>
  </div>
)

export const WithError = () => (
  <div className="max-w-md">
    <FormField
      id="member-email"
      label="Email for reward reminders"
      error="Enter a valid email so we can let you know when your reward is ready."
    >
      <Input
        id="member-email"
        type="email"
        aria-invalid="true"
        defaultValue="maya@bridge"
      />
    </FormField>
  </div>
)
