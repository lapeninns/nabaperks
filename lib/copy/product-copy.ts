/**
 * Brand/product copy that appears to end users on more than one surface
 * (marketing landing, merchant preview, customer card/flows). Kept here in a
 * dependency-free leaf module so the wording stays identical everywhere and any
 * surface can import it without crossing a domain boundary.
 *
 * Add a string here only when it is genuinely the same message shown in 2+
 * places (surfaces or repeated routes/components); surface-specific copy belongs
 * in that surface's own copy module (lib/marketing/facts.ts,
 * lib/customer/experience/copy.ts, lib/legal/content.ts, lib/merchant/*).
 */

/** Placeholder "reward name" for a mystery reward that is still sealed. */
export const SEALED_REWARD_NAME = "Something's under there."

/** Explanatory note shown beside a sealed mystery reward. */
export const SEALED_REWARD_NOTE =
  "Mystery reward stays sealed until the final stamp."

/** Shown when a merchant's loyalty programme is inactive / unavailable. */
export const LOYALTY_PROGRAMME_UNAVAILABLE =
  "This loyalty programme is unavailable right now."

/**
 * Label for the "return to my wallet" recovery link shown across customer error,
 * empty, and system states (404, offline, scanner, join/card/reward errors).
 */
export const OPEN_MY_CARDS_LABEL = "Open my cards"

/** Eyebrow/label for a sealed mystery reward on join + card surfaces. */
export const MYSTERY_REWARD_SEALED_LABEL = "Mystery reward, sealed"

/** Title shown when a customer opens a loyalty card/QR that isn't available. */
export const CARD_UNAVAILABLE_TITLE = "This loyalty card is unavailable"

/** Recovery helper paired with an unavailable card/QR — points to venue staff. */
export const ASK_TEAM_FOR_QR = "Ask a team member for the current loyalty QR."
