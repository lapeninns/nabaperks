import assert from "node:assert/strict"
import { test } from "node:test"

import {
  birthdayRewardTemplateForBusinessType,
  CAFE_BIRTHDAY_REWARD,
  GENERIC_BIRTHDAY_REWARD,
  PUB_BIRTHDAY_REWARD,
} from "@/lib/merchant/birthday-reward-template"

const NAME_LIMIT = 100
const TERMS_MIN = 12
const TERMS_MAX = 500

const ALL = [PUB_BIRTHDAY_REWARD, CAFE_BIRTHDAY_REWARD, GENERIC_BIRTHDAY_REWARD]

test("every birthday template fits the reward name and terms limits", () => {
  for (const template of ALL) {
    assert.ok(
      template.rewardName.length > 0 && template.rewardName.length <= NAME_LIMIT,
      `name out of range: ${template.rewardName}`
    )
    assert.ok(
      template.rewardTerms.length >= TERMS_MIN &&
        template.rewardTerms.length <= TERMS_MAX,
      `terms out of range: ${template.rewardTerms.length}`
    )
  }
})

test("birthday templates carry no emoji or exclamation marks", () => {
  const emoji = /\p{Extended_Pictographic}/u
  for (const template of ALL) {
    const text = `${template.rewardName} ${template.rewardTerms}`
    assert.ok(!text.includes("!"), `exclamation mark: ${template.rewardName}`)
    assert.ok(!emoji.test(text), `emoji: ${template.rewardName}`)
  }
})

test("pubs get the pub birthday template", () => {
  assert.equal(birthdayRewardTemplateForBusinessType("pub"), PUB_BIRTHDAY_REWARD)
})

test("daytime venues get the cafe birthday template", () => {
  for (const type of ["cafe", "dessert", "bubble_tea"]) {
    assert.equal(
      birthdayRewardTemplateForBusinessType(type),
      CAFE_BIRTHDAY_REWARD
    )
  }
})

test("other and unknown types get the generic birthday template", () => {
  for (const type of ["takeaway", "barber", "salon", "other", "", null, undefined]) {
    assert.equal(
      birthdayRewardTemplateForBusinessType(type),
      GENERIC_BIRTHDAY_REWARD
    )
  }
})
