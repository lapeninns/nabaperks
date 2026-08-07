import { CheckmarkBadge04Icon } from "@hugeicons/core-free-icons"

import { Icon } from "@/components/brand"
import { deriveVenueInitials } from "@/components/brand/venue-mark"
import { WetInkSlam } from "@/components/motion"
import { cn } from "@/lib/utils"

type StampDotProps = {
  readonly earned: boolean
  readonly label: string
  readonly date?: string
  readonly slotNumber?: number
  readonly showEmptySlotNumber?: boolean
  readonly slammed?: boolean
  readonly compact?: boolean
  readonly venueName?: string
  readonly venueInitials?: string
  readonly className?: string
  readonly onSlamComplete?: () => void
}

type EarnedStampContentProps = {
  readonly earnedInitials: string
  readonly dateText: string | undefined
  readonly compact: boolean
}

export function StampDot({
  earned,
  label,
  date,
  slotNumber,
  showEmptySlotNumber = false,
  slammed = false,
  compact = false,
  venueName,
  venueInitials,
  className,
  onSlamComplete,
}: StampDotProps) {
  const emptyLabel = emptySlotLabel(showEmptySlotNumber, slotNumber)
  const earnedInitials = stampInitials(venueInitials, venueName)
  const dateText = stampDateText(date, compact)

  return (
    <span className="grid justify-items-center gap-1">
      <WetInkSlam
        active={earned && slammed}
        className="block w-full"
        onComplete={onSlamComplete}
      >
        <span
          role="img"
          aria-label={stampAriaLabel(earned, label, date)}
          data-earned={earned}
          data-stamp-earned={earnedStampData(earned)}
          data-compact={compactStampData(earned, compact)}
          data-slammed={slammedStampData(earned, slammed)}
          className={cn(
            "relative grid aspect-square w-full place-items-center overflow-hidden rounded-full border-2 transition-[background-color,border-color,transform] duration-[var(--w-dur-move)] ease-[var(--w-ease)] motion-reduce:transition-none",
            compact ? "min-h-9" : "min-h-11",
            earned
              ? "border-ink bg-stamp text-stamp-foreground shadow-sm"
              : "border-dashed border-border bg-background text-muted-foreground",
            className
          )}
        >
          <StampDotContent
            earned={earned}
            earnedInitials={earnedInitials}
            dateText={dateText}
            emptyLabel={emptyLabel}
            compact={compact}
          />
        </span>
      </WetInkSlam>
    </span>
  )
}

function StampDotContent({
  earned,
  earnedInitials,
  dateText,
  emptyLabel,
  compact,
}: EarnedStampContentProps & {
  readonly earned: boolean
  readonly emptyLabel: string
}) {
  return earned ? (
    <EarnedStampContent
      earnedInitials={earnedInitials}
      dateText={dateText}
      compact={compact}
    />
  ) : (
    <EmptyStampContent emptyLabel={emptyLabel} />
  )
}

function EarnedStampContent({
  earnedInitials,
  dateText,
  compact,
}: EarnedStampContentProps) {
  return (
    <span className="relative z-[1] flex flex-col items-center justify-center gap-px px-1">
      {earnedInitials ? (
        <span
          aria-hidden="true"
          className={cn(
            "font-mono leading-none font-bold uppercase",
            compact ? "text-[0.69rem]" : "text-[0.81rem]"
          )}
        >
          {earnedInitials}
        </span>
      ) : (
        <Icon
          icon={CheckmarkBadge04Icon}
          size={compact ? 16 : 20}
          strokeWidth={2.25}
        />
      )}
      {dateText ? (
        <StampDateText dateText={dateText} compact={compact} />
      ) : null}
    </span>
  )
}

function EmptyStampContent({ emptyLabel }: { readonly emptyLabel: string }) {
  return (
    <span
      aria-hidden="true"
      className="numeric-tabular text-base leading-none font-extrabold"
    >
      {emptyLabel}
    </span>
  )
}

function StampDateText({
  dateText,
  compact,
}: {
  readonly dateText: string
  readonly compact: boolean
}) {
  return (
    // Printed at the mono-id floor (10px) — never below; the full date also
    // lives in the disc's aria-label, so this stays legible print, not noise.
    <span
      aria-hidden="true"
      className={cn(
        "mono-id leading-none",
        compact
          ? "tracking-meta"
          : "mt-px border-t border-stamp-foreground/40 pt-px tracking-tag"
      )}
    >
      {dateText}
    </span>
  )
}

function emptySlotLabel(
  showEmptySlotNumber: boolean | undefined,
  slotNumber: number | undefined
): string {
  return showEmptySlotNumber && slotNumber !== undefined
    ? String(slotNumber)
    : ""
}

function stampInitials(
  venueInitials: string | undefined,
  venueName: string | undefined
): string {
  return venueInitials ?? (venueName ? deriveVenueInitials(venueName) : "")
}

function stampDateText(
  date: string | undefined,
  compact: boolean
): string | undefined {
  return date && compact ? date.split(" ")[0] : date
}

function stampAriaLabel(
  earned: boolean,
  label: string,
  date: string | undefined
): string {
  return date && earned ? `${label}, ${date}` : label
}

function earnedStampData(earned: boolean): "true" | undefined {
  return earned ? "true" : undefined
}

function compactStampData(
  earned: boolean,
  compact: boolean
): "true" | undefined {
  return earned && compact ? "true" : undefined
}

function slammedStampData(earned: boolean, slammed: boolean): true | undefined {
  return earned && slammed ? true : undefined
}
