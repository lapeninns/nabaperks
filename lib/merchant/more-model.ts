import { formatMerchantBillingStatus } from "@/lib/merchant/billing-status-copy"

/**
 * Inputs for the More screen's live subtitles. Each is `null` when its read
 * failed, so the row still renders and navigates with no subtitle (handoff
 * §7.5). Pure so the harness and unit tests share the shape.
 */
export type MoreRowsInput = {
  /** Whether any print kit asset has been downloaded (the durable signal;
   *  a plain browser print of a table tent leaves no event). */
  readonly printKitDownloaded: boolean | null
  readonly memberCount: number | null
  /** The live campaign's name, `""` when none is running, null on failure. */
  readonly activeOfferName: string | null
  /** ISO instant of the last announcement, `""` when never sent, null on failure. */
  readonly lastAnnouncementAt: string | null
  readonly setup: {
    readonly completed: number
    readonly total: number
    readonly launchReady: boolean
  } | null
  /** Billing state, "not_started" for a required but missing billing row,
   *  "not_required" when the venue does not need billing; null on failure. */
  readonly billingStatus: string | null
  readonly trialDaysLeft: number | null
}

export type MoreRow = {
  readonly key:
    "poster" | "members" | "offers" | "announce" | "setup" | "account"
  readonly href: string
  readonly title: string
  readonly subtitle: string | null
  /** A mono chip beside the subtitle (the trial countdown on Account). */
  readonly chip: string | null
}

export function buildMoreRows(input: MoreRowsInput): readonly MoreRow[] {
  const rows: MoreRow[] = [
    {
      key: "poster",
      href: "/app/qr",
      title: "Poster & print",
      subtitle:
        input.printKitDownloaded === null
          ? null
          : input.printKitDownloaded
            ? "Print kit downloaded"
            : "No download yet",
      chip: null,
    },
    {
      key: "members",
      href: "/app/customers",
      title: "Members",
      subtitle:
        input.memberCount === null
          ? null
          : `${input.memberCount.toLocaleString("en-GB")} on the card`,
      chip: null,
    },
    {
      key: "offers",
      href: "/app/offers",
      title: "Offers",
      subtitle:
        input.activeOfferName === null
          ? null
          : input.activeOfferName || "None running",
      chip: null,
    },
    {
      key: "announce",
      href: "/app/announcements",
      title: "Announce",
      subtitle:
        input.lastAnnouncementAt === null
          ? null
          : input.lastAnnouncementAt
            ? `Last sent ${formatMoreDate(input.lastAnnouncementAt)}`
            : "Never sent",
      chip: null,
    },
  ]

  // Setup hides only when readiness explicitly reports launch-ready; a failed
  // readiness read keeps the row navigable, without a subtitle.
  if (!input.setup?.launchReady) {
    const left = input.setup
      ? Math.max(0, input.setup.total - input.setup.completed)
      : null
    rows.push({
      key: "setup",
      href: "/app/launch",
      title: "Setup",
      subtitle:
        input.setup && left !== null
          ? `${left} of ${input.setup.total} ${left === 1 ? "step" : "steps"} left`
          : null,
      chip: null,
    })
  }

  rows.push({
    key: "account",
    href: "/app/account?tab=profile",
    title: "Account",
    subtitle:
      input.billingStatus === null
        ? null
        : input.billingStatus === "not_required"
          ? "Billing not required"
          : `Billing ${formatMerchantBillingStatus(input.billingStatus)}`,
    chip:
      input.trialDaysLeft === null
        ? null
        : `${input.trialDaysLeft} ${input.trialDaysLeft === 1 ? "day" : "days"} left`,
  })

  return rows
}

/** "Fri 19 Sep" in London time for the announcement row. */
export function formatMoreDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return "recently"
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(date)
    .replace("Sept", "Sep")
}
