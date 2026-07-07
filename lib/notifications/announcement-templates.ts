/**
 * Quick-fill templates for the venue announcement composer. Prefill only: a
 * template fills the compose fields when the merchant taps its chip and is never
 * sent until they press Send. Business-typed like
 * {@link import("@/lib/merchant/reward-presets").rewardPresetsForBusinessType}
 * so a cafe or a barber never sees pub-only prompts.
 *
 * Titles stay within the 80-character composer title limit and bodies within
 * the 180-character body limit; en-GB, no emoji, no exclamation marks.
 */
export type AnnouncementTemplate = {
  readonly id: string
  readonly label: string
  readonly title: string
  readonly body: string
}

export const PUB_ANNOUNCEMENT_TEMPLATES: readonly AnnouncementTemplate[] = [
  {
    id: "quiz-night",
    label: "Quiz night",
    title: "Quiz night is back this week",
    body: "Bring a team and play for the top table. Free to enter, first question about 8pm. Kitchen open beforehand if you fancy a bite.",
  },
  {
    id: "live-music",
    label: "Live music",
    title: "Live music this weekend",
    body: "We have a live set on this weekend. Come down early for a good spot, with the bar and kitchen open through the evening.",
  },
  {
    id: "sunday-roast",
    label: "Sunday roast",
    title: "Sunday roast is on this week",
    body: "Roasts are served from noon this Sunday while they last. Book a table or drop in, and regulars get first pick.",
  },
  {
    id: "kitchen-hours",
    label: "Kitchen hours",
    title: "Kitchen open from noon today",
    body: "The full menu is on from noon today, with a few tables still free for lunch. Come in for a proper bite.",
  },
  {
    id: "sport",
    label: "Sport",
    title: "The match is on the big screen",
    body: "We are showing the game this week on the big screen. Get here early for a seat, with the bar and kitchen open.",
  },
  {
    id: "quiet-night",
    label: "Quiet night",
    title: "A quieter one tonight",
    body: "It is calmer tonight, so there is room at the bar and tables free. A good evening for an unhurried pint and a bite.",
  },
]

export const CAFE_ANNOUNCEMENT_TEMPLATES: readonly AnnouncementTemplate[] = [
  {
    id: "fresh-bakes",
    label: "Fresh bakes",
    title: "Fresh bakes in this morning",
    body: "A new batch is out of the oven and on the counter today. Pop in for a coffee and something warm while it lasts.",
  },
  {
    id: "quiet-window",
    label: "Quiet window",
    title: "A quieter window this afternoon",
    body: "It is calmer between the lunch and after-work rush, so there is room to sit in. A good time for an unhurried coffee.",
  },
  {
    id: "weekend-treats",
    label: "Weekend treats",
    title: "Weekend treats on the counter",
    body: "We have a few specials in for the weekend alongside the usual. Come by for a coffee and a proper sit down.",
  },
  {
    id: "new-menu",
    label: "New on the menu",
    title: "New on the menu this week",
    body: "There is something new on the board this week. Ask the team what is on and try it with your usual order.",
  },
  {
    id: "open-early",
    label: "Open early",
    title: "We are open early today",
    body: "The doors are open early today with fresh coffee on. Start your morning with us before the day gets going.",
  },
]

export const GENERIC_ANNOUNCEMENT_TEMPLATES: readonly AnnouncementTemplate[] = [
  {
    id: "something-new",
    label: "Something new",
    title: "Something new this week",
    body: "We have something new on this week. Drop by to see what is on and make the most of it while it is here.",
  },
  {
    id: "quieter-time",
    label: "Quieter time",
    title: "A quieter time to visit",
    body: "It is calmer than usual right now, so there is less of a wait. A good moment to come in without the rush.",
  },
  {
    id: "weekend-open",
    label: "Weekend",
    title: "Open and ready this weekend",
    body: "We are open as usual across the weekend. Come in when it suits and we will look after you.",
  },
  {
    id: "for-regulars",
    label: "For regulars",
    title: "A note for our regulars",
    body: "Thanks for coming back. There is something on for members this week, so pop in and ask the team what is running.",
  },
  {
    id: "hours-today",
    label: "Hours today",
    title: "Our opening hours for today",
    body: "Here are today's opening times so you can plan your visit. Come by whenever works and we will be ready for you.",
  },
]

/**
 * The template set to prefill for a merchant, keyed on their `business_type`.
 * Pubs get pub prompts, daytime venues get cafe prompts, everyone else gets a
 * venue-neutral set. Mirrors the reward-preset selector's grouping.
 */
export function announcementTemplatesForBusinessType(
  businessType: string | null | undefined
): readonly AnnouncementTemplate[] {
  switch (businessType) {
    case "pub":
      return PUB_ANNOUNCEMENT_TEMPLATES
    case "cafe":
    case "dessert":
    case "bubble_tea":
      return CAFE_ANNOUNCEMENT_TEMPLATES
    default:
      return GENERIC_ANNOUNCEMENT_TEMPLATES
  }
}
