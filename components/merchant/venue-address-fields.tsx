import type {
  VenueAddressFieldErrors,
  VenueAddressFormFields,
} from "@/lib/merchant/venue-address"
import { cn } from "@/lib/utils"

export function VenueAddressFields({
  values,
  errors,
  labelClassName = "text-sm font-bold",
  inputClassName = "h-11 rounded-lg border-2 border-ink bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/35",
  columns = 1,
  onFieldChange,
  onAddressChange,
}: {
  /** Controlled field values so a provider selection can fill them via state. */
  values: VenueAddressFormFields
  errors?: VenueAddressFieldErrors
  labelClassName?: string
  inputClassName?: string
  /** 2 lays Town/city + Postcode side by side from the `sm` breakpoint up, so a
   *  full-width form fills the row instead of stacking four lone inputs. */
  columns?: 1 | 2
  /** Updates a single controlled field value. */
  onFieldChange?: (field: keyof VenueAddressFormFields, value: string) => void
  /** Fires on any manual address edit, e.g. to reset provider/pin provenance. */
  onAddressChange?: () => void
}) {
  const split = columns === 2
  const fullSpan = split ? "sm:col-span-2" : undefined

  return (
    <fieldset className={cn("grid gap-3", split && "sm:grid-cols-2")}>
      <legend className={cn(labelClassName, fullSpan)}>Venue address</legend>
      <AddressField
        id="addressLine1"
        name="addressLine1"
        label="Address line 1"
        placeholder="Building number and street"
        value={values.addressLine1}
        error={errors?.addressLine1}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        fieldClassName={fullSpan}
        onFieldChange={onFieldChange}
        onAddressChange={onAddressChange}
      />
      <AddressField
        id="addressLine2"
        name="addressLine2"
        label="Address line 2"
        placeholder="Flat, unit, or building name (optional)"
        value={values.addressLine2}
        error={errors?.addressLine2}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        fieldClassName={fullSpan}
        onFieldChange={onFieldChange}
        onAddressChange={onAddressChange}
      />
      <AddressField
        id="addressCity"
        name="addressCity"
        label="Town or city"
        placeholder="London"
        value={values.addressCity}
        error={errors?.addressCity}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        onFieldChange={onFieldChange}
        onAddressChange={onAddressChange}
      />
      <AddressField
        id="addressPostcode"
        name="addressPostcode"
        label="Postcode"
        placeholder="E1 6AN"
        autoComplete="postal-code"
        value={values.addressPostcode}
        error={errors?.addressPostcode}
        labelClassName={labelClassName}
        inputClassName={inputClassName}
        onFieldChange={onFieldChange}
        onAddressChange={onAddressChange}
      />
      {errors?.address ? (
        <p className={cn("text-sm text-destructive", fullSpan)}>
          {errors.address}
        </p>
      ) : null}
      <p className={cn("text-xs leading-5 text-muted-foreground", fullSpan)}>
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
  value,
  error,
  labelClassName,
  inputClassName,
  fieldClassName,
  onFieldChange,
  onAddressChange,
}: {
  id: string
  name: keyof VenueAddressFormFields
  label: string
  placeholder: string
  autoComplete?: string
  value: string
  error?: string
  labelClassName: string
  inputClassName: string
  fieldClassName?: string
  onFieldChange?: (field: keyof VenueAddressFormFields, value: string) => void
  onAddressChange?: () => void
}) {
  return (
    <label className={cn("grid gap-2", fieldClassName)} htmlFor={id}>
      <span className={labelClassName}>{label}</span>
      <input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => {
          onFieldChange?.(name, event.target.value)
          onAddressChange?.()
        }}
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
