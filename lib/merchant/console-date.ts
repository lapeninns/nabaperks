import { formatShortDate } from "@/lib/merchant/london-date"

/**
 * The console top bar's date in the receipt register: "Mon 21 Sep", read in
 * the venue's trading timezone (Europe/London) so a phone set to another zone
 * still shows the day the till is on. Rendered uppercase by `.mono-meta`.
 */
export function formatConsoleDate(date: Date): string {
  return formatShortDate(date, "Europe/London")
}
