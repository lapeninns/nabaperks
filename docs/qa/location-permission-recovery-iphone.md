# Location permission recovery: real phone evidence

Checked on 11 September 2026 through iPhone Mirroring on the owner's iPhone,
using live Nabaperks in Chrome and Safari. All times below are Europe/London
(BST). At the conclusion of these checks, the core direct-on-tap correction
was live at `e53a4048b7c6`. The expanded recovery UI and browser help were local
changes on `codex/location-permission-recovery`. Subsequent release status
requires a fresh candidate, provider and live-journey readback.

## Current result

- **Safari: real website prompt and verified production stamp succeeded.**
  At 23:10, the same Nabaperks card was open in a Safari private tab. Tapping
  **Use my location** displayed the native **“nabaperks.com” Would Like to
  Use Your Location** prompt. It explained that Safari already had precise
  location access and asked whether the website could also access location.
  Selecting **Allow** added the 11 September stamp and displayed the unlocked
  reward. The card changed from two stamps to three. Reward collection was not
  attempted or verified. Reloading Safari at 23:16 preserved all three stamps
  and the unlocked reward; the app-install suggestion was dismissed and the
  successful card was left visible.
- **Production ledger corroboration:** a read-only query at 23:12:24 found
  exactly one matching membership and one earned event in the bounded
  23:09–23:12 window. That event was created at **23:10:55.281** with
  `geo_verification = verified`; the same window contained zero unverified
  events and zero venue-code events. No coordinates or customer contact data
  were exported. This is a real stamp, not a fixture or a simulated callback.
- **Chrome on this iPhone: the website request remained denied.** Its iOS app
  permission was allowed, and the live button reached the actual app-level
  permission prompt after iOS was set to ask. Granting Chrome permission did
  not restore website access in the observed session. Safari success does not
  establish that Chrome's saved website state has recovered.
- A production health read at **23:11:59** still reported `e53a4048b7c6`.
  Health alone is liveness evidence; the physical prompt and ledger readback
  provide the Safari journey evidence.

## What the button can do on each platform

The direct customer tap invokes the standard
`navigator.geolocation.getCurrentPosition` request, without awaiting the
Permissions API or treating a remembered application flag as authoritative.
The browser and operating system decide whether a prompt is needed:

| Permission state                   | Expected behaviour                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Not decided / ask                  | Browser or OS can show its real permission prompt.                                                                        |
| Already allowed                    | Request a position; another prompt is not required.                                                                       |
| Saved denial or device restriction | Browser can return permission denied without a prompt. Show recovery settings and allow another customer-initiated retry. |

There is no standard web API that forces every OS to redisplay a previously
refused permission prompt or lets the website reset that choice. Do not use a
fake system prompt, polling, origin changes or broad permission/data resets.
Every retry is a fresh customer-initiated location request, not a guarantee of
another permission sheet. A location denial is not evidence that the customer
is outside the venue.

## Chrome observations and interpretation

iPhone Location Services was on. **Settings → Privacy & Security → Location
Services → Chrome** already had **While Using the App** selected and
**Precise Location** on. Reloading Nabaperks and restarting Chrome did not
resolve the website denial.

In the installed Chrome version, **… → Site information** showed Connection,
About this page and Last visited, without a Location control. **Settings →
Content settings** also had no Location control. Do not direct iPhone Chrome
customers to a desktop/Android-only permission toggle.

Selecting **Ask Next Time Or When I Share** in the iPhone's Chrome location
settings, then returning to Nabaperks, produced the real iOS **Allow “Chrome”
to use your location?** prompt. **Allow While Using App** was selected with
**Precise: On**. The final app permission was allowed, but Nabaperks still
received a denial. After the core fix was deployed, the same native prompt
was specifically triggered by tapping **Use my location** at 22:43.

Upstream WebKit code separates application location permission from website
permission and can remember website refusals without presenting another
prompt. That behaviour is consistent with this session. The precise stored
decision on this phone was not inspected, and upstream source is not proof of
the exact installed iOS implementation. Do not promise a universal cooldown
duration or claim the stored refusal has been definitively identified.

## Earlier deployment finding

At 22:32, production reported `6b2999e1013a`. That revision returned
`denied_remembered` when `navigator.permissions.query` said `denied`, before
calling `getCurrentPosition`. The screen used the same copy for this early
return and an actual callback denial, so its message did not prove GPS was
actually requested.

At 22:41, production reported `e53a4048b7c6`, which removes that early return.
The phone loaded **Use my location** and **Enter venue code** after a reload.
The remaining Chrome denial on this revision cannot be explained solely by
the old preliminary Permissions API check.

## Customer help

The local recovery screen explains: **If access was blocked before, your
browser may not show the prompt again. Update its location settings, then
retry.** Browser detection selects help copy only, with a manual selector.

- **Safari on iPhone/iPad:** Safari page menu → More (…) → Website Settings →
  Location → Allow, then return and retry. If needed, check Location Services
  and Safari Websites in iPhone Settings, including precise location.
- **Chrome on iPhone/iPad:** iPhone Settings → Privacy & Security → Location
  Services → Chrome → While Using the App; enable precise location. If this
  is already allowed, Chrome may still remember a website denial. Reload or
  reopen Nabaperks and retry once. If it remains blocked, open the same page
  in Safari and allow location there, or request today's venue code from the
  team. This session verifies Safari as an alternative on this phone, not a
  guaranteed recovery on every device.
- **Chrome on Android:** site controls beside the address bar → Permissions →
  Location → Allow. Chrome Settings → Site settings → Location is another
  documented entry point. Also check the device's location setting and
  Chrome's app permission. Android instructions are documentation-backed;
  no physical Android device was tested in this session.
- **Other browsers:** check the site's location permission and the device's
  permission for the browser, then retry. Embedded browsers may need the page
  opened in the customer's usual browser.

Do not promise that reloading or repeatedly tapping alone clears a saved
denial. The venue-code alternative and the existing server geofence remain
authoritative. The expanded local implementation also makes unverified grace
an explicit choice; ordinary GPS retries do not silently spend it.

## Automated evidence boundary

The earlier local checks passed 96 browser tests across Chromium, Firefox and
WebKit, plus a real local database journey in which two denied retries created
no stamp attempts and recovery persisted one verified visit with no grace
consumption. Browser transitions in those tests use controlled callbacks.
They establish application handling, not native permission behaviour on every
operating system. The physical Safari result above is separate real-device,
real-provider evidence. Chrome website recovery and physical Android recovery
remain unverified.

After the cross-platform help update, 24 focused location unit tests and four
browser help/accessibility checks passed (mobile WebKit, desktop WebKit,
Chromium and Firefox, at 320 × 568). TypeScript, changed-source ESLint,
documentation generation checks and `git diff --check` also passed. These are
the checks rerun for the latest copy/detection change; the whole release gate
was not rerun or asserted green.

## Primary sources

- [W3C Geolocation request and permission model](https://www.w3.org/TR/geolocation/#request-a-position)
- [WebKit iOS application and website permission stages](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/WKGeolocationProviderIOS.mm)
- [WebKit iOS website permission decisions](https://github.com/WebKit/WebKit/blob/main/Source/WebKit/UIProcess/ios/WKWebGeolocationPolicyDeciderIOS.mm)
- [Chrome location settings on iPhone and iPad](https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DiOS&hl=en)
- [Chrome location settings on Android](https://support.google.com/chrome/answer/142065?co=GENIE.Platform%3DAndroid&hl=en)
- [Safari website settings on iPhone](https://support.apple.com/en-gb/guide/iphone/iphb01fc3c85/ios)
