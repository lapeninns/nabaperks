import {
  Field,
  FieldLabel,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldSet,
  FieldLegend,
  FieldSeparator,
  Input,
} from "nabaperks"

export const Default = () => (
  <div className="max-w-md">
    <Field>
      <FieldLabel htmlFor="venue-name">Venue name</FieldLabel>
      <Input id="venue-name" defaultValue="Bridge Street Coffee" />
      <FieldDescription>
        Shown on every stamp card your customers collect.
      </FieldDescription>
    </Field>
  </div>
)

export const WithError = () => (
  <div className="max-w-md">
    <Field data-invalid>
      <FieldLabel htmlFor="reward-threshold">Stamps per reward</FieldLabel>
      <Input
        id="reward-threshold"
        type="number"
        defaultValue={0}
        aria-invalid
      />
      <FieldError>Set at least 1 stamp before a reward unlocks.</FieldError>
    </Field>
  </div>
)

export const Group = () => (
  <div className="max-w-md">
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor="reward-name">Reward</FieldLabel>
        <Input id="reward-name" defaultValue="Free flat white" />
        <FieldDescription>
          What a customer earns after a full card.
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="card-size">Stamps to fill the card</FieldLabel>
        <Input id="card-size" type="number" defaultValue={8} />
      </Field>
    </FieldGroup>
  </div>
)

export const Fieldset = () => (
  <div className="max-w-md">
    <FieldSet>
      <FieldLegend>Counter sign-off</FieldLegend>
      <FieldDescription>
        Staff details printed on redemption receipts at Maple &amp; Rye.
      </FieldDescription>
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="barista">Barista name</FieldLabel>
          <Input id="barista" defaultValue="Priya" />
        </Field>
        <FieldSeparator />
        <Field>
          <FieldLabel htmlFor="staff-pin">Staff PIN</FieldLabel>
          <Input id="staff-pin" type="password" defaultValue="4821" />
          <FieldDescription>Used to approve reward redemptions.</FieldDescription>
        </Field>
      </FieldGroup>
    </FieldSet>
  </div>
)
