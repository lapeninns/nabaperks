import type { VenueAddressFieldErrors, VenueAddressFormFields } from "@/lib/merchant/venue-address"

export function VenueAddressFields({
  values,
  errors,
  labelClassName = "text-sm font-bold",
  inputClassName = "h-11 rounded-lg border-2 border-ink bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
}: {
  values?: Partial<VenueAddressFormFields>
  errors?: VenueAddressFieldErrors
  labelClassName?: string
  inputClassName?: string
}) {
  return (
    <fieldset className="grid gap-3">
      <legend className={labelClassName}>Venue address</legend>
      <AddressField
        id="addressLine1"
        name="addressLine1"
        label="Address line 1"
        placeholder="Building number and street"
        defaultValue={values?.addressLine1}
        error={errors?.addressLine1}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
      />
      <AddressField
        id="addressLine2"
        name="addressLine2"
        label="Address line 2"
        placeholder="Flat, unit, or building name (optional)"
        defaultValue={values?.addressLine2}
        error={errors?.addressLine2}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
      />
      <AddressField
        id="addressCity"
        name="addressCity"
        label="Town or city"
        placeholder="London"
        defaultValue={values?.addressCity}
        error={errors?.addressCity}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
      />
      <AddressField
        id="addressPostcode"
        name="addressPostcode"
        label="Postcode"
        placeholder="E1 6AN"
        autoComplete="postal-code"
        defaultValue={values?.addressPostcode}
        error={errors?.addressPostcode}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
      />
      {errors?.address ? (
        <p className="text-sm text-destructive">{errors.address}</p>
      ) : null}
      <p className="text-xs leading-5 text-muted-foreground">
        UK venues only. We use these details to place your venue on the map for
        optional GPS stamp checks.
      </p>
    </fieldset>
  )
}

function AddressField({
  id,
  name,
  label,
  placeholder,
  autoComplete,
  defaultValue,
  error,
  labelClassName,
  inputClassName,
}: {
  id: string
  name: string
  label: string
  placeholder: string
  autoComplete?: string
  defaultValue?: string
  error?: string
  labelClassName: string
  inputClassName: string
}) {
  return (
    <label className="grid gap-2" htmlFor={id}>
      <span className={labelClassName}>{label}</span>
      <input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        autoComplete={autoComplete}
        defaultValue={defaultValue}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputClassName}
      />
      {error ? (
        <span id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </span>
      ) : null}
    </label>
  )
}
