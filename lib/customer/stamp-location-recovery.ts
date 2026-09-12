import type { StampLocationCapture } from "@/lib/customer/stamp-location-capture"

export type StampLocationIssue =
  "denied" | "timeout" | "unavailable" | "unsupported" | "poor_accuracy"

// Mirrors the server's precision ceiling, not its distance decision. Only the
// server can verify presence against the venue pin and effective radius.
export function stampLocationIssue(
  capture: StampLocationCapture
): StampLocationIssue | null {
  switch (capture.locationStatus) {
    case "cancelled":
      return null
    case "denied":
    case "timeout":
    case "unsupported":
      return capture.locationStatus
    case "granted": {
      const { latitude, longitude, accuracyMeters } = capture
      if (
        latitude === null ||
        !Number.isFinite(latitude) ||
        Math.abs(latitude) > 90 ||
        longitude === null ||
        !Number.isFinite(longitude) ||
        Math.abs(longitude) > 180 ||
        accuracyMeters === null ||
        !Number.isFinite(accuracyMeters) ||
        accuracyMeters < 0
      )
        return "unavailable"
      return accuracyMeters > 100 ? "poor_accuracy" : null
    }
    default:
      return "unavailable"
  }
}

export const LOCATION_ISSUE_COPY: Record<
  StampLocationIssue,
  { title: string; body: string }
> = {
  denied: {
    title: "Location access is blocked",
    body: "Your browser or phone hasn't allowed location. We need it to verify you're at the pub.",
  },
  timeout: {
    title: "Location took too long",
    body: "Move nearer a window or the entrance, then tap Try Again.",
  },
  unavailable: {
    title: "Location is unavailable",
    body: "Check your phone's Location Services and connection, then tap Try Again.",
  },
  unsupported: {
    title: "Location isn't supported here",
    body: "Open Nabaperks in Safari or Chrome, or ask a team member for today's venue code.",
  },
  poor_accuracy: {
    title: "Location isn't accurate enough",
    body: "We can't tell if you're at the pub yet. Turn on Precise Location or move nearer the entrance, then tap Try Again.",
  },
}

export type LocationHelpBrowser =
  "ios-safari" | "ios-chrome" | "android-chrome" | "desktop-chrome" | "generic"

/** Copy only, with a manual selector. Never controls capture or verification. */
export function locationHelpBrowser(
  browser: Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints">
): LocationHelpBrowser {
  if (
    /Android/.test(browser.userAgent) &&
    /Chrome\//.test(browser.userAgent) &&
    !/EdgA\/|OPR\/|SamsungBrowser\/|; wv\)/.test(browser.userAgent)
  )
    return "android-chrome"
  if (
    /Chrome\//.test(browser.userAgent) &&
    !/Android|Mobile|Edg\/|EdgA\/|OPR\/|SamsungBrowser\//.test(
      browser.userAgent
    )
  )
    return "desktop-chrome"
  const ios =
    /iPad|iPhone|iPod/.test(browser.userAgent) ||
    (browser.platform === "MacIntel" && browser.maxTouchPoints > 1)
  if (!ios) return "generic"
  if (/CriOS\//.test(browser.userAgent)) return "ios-chrome"
  if (
    /Version\/.*Safari\//.test(browser.userAgent) &&
    !/FxiOS|EdgiOS|OPiOS/.test(browser.userAgent)
  )
    return "ios-safari"
  return "generic"
}

export const LOCATION_HELP: Record<
  LocationHelpBrowser,
  { label: string; steps: string; detail: string }
> = {
  "ios-safari": {
    label: "iPhone / iPad Safari",
    steps:
      "Safari page menu → More (…) → Website Settings → Location → Allow. Return here and tap Try Again.",
    detail:
      "Still blocked? In iPhone Settings → Privacy & Security → Location Services, turn on Location Services. Open Safari Websites, allow location while using the app and turn on Precise Location. Safari may call the section ‘Website Settings For’.",
  },
  "ios-chrome": {
    label: "Chrome on iPhone / iPad",
    steps:
      "iPhone Settings → Privacy & Security → Location Services → Chrome → While Using the App. Turn on Precise Location, return here and tap Try Again.",
    detail:
      "Chrome can still remember a blocked website permission even when iPhone Settings allows Chrome. Reload or reopen Nabaperks and try once more. If it stays blocked, open the same page in Safari and allow location there, or ask a team member for today's venue code. Chrome on iPhone may not show a Location switch in Site information. If Chrome still blocks this site after that, delete Chrome, install it again, open Nabaperks, and choose Allow when it asks for location. That can clear a saved block Chrome on iPhone does not let you reset.",
  },
  "android-chrome": {
    label: "Chrome on Android",
    steps:
      "Use the location button on this page if Chrome shows one, and choose Allow. Otherwise open site controls beside the address bar → Permissions → Location → Allow, then tap Try Again.",
    detail:
      "A previous deny or a timed-out prompt can leave this site blocked so Chrome will not show the ordinary prompt again. The in-page location button can reopen it. You can also open Chrome → Settings → Site settings → Location and check Nabaperks under blocked sites. In Android Settings, check that Location is on and Chrome has location permission. Turn on precise location if your phone offers it. Menu names may vary by phone.",
  },
  "desktop-chrome": {
    label: "Chrome on a computer",
    steps:
      "Use the location button on this page if Chrome shows one, and choose Allow. Otherwise click the padlock beside the address bar → Site settings → Location → Allow, reload, then tap Try Again.",
    detail:
      "A previous deny or a timed-out prompt can leave Location blocked for this site, and the padlock switch may stay off. Chrome Settings → Privacy and security → Site settings → Location lists blocked sites; remove Nabaperks, set Location so sites can ask, then reload. The in-page location button can reopen Chrome's prompt without those settings when your Chrome version offers it.",
  },
  generic: {
    label: "Other browser",
    steps:
      "Enable Location in your browser's site settings, return here, then tap Try Again.",
    detail:
      "Look for the site controls beside the address bar. Also check that your device's Location Services allow your browser. In an in-app browser, try opening Nabaperks in your usual browser.",
  },
}
