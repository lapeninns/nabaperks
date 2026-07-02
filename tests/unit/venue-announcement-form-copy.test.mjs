import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { venueAnnouncementFormErrorCopy } from "@/lib/notifications/venue-announcement-form-copy"

describe("venueAnnouncementFormErrorCopy", () => {
  it("maps rate-limit responses to the daily product limit", () => {
    const copy = venueAnnouncementFormErrorCopy("rate_limited")

    assert.equal(copy.title, "Daily limit reached")
    assert.match(copy.body, /up to 2 a day/)
    assert.equal(copy.tone, "warning")
  })

  it("maps moderation responses to plain-text guidance", () => {
    const copy = venueAnnouncementFormErrorCopy("moderation_rejected")

    assert.equal(copy.title, "Check the wording")
    assert.match(copy.body, /plain venue update/)
    assert.doesNotMatch(copy.body, /</)
    assert.equal(copy.tone, "error")
  })

  it("keeps validation and unknown errors short and free of exclamation marks", () => {
    const validation = venueAnnouncementFormErrorCopy("invalid_body")
    const unknown = venueAnnouncementFormErrorCopy("network_error")

    assert.match(validation.body, /at least 10 characters/)
    assert.equal(unknown.title, "Announcement not sent")

    for (const copy of [validation, unknown]) {
      assert.doesNotMatch(copy.title, /!/)
      assert.doesNotMatch(copy.body, /!/)
    }
  })
})
