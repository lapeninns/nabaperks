import type { Page } from "@playwright/test"

/**
 * Console-rebuild harness lanes and helpers, kept out of `helpers/harness.ts`
 * on purpose: that file sits in the reviewed CI selection dependency graph
 * (the a11y sweep imports it), so changing it turns a product PR into a
 * selection-policy change that needs staged qualification inputs. New lanes
 * are registered here for the console specs; adding them to the a11y and
 * visual sweeps is a separate, staged policy change.
 */
export const CONSOLE_HARNESS_ROUTES = {
  numbers: "/dev/app-harness/numbers",
  more: "/dev/app-harness/more",
} as const

/**
 * The merchant console shell is a fixed-height grid whose body row scrolls,
 * so a `fullPage` screenshot of a harness lane would only show the first
 * screen. Before a full-page capture, let the shell grow with its content
 * (as the print stylesheet does) so the baseline still reviews the whole lane.
 */
export async function expandConsoleShellForFullPage(page: Page): Promise<void> {
  await page.addStyleTag({
    content:
      "[data-console-shell]{display:block!important;height:auto!important;min-height:0!important}" +
      "[data-console-body]{overflow:visible!important}" +
      "[data-console-pin]{position:static!important}",
  })
}
