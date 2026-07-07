import assert from "node:assert/strict"
import { test } from "node:test"

import {
  announcementTemplatesForBusinessType,
  CAFE_ANNOUNCEMENT_TEMPLATES,
  GENERIC_ANNOUNCEMENT_TEMPLATES,
  PUB_ANNOUNCEMENT_TEMPLATES,
} from "@/lib/notifications/announcement-templates"

const TITLE_LIMIT = 80
const BODY_LIMIT = 180

const ALL_SETS = [
  PUB_ANNOUNCEMENT_TEMPLATES,
  CAFE_ANNOUNCEMENT_TEMPLATES,
  GENERIC_ANNOUNCEMENT_TEMPLATES,
]

test("every template fits the composer title and body limits", () => {
  for (const set of ALL_SETS) {
    for (const template of set) {
      assert.ok(
        template.title.length > 0 && template.title.length <= TITLE_LIMIT,
        `title too long or empty: ${template.id} (${template.title.length})`
      )
      assert.ok(
        template.body.length > 0 && template.body.length <= BODY_LIMIT,
        `body too long or empty: ${template.id} (${template.body.length})`
      )
      assert.ok(template.label.length > 0, `empty label: ${template.id}`)
    }
  }
})

test("templates carry no emoji or exclamation marks", () => {
  const emoji = /\p{Extended_Pictographic}/u
  for (const set of ALL_SETS) {
    for (const template of set) {
      const text = `${template.label} ${template.title} ${template.body}`
      assert.ok(!text.includes("!"), `exclamation mark in ${template.id}`)
      assert.ok(!emoji.test(text), `emoji in ${template.id}`)
    }
  }
})

test("template ids are unique within each set", () => {
  for (const set of ALL_SETS) {
    const ids = set.map((template) => template.id)
    assert.equal(new Set(ids).size, ids.length)
  }
})

test("pubs get the pub set", () => {
  assert.equal(announcementTemplatesForBusinessType("pub"), PUB_ANNOUNCEMENT_TEMPLATES)
})

test("daytime venues get the cafe set", () => {
  for (const type of ["cafe", "dessert", "bubble_tea"]) {
    assert.equal(
      announcementTemplatesForBusinessType(type),
      CAFE_ANNOUNCEMENT_TEMPLATES
    )
  }
})

test("everyone else — and an unknown or missing type — gets the generic set", () => {
  for (const type of ["takeaway", "barber", "salon", "other", "", null, undefined]) {
    assert.equal(
      announcementTemplatesForBusinessType(type),
      GENERIC_ANNOUNCEMENT_TEMPLATES
    )
  }
})
