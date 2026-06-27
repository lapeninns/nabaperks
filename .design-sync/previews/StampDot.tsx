import { StampDot } from "nabaperks"

export const Default = () => (
  <div className="w-12">
    <StampDot earned label="Stamp 3 earned" venueInitials="BS" />
  </div>
)

export const States = () => (
  <div className="flex max-w-md flex-wrap items-start gap-3">
    <div className="w-12">
      <StampDot
        earned
        label="Stamp 1 earned"
        venueInitials="BS"
        date="14 Jun"
      />
    </div>
    <div className="w-12">
      <StampDot earned label="Stamp 2 earned" venueInitials="BS" />
    </div>
    <div className="w-12">
      <StampDot
        earned={false}
        label="Stamp 3 empty"
        slotNumber={3}
        showEmptySlotNumber
      />
    </div>
    <div className="w-12">
      <StampDot earned={false} label="Stamp 4 empty" />
    </div>
  </div>
)

export const Compact = () => (
  <div className="flex max-w-xs flex-wrap items-start gap-2">
    <div className="w-9">
      <StampDot earned label="Stamp 1 earned" venueInitials="BS" compact />
    </div>
    <div className="w-9">
      <StampDot
        earned={false}
        label="Stamp 2 empty"
        slotNumber={2}
        showEmptySlotNumber
        compact
      />
    </div>
  </div>
)
