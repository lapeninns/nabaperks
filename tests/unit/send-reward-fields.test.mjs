import assert from "node:assert/strict"
import { test } from "node:test"

import {
  SEND_REWARD_SUCCESS,
  hasSendRewardErrors,
  validateSendRewardFields,
} from "@/lib/merchant/send-reward-fields"

/**
 * rewards merchant sent R-5/R-6 — pure send-reward validation + the uniform
 * success copy that never reveals membership.
 */

const VALID = {
  membershipId: "mem_1",
  rewardName: "A drink on us",
  rewardTerms: "One drink, on the house — thanks for being a regular.",
  expiresInDays: "30",
  message: "Cheers!",
}

test("valid input passes and parses the expiry", () => {
  const { errors, expiresInDays } = validateSendRewardFields(VALID)
  assert.equal(hasSendRewardErrors(errors), false)
  assert.equal(expiresInDays, 30)
})

test("member id OR contact is required", () => {
  const { errors } = validateSendRewardFields({ ...VALID, membershipId: "", contact: "" })
  assert.match(errors.contact, /email or phone/i)

  const withContact = validateSendRewardFields({
    ...VALID,
    membershipId: "",
    contact: "regular@example.com",
  })
  assert.equal(withContact.errors.contact, undefined)
})

test("name, terms, expiry, and message bounds are enforced", () => {
  assert.match(validateSendRewardFields({ ...VALID, rewardName: "" }).errors.rewardName, /enter/i)
  assert.match(validateSendRewardFields({ ...VALID, rewardName: "x".repeat(101) }).errors.rewardName, /100/)
  assert.match(validateSendRewardFields({ ...VALID, rewardTerms: "too short" }).errors.rewardTerms, /detail/i)
  assert.match(validateSendRewardFields({ ...VALID, expiresInDays: "45" }).errors.expiresInDays, /valid expiry/i)
  assert.match(validateSendRewardFields({ ...VALID, message: "x".repeat(201) }).errors.message, /200/)
})

test("the success copy is uniform and gives nothing away", () => {
  assert.match(SEND_REWARD_SUCCESS, /Reward sent/)
  assert.match(SEND_REWARD_SUCCESS, /waiting when they join/)
})
