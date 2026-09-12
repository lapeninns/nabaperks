import assert from "node:assert/strict"
import { test } from "node:test"
import { offerTermExcerpts } from "@/components/loyalty/offer-pass-copy"

test("counter excerpts keep merchant restrictions verbatim and never infer eligibility", () => {
  const scope =
    "The 25% applies to your own food and drink, not to a shared or group bill."
  const identification = "Please show a valid student or staff card each time."
  assert.deepEqual(
    offerTermExcerpts(`${identification}\n${scope}\nOther terms remain.`),
    {
      scope,
      identification,
    }
  )
  assert.deepEqual(
    offerTermExcerpts("Available for local residents. Ask at the bar."),
    {
      scope: "",
      identification: "",
    }
  )
  assert.deepEqual(offerTermExcerpts(null), { scope: "", identification: "" })
})
