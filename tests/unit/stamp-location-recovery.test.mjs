import assert from "node:assert/strict"
import { test } from "node:test"
import {
  LOCATION_HELP,
  LOCATION_ISSUE_COPY,
  locationHelpBrowser,
  stampLocationIssue,
} from "@/lib/customer/stamp-location-recovery"
import { decideCaptureSubmission } from "@/lib/customer/stamp-location-capture"
import {
  reduceStampChoreography,
  stampChoreographyView,
} from "@/lib/customer/experience/stamp-choreography"

const fix = {
  latitude: 52.2437,
  longitude: 0.0836,
  accuracyMeters: 12,
  locationStatus: "granted",
  captureElapsedMs: 12,
}
const viewInput = {
  canStamp: true,
  current: 2,
  total: 5,
  stampDates: [],
  todayLabel: "11 Sep",
  rewardUnlocked: false,
  verificationRequired: true,
}

test("precision is checked before distance, with 100m accepted and above 100m unverified", () => {
  for (const accuracyMeters of [0, 12, 99, 100])
    assert.equal(stampLocationIssue({ ...fix, accuracyMeters }), null)
  const farPoorFix = { ...fix, latitude: -50, accuracyMeters: 100.01 }
  assert.equal(stampLocationIssue(farPoorFix), "poor_accuracy")
  assert.equal(
    decideCaptureSubmission(farPoorFix, {
      unverifiedGraceRemaining: 2,
      refusedWithoutFix: false,
    }).action,
    "refuse"
  )
  assert.equal(
    decideCaptureSubmission(farPoorFix, {
      unverifiedGraceRemaining: 2,
      refusedWithoutFix: false,
      useUnverifiedGrace: true,
    }).action,
    "submit"
  )
})

test("invalid or missing coordinates and accuracy are unavailable, never a usable fix", () => {
  for (const field of ["latitude", "longitude", "accuracyMeters"]) {
    for (const value of [null, NaN, Infinity])
      assert.equal(
        stampLocationIssue({ ...fix, [field]: value }),
        "unavailable"
      )
  }
  for (const patch of [
    { latitude: 91 },
    { longitude: -181 },
    { accuracyMeters: -1 },
  ])
    assert.equal(stampLocationIssue({ ...fix, ...patch }), "unavailable")
})

test("each capture failure has its own visible recovery state and unchanged stamp count", () => {
  for (const issue of [
    "denied",
    "timeout",
    "unavailable",
    "unsupported",
    "poor_accuracy",
  ]) {
    const state = reduceStampChoreography(
      { phase: "idle" },
      {
        type: "capture_refused",
        issue,
        message: LOCATION_ISSUE_COPY[issue].body,
      }
    )
    const view = stampChoreographyView(state, viewInput)
    assert.equal(state.locationIssue, issue)
    assert.equal(view.statusTitle, LOCATION_ISSUE_COPY[issue].title)
    assert.equal(view.displayCurrent, 2)
    assert.equal(view.locationControls, true)
    assert.equal(view.pendingIndex, -1)
    assert.doesNotMatch(
      view.statusTitle + view.statusBody,
      /outside|not at the pub/
    )
  }
})

test("only a server out-of-range refusal says outside the pub", () => {
  const state = reduceStampChoreography(
    { phase: "checking" },
    {
      type: "request_blocked",
      reason: "location_out_of_range",
      message: "Try again at the entrance.",
    }
  )
  const view = stampChoreographyView(state, viewInput)
  assert.equal(view.statusTitle, "You appear to be outside the pub")
  assert.equal(state.locationIssue, undefined)
})

test("copy detection separates iOS and Android Chrome, Safari, iPad desktop mode and unknown browsers", () => {
  const browser = (userAgent, platform = "iPhone", maxTouchPoints = 5) => ({
    userAgent,
    platform,
    maxTouchPoints,
  })
  assert.equal(
    locationHelpBrowser(
      browser("iPhone AppleWebKit Version/26.0 Mobile Safari/605.1")
    ),
    "ios-safari"
  )
  assert.equal(
    locationHelpBrowser(
      browser("iPhone AppleWebKit CriOS/145.0 Mobile Safari/604.1")
    ),
    "ios-chrome"
  )
  assert.equal(
    locationHelpBrowser(
      browser("Macintosh Version/26.0 Safari/605.1", "MacIntel")
    ),
    "ios-safari"
  )
  assert.equal(
    locationHelpBrowser(
      browser("Macintosh Version/26.0 Safari/605.1", "MacIntel", 0)
    ),
    "generic"
  )
  for (const ua of [
    "iPhone FxiOS/140 Safari/605.1",
    "iPhone EdgiOS/140 Safari/605.1",
    "iPhone AppleWebKit Mobile",
    "Android Chrome/145 Safari/537.36 EdgA/140",
    "Android Chrome/145 Safari/537.36 SamsungBrowser/28",
    "Linux; Android 16; Device Build/123; wv) Chrome/145 Safari/537.36",
  ])
    assert.equal(locationHelpBrowser(browser(ua)), "generic")
  assert.equal(
    locationHelpBrowser(
      browser("Android Chrome/145 Safari/537.36", "Linux armv8l")
    ),
    "android-chrome"
  )
  assert.equal(
    locationHelpBrowser(
      browser("Macintosh Chrome/145.0.0.0 Safari/537.36", "MacIntel", 0)
    ),
    "desktop-chrome"
  )
  assert.match(
    LOCATION_HELP["ios-safari"].steps,
    /Website Settings.*Location.*Allow/
  )
  assert.match(
    LOCATION_HELP["ios-chrome"].steps,
    /Location Services.*Chrome.*While Using/
  )
  assert.match(LOCATION_HELP["ios-chrome"].detail, /Reload or reopen/)
  assert.match(
    LOCATION_HELP["ios-chrome"].detail,
    /deleting Chrome and installing it again/
  )
  // Reinstalling clears the customer session, so the copy must send them back
  // through sign-in and the venue QR rather than stranding them on a dead tap.
  assert.match(LOCATION_HELP["ios-chrome"].detail, /removes its local data/)
  assert.match(LOCATION_HELP["ios-chrome"].detail, /sign in again/)
  assert.match(LOCATION_HELP["ios-chrome"].detail, /rescan the venue QR code/)
  assert.match(
    LOCATION_HELP["desktop-chrome"].steps,
    /padlock.*Location.*Allow/
  )
  assert.match(
    LOCATION_HELP["android-chrome"].detail,
    /in-page location button can reopen/
  )
})
