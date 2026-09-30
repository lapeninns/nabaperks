import assert from "node:assert/strict"
import { createRequire } from "node:module"
import { test } from "node:test"
import { build } from "esbuild"

import {
  initialStampChoreographyState,
  reduceStampChoreography,
  stampChoreographyView,
} from "@/lib/customer/experience/stamp-choreography"

/**
 * QA BUG-046 (38c42a1..2c45031): a card-completing stamp opens the next cycle
 * on the server, and the refresh that follows hands the stamp screen that new,
 * empty cycle (no dates, count 0). The in-place confirmation then filled every
 * slot of the completed card with today's label: 29 SEP, 29 SEP, 29 SEP
 * instead of 27 SEP, 28 SEP, 29 SEP.
 *
 * The collector's date choice (`datesForStampView`, from the real client
 * module) is driven through the real stamp choreography: the request starts
 * on the server's dates for the card being completed, the stamp lands, then
 * the props change to the next cycle.
 */
async function loadCollector() {
  const stubs = {
    "@/app/card/[membershipId]/actions":
      "export async function selfStampAction() {} export async function venueCodeStampAction() {}",
    "next/navigation":
      "export function useRouter() { return { refresh() {} } }",
  }
  const filter = /^(@\/app\/card\/\[membershipId\]\/actions|next\/navigation)$/
  const result = await build({
    entryPoints: ["components/customer/stamp-collector.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: [
      "react",
      "react-dom",
      "next/link",
      "next/image",
      "motion",
      "motion/*",
    ],
    logLevel: "silent",
    plugins: [
      {
        name: "stamp-collector-boundaries",
        setup(build) {
          build.onResolve({ filter }, ({ path }) => ({
            path,
            namespace: "stub",
          }))
          build.onLoad({ filter: /.*/, namespace: "stub" }, ({ path }) => ({
            contents: stubs[path],
            loader: "js",
          }))
        },
      },
    ],
  })
  const compiled = { exports: {} }
  new Function("require", "module", "exports", result.outputFiles[0].text)(
    createRequire(import.meta.url),
    compiled,
    compiled.exports
  )
  return compiled.exports
}

// Before the fix the collector handed its live `stampDates` props straight
// to the view; that is the fallback when the module has no date choice.
const { datesForStampView = ({ liveDates }) => liveDates } =
  await loadCollector()

const TODAY = "29 SEP"
const COMPLETING = {
  status: "issued",
  newStampCount: 3,
  rewardUnlocked: true,
  geoFlagged: false,
  bonusStampsApplied: 0,
}

function view(state, { current, stampDates, requestDates }) {
  const landed = state.phase === "printing" || state.phase === "confirmed"
  return stampChoreographyView(state, {
    canStamp: true,
    current,
    total: 3,
    stampDates: datesForStampView({
      liveDates: stampDates,
      requestDates,
      landed,
    }),
    todayLabel: TODAY,
    rewardUnlocked: false,
  })
}

test("Given a card completed by today's stamp When the next cycle's props arrive Then the confirmation keeps the completed card's dates", () => {
  const requestDates = ["27 SEP", "28 SEP"]
  let state = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
    current: 2,
  })
  state = reduceStampChoreography(state, {
    type: "request_issued",
    result: COMPLETING,
  })

  // The unlock refresh: the server now serves cycle 2, which is empty.
  const printing = view(state, { current: 0, stampDates: [], requestDates })
  assert.deepEqual(printing.dates, ["27 SEP", "28 SEP", TODAY])

  state = reduceStampChoreography(state, { type: "print_settled" })
  const confirmed = view(state, { current: 0, stampDates: [], requestDates })
  assert.deepEqual(confirmed.dates, ["27 SEP", "28 SEP", TODAY])
  assert.equal(confirmed.dates.filter((label) => label === TODAY).length, 1)
})

test("Given an ordinary stamp When the refreshed props carry the new date Then the server's dates are shown", () => {
  let state = reduceStampChoreography(initialStampChoreographyState, {
    type: "request_started",
    current: 1,
  })
  state = reduceStampChoreography(state, {
    type: "request_issued",
    result: { ...COMPLETING, newStampCount: 2, rewardUnlocked: false },
  })

  const shown = view(state, {
    current: 2,
    stampDates: ["27 SEP", TODAY],
    requestDates: ["27 SEP"],
  })
  assert.deepEqual(shown.dates, ["27 SEP", TODAY])
})

test("Given no stamp has landed When the card is idle Then the live dates are shown", () => {
  const shown = view(initialStampChoreographyState, {
    current: 2,
    stampDates: ["27 SEP", "28 SEP"],
    requestDates: null,
  })
  assert.deepEqual(shown.dates, ["27 SEP", "28 SEP"])
})
