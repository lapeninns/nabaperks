/**
 * The four bottom-tab destinations of the merchant console below the rail
 * breakpoint. Pure and framework-free so the analytics contract, the nav
 * model and the icon registry share one vocabulary.
 */
export const CONSOLE_TABS = ["counter", "activity", "numbers", "more"] as const

export type ConsoleTab = (typeof CONSOLE_TABS)[number]

const consoleTabSet = new Set<string>(CONSOLE_TABS)

export function isConsoleTab(value: unknown): value is ConsoleTab {
  return typeof value === "string" && consoleTabSet.has(value)
}
