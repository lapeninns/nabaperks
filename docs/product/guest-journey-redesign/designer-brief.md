# Designer brief: Nabaperks guest loyalty journey prototype

Status: brief for a clickable prototype. Prepared 30 September 2026 from the
source on branch `codex/guest-journey-redesign`. The prototype informs the
implementation; it does not change product policy. Where this brief states a
rule, the rule wins over visual preference.

---

## 1. Your role and the outcome

You are designing a clickable, high-fidelity prototype of the **guest side**
of Nabaperks, a no-app digital stamp card for UK pubs, cafés and restaurants.
A guest scans a QR code at the counter, proves who they are with a one-time
code, earns a stamp, and after enough stamps collects a (usually sealed,
"mystery") reward.

The current product works but asks the guest to understand our internal
account system. Screens combine several jobs, repeat decisions, explain wallet
linking and verification rules inside forms, and push profile tasks on top of
the moment of success.

**Your outcome:** a prototype in which a guest can earn a stamp, get back to
their card, recover when a code does not arrive, and understand what a reward
needs, without ever meeting a redundant choice, a competing task or internal
terminology.

Design for this person:

- Standing at a busy counter, phone in one hand, possibly a drink in the other.
- Giving the screen a few seconds of attention at a time.
- On weak or no mobile signal, sometimes on venue Wi-Fi only.
- Not a tech enthusiast. Has never heard of "wallets", "verification" or
  "accounts" and does not want to.

Every screen must answer, at a glance:

1. What am I doing?
2. What do I do next?
3. What just happened?
4. How do I fix it if it went wrong?

---

## 2. Hard rules (non-negotiable)

These come from the product owner, security and legal. Do not design around
them; design with them.

### 2.1 Identity and sign-in

- **Phone is the only way in.** A guest joins and signs in with their UK
  mobile number and a one-time code (sent by WhatsApp by default, with "Text me
  instead" as an alternative channel).
- **Email is never a sign-in option.** Do not add "Sign in with email",
  "Use email", a method picker, or an email tab to the welcome screen, the
  phone screen or the returning sign-in screen. Email addresses are cheap to
  create, so email as an entry point enables referral abuse.
- **Email exists only as a fallback** when the phone code cannot get through
  (no mobile network). It appears **only on the phone code screen**, and only
  after the server allows it: 30 seconds after the latest code was sent, or
  immediately if the send failed. The server enforces this; the prototype
  should show the link appearing after the wait (a quiet countdown or a link
  that fades in), never before.
- A phone number typed before a failed code is **unverified**. Never show
  anything that implies the guest now owns it, that stamps attached to it are
  visible, or that it has been saved.
- After a valid fallback email code, the guest goes **straight to the joining
  step** (or straight to today's stamp if that email already has a card at this
  venue). There is **no "Email confirmed, choose email again" screen**. That
  screen is being removed.
- Never reveal another customer's information: no masked numbers from other
  cards, no "this number already has 4 stamps", no "an account exists".

### 2.2 Consent

- **Required loyalty terms and optional marketing are separate controls.**
- **Remove "Yes to all" / select-all.** No combined control of any kind.
- Marketing is **never pre-ticked**, is clearly optional, and the guest must be
  able to join and get their stamp without it.
- Do not add a separate marketing screen the guest must pass through to get
  their stamp.
- The full venue terms stay one tap away (a sheet, not a new page).

### 2.3 Stamps and rewards

- Earning a stamp and collecting a reward are **separate tasks**.
- A guest who joined through the email fallback can join and earn stamps
  without verifying a phone.
- **Before collecting a reward** the current rules require: full name, date of
  birth, a verified email and a verified phone number. Some rewards also
  require photo ID at the counter (age check). Keep all of these. Show **only
  the next unmet requirement**, never the whole list as a form.
- Completing setup **does not change the collection date**. Never imply it
  does.
- Show the collection QR/code **only** when the reward is ready and nothing is
  outstanding.
- Referral bonuses only count once the referred guest has a verified phone.
  You do not need to explain this to guests; just do not promise referral
  rewards to email-only guests.

### 2.4 Copy

- Plain British English. **No emoji. No exclamation marks.** Avoid em dashes
  in guest copy; use a full stop or a comma.
- **No speed or simplicity promises** we cannot guarantee: no "in 20
  seconds", "one message", "one tick", "instantly", "No spam, ever", "the
  moment you accept".
- **No internal vocabulary**: wallet, account (except where managing the
  account is the task), verified/locked, linking, continuity, handoff,
  eligibility, merchant scan, trading day, location check, session.
- Vocabulary to use consistently:
  - **card**: a venue's loyalty card.
  - **stamps**: what you earn per visit.
  - **reward**: what a full card unlocks.
  - **code**: the one-time number we send. Also "reward code" for the thing
    shown at the counter.
  - **my cards**: the guest's home.
- Do not invent venue facts, reward contents, delivery times or dates. Where
  the data gives a concrete date/time (for example "Ready from Wed 1 Oct,
  12:00"), show it. Where it does not, say what the guest can do instead.
  Never write "tomorrow" when the venue's day resets at a configured time.
- Voice is Wet Ink: "a good barista, not a SaaS". Short declaratives at
  emotional peaks ("Stamp added." "That's one."). No "register", "sign up",
  "create an account".

### 2.5 Brand and system

- **Keep the Wet Ink design system.** Do not introduce a new visual identity.
  References: `DESIGN.md`, `app/globals.css`, `components/brand`,
  `components/loyalty`, `components/customer/customer-flow-system.tsx`.
- Key tokens: paper `#f6f1e6`, card `#fbf8f1`, ink `#211c16`, ink-soft
  `#4f473d`, vermillion (primary/stamp) `#cf330a`, cobalt `#2b43c8`, leaf
  (reward ready) `#16733c`, sun (seal) `#f5a623`, destructive `#c0301c`.
  Bricolage Grotesque for spoken voice, Space Mono uppercase for receipt facts.
  Hard offset shadows (`4px 4px 0 ink`), 10px default radius, 44px minimum tap
  target, customer max width 410px.
- Register rule: receipt voice (mono, uppercase) is for facts such as
  "CARD Nº OC-0248" or "4 OF 8". Spoken voice is for anything human. Never mix
  them in one line.
- Supports light and dark themes via tokens.

---

## 3. Design principles for every screen

1. **One job per screen.** If a screen asks for two unrelated things, split
   the job or defer one.
2. **One visually dominant action.** Exactly one filled primary button.
   Secondary actions are quiet text links or outline buttons, placed below.
3. **Group fields that serve the same task** (name and date of birth together).
   Do not make a page per field.
4. **Never ask the guest to repeat a decision** already made (for example,
   choosing email after they already chose and confirmed email).
5. **Recognise completed requirements.** A saved or verified detail appears as
   done (with a tick and the value, masked where appropriate), never as a
   field to fill again.
6. **Preserve context during recovery.** A failed code keeps the typed number;
   a failed phone check during reward setup keeps the reward on screen.
7. **Outcome before anything else.** After a stamp, the stamp result owns the
   screen. Optional setup waits.
8. **Optional means optional.** Optional items are labelled "Optional",
   visually quiet, and dismissible.
9. **Progress indicators only when true.** Show "Step 2 of 3" only if there
   really are three steps left for this guest. Never "Step 1 of 1".
10. **Thumb reach.** The primary action sits in the lower half of the screen
    on mobile and stays visible above the on-screen keyboard.

---

## 4. The journey map

```
Scan venue QR ─► /q/{qr} ─┬─ signed in, has card here ─► Stamp screen
                          └─ signed out ─► Welcome
Welcome ─► Phone number ─► Phone code ─┬─ card exists here ─► Stamp screen
                                       ├─ no card here ─► Join (terms) ─► Stamp added
                                       └─ code not arriving (after wait)
                                            └─► Email fallback ─► Email code
                                                 ├─ email has card here ─► Stamp screen
                                                 ├─ email known, no card here ─► Join (terms)
                                                 └─ new email (mode full) ─► Join (terms)
Stamp added ─► View my card ─► Card ─► (full) Reward ─► Before you collect ─► Reward code
Home (my cards) ─ quiet optional setup: add phone / find previous stamps / birthday
```

Rollout modes you must represent (server setting `CUSTOMER_EMAIL_AUTH_MODE`):

| Mode       | Email fallback on the code screen | New card from a fallback email  |
| ---------- | --------------------------------- | ------------------------------- |
| `off`      | Not shown at all                  | No                              |
| `existing` | Shown after the wait              | No: only opens an existing card |
| `full`     | Shown after the wait              | Yes                             |

Design the fallback so it works in all three. In `existing`, a new email gets
an honest dead end with a way back to the phone (see screen J7).

---

## 5. Screen-by-screen specification

For each screen: **intention**, **entry**, **primary action**, **proposed
copy** (a starting point; improve it within the rules), **states** you must
prototype, **secondary actions**, and **what is deliberately not here**.
The code name in brackets maps to the implementation (`experience.kind` in
`lib/customer/experience/types.ts`) so hand-off is exact.

### Q. QR entry (`/q/{qrId}`)

- **Q1 Busy** (rate limited). Headline "Too many scans just now". Support
  "Wait a moment, then scan the QR again. Your stamps are safe." Primary
  "Open my cards".
- **Q2 QR not recognised / unavailable.** Headline "This QR isn't working".
  Support "Ask a member of staff for the current loyalty QR." Primary "Open
  my cards".
- **Q3 Couldn't load** (network). Headline "We couldn't load this card".
  Support "Check your signal or Wi-Fi, then try again." Primary "Try again".

### J1. Welcome (`join_welcome`)

- **Intention:** "What is this, and what do I get?"
- **Entry:** signed-out scan of a venue QR (may carry a referral or pending
  offer).
- **Primary:** "Get my first stamp" → Phone number.
- **Content:** venue mark and name; the card visual with stamp 1 about to land;
  "{n} stamps to a mystery reward" (only if the card is a mystery reward;
  otherwise the configured reward name); a small "How it works" of three
  short, true lines, for example "Enter your mobile number", "Type the code we
  send you", "Your first stamp goes on your card".
- **Secondary:** "View venue terms" (sheet). One quiet line for returning
  guests: "Been here before? Use the same mobile number and your card opens."
- **Remove:** "Save it to your number in 20 seconds", "No app, no password",
  the "Joined by email? The code screen offers email after 30 seconds" line,
  and any email mention.
- **Variants:** with referral ("{Friend's first name or 'A friend'} invited
  you" only if the data provides it, otherwise no referral line); with pending
  offer (a small reminder chip, not a competing CTA); no QR (direct join from
  the venue page: "Save your card", no stamp promise).

### J2. Phone number (`join_phone`)

- **Intention:** "Tell them my number."
- **Primary:** "Send my code".
- **Proposed copy:** headline "Enter your mobile number"; support "We'll send
  you a code to confirm it's you." Field label "UK mobile number", numeric
  keypad, `autocomplete="tel"`, example placeholder "07700 900123".
- **Secondary:** "Back" (to welcome). Channel is shown in one quiet line: "We
  send codes by WhatsApp. You can switch to text on the next screen."
- **States:** empty; invalid number ("Enter a UK mobile number, like 07700
  900123"); sending (button busy, announced "Sending your code"); send failed
  ("We couldn't send a code just now." with "Try again", and, if email mode is
  on, a quiet "Get a code by email instead", because this is a genuine
  delivery failure); rate limited ("Too many codes requested. Try again in a
  few minutes.").
- **Remove:** "Only used to keep your stamps safe. No spam, ever." (it
  contradicts the later optional marketing choice).
- **Not here:** email, name, birthday, marketing.

### J3. Phone code (`join_otp`, phone)

- **Intention:** "Type the code I just got."
- **Primary:** "Continue" (auto-submit when the 6th digit is entered is fine
  if it is also announced).
- **Proposed copy:** headline "Enter your code"; support "Sent by WhatsApp to
  07•••• ••123." (masked, and the real channel).
- **Input:** one-time-code field, `inputmode="numeric"`,
  `autocomplete="one-time-code"`, large digits, paste-friendly.
- **Secondary, in this order, visually quiet:**
  1. "Send a new code" with a visible cooldown ("Send a new code in 0:24").
  2. "Text me instead" (only when the current channel is WhatsApp).
  3. "Wrong number? Change it" (returns to J2 with the number prefilled).
  4. After the server wait, and only if email mode is not `off`: "No code?
     Get one by email instead". Before the wait, show nothing, or a calm
     line "If nothing arrives, more options appear shortly." Do not show a
     ticking "30".
- **States:** waiting; wrong code ("That code didn't work. Check it and try
  again." field keeps focus, digits cleared); expired ("That code has
  expired. Send a new code." with the send action as the primary); new code
  sent ("New code sent. Use the latest one." announced politely); too many
  attempts ("Too many tries. Send a new code in a few minutes."); signing in
  (button busy "Checking"); a server hiccup after a good code ("We couldn't
  finish signing you in. Enter the same code again.").
- **Fix today's bug in the design:** an expired saved code plus "Send a new
  code" must never say "Enter a valid phone number". It should take the guest
  to J2 with the number kept and the message "Your code expired. Send a new
  one."

### J4. Email fallback (`join_email`)

- **Intention:** "My phone code isn't arriving; get me in another way."
- **Entry:** only from J3 after the wait, or J2 after a failed send.
- **Primary:** "Send code by email".
- **Proposed copy:** headline "Get your code by email"; support "Useful when
  there's no mobile signal. Works on the venue's Wi-Fi." Field "Email
  address", `type="email"`, `autocomplete="email"`.
- **Secondary:** "Back to the text code" (returns to J3; the phone code may
  still arrive).
- **States:** invalid address; sending; email delayed ("Email is slow right
  now. Try again shortly, or go back to the text code."); rate limited.
- **Not here:** any statement about wallets, future phone verification, older
  stamps or rewards.

### J5. Email code (`join_otp`, email)

- As J3, with: support "Sent to j•••@g•••.com."; after the wait "Not there?
  Check spam or junk."; secondary "Send a new code", "Change email", "Back to
  the text code".
- **On success** (server decides, no choice screen):
  - email has a card at this venue → Stamp screen (S1);
  - email has a Nabaperks card elsewhere but not here → Join (J6);
  - new email and mode `full` → Join (J6);
  - new email and mode `existing` → J7.

### J6. Join: terms and optional marketing (`join_terms`)

- **Intention:** "Agree to the card's rules and get my stamp."
- **Primary:** "Add my first stamp" (with QR) or "Save my card" (no QR).
  Disabled or blocked until terms are ticked, with an inline explanation on
  tap ("Tick the card terms to continue.").
- **Layout:** the card with an empty first stamp slot at the top (context);
  then:
  - **Required:** one checkbox. "I agree to the {Venue} card terms." with a
    "Read the terms" link opening the sheet. A short summary of anything that
    **materially** affects joining, shown once here, not on sign-in screens:
    "Collecting a reward needs your name, date of birth and a confirmed phone
    number and email." Plus "Photo ID may be checked" if the reward has an age
    check.
  - **Optional, visually separate, under an "Optional" label:** "Send me
    offers from {Venue}" with the channel(s) named ("by WhatsApp or text" /
    "by email", matching what the guest actually has confirmed). Unticked by
    default. One line: "You can change this any time in your profile."
- **Remove:** "Yes to all", "Last step" eyebrow if it is not the last step,
  "One tick and stamp 1 is on your card", "Lands on your card the moment you
  accept".
- **States:** default; terms not ticked; submitting (announced "Adding your
  stamp"); location needed (see S4); server error with retry keeping ticks.

### J7. No card for this email (mode `existing` only)

- **Intention:** honest dead end with a way forward.
- **Proposed copy:** headline "No card uses this email"; support "Join with
  your mobile number instead."
- **Primary:** "Use my mobile number" → J2.
- **Not here:** "Continue with email", "Open my existing wallet with my
  phone", "Use a different email" as three competing choices.

### J8. Returning guest (`join_returning`)

- Headline "Welcome back"; receipt line "4 OF 8 STAMPS". Primary with QR:
  "Get today's stamp" → S1. Without QR: "Open my card".

### L. Returning sign-in (`/home/login`)

- **L1 Phone** (same component language as J2/J3 so the guest learns it
  once): headline "Open my cards"; support "Enter the mobile number you use
  with Nabaperks." Primary "Send my code". Footer "New here? Scan the QR at a
  venue to get your first stamp."
- **L2 Code:** as J3, including the email fallback rule. Primary "Continue".
- **L3 No cards for that number:** "We couldn't find any cards for this
  number." Primary "Scan a venue QR". Secondary "Try a different number".
  If email mode is not `off` and email was opened by this failure, "Get a
  code by email instead" may appear as a quiet link (fallback rule).
- **Remove:** "Welcome back" for first-time visitors; the account-continuity
  error text.

### S. Earning a stamp (`/card/{id}/stamp`)

- **S1 Ready to stamp** (`stamp_confirm`): the card, today's empty slot
  pulsing; primary "Stamp my card" (press-and-hold or tap, keep the existing
  stamp press interaction). Headline "Today's stamp"; support: venue name.
- **S2 Stamp added** (the peak moment): the stamp slams on (existing
  choreography). Headline "Stamp added."; receipt line "5 OF 8"; support
  "3 more to your reward." Primary "View my card". Nothing else competes. No
  email prompt, no phone prompt, no birthday prompt, no previous-stamps
  prompt. A single quiet line is allowed: "Next stamp from {concrete date and
  time}" when the data provides it; otherwise "You can get your next stamp on
  your next visit."
- **S3 Card complete / reward unlocked:** headline "Your card is full.";
  support "Your reward is unlocked." Primary "See my reward".
- **S4 Location needed** (geofence): "We need to check you're at {Venue}."
  Primary "Share my location". Secondary "Enter the venue code instead" (from
  staff). Location-denied help as an expandable, not a wall of text.
- **S5 Already stamped today** (`card_stamped_today`): headline "You've
  already got today's stamp"; support "Next stamp from {concrete date and
  time}" when known, else "Come back on your next visit." Primary "View my
  card". Remove "next venue trading day" and "daily reset".
- **S6 QR doesn't match / opened without QR** (`stamp_unmatched`): headline
  "Scan the QR at {Venue}" or "This QR is for a different venue"; support
  "Your stamps are safe." Primary "Scan the QR" (opens scanner). Secondary
  "Open my cards".
- **S7 Can't stamp right now** (blocked reasons such as paused programme or
  daily cap): headline naming the situation in guest words ("Stamps are
  paused at {Venue}"); support with what to do; primary "View my card".
- **S8 First-stamp recovery** (join succeeded, stamp did not): "Your card is
  saved. Your first stamp didn't go through." Primary "Try again". Replace
  "Give the stamp one calm retry."
- **Remove everywhere after a stamp:** "Added without a location check. 1 more
  can be added without one."

### C. Card (`/card/{id}`, `card_collecting`)

- **Intention:** "Where am I on this card?"
- Card visual with filled stamps; receipt line "5 OF 8"; the reward (sealed
  mystery or named); "3 more to your reward".
- **Primary:** only if there is something to do (for example "See my reward"
  when unlocked). Otherwise no primary; "Open my cards" as secondary.
- **Just joined:** headline "Welcome to {Venue}"; no setup prompts on this
  view.
- **Referral share:** secondary panel below the card ("Invite a friend"),
  only after the first stamp; never above the card progress.

### H. Home: my cards (`/home`)

- **Intention:** "Show me my cards and anything ready."
- Order: (1) a reward that is ready to collect, (2) cards, (3) at most **one**
  optional setup suggestion, (4) activity snippet.
- **Optional setup slot:** exactly one quiet, dismissible card, chosen by
  priority:
  1. A reward is unlocked and needs setup → "Get your reward ready" (not
     optional in effect, so it is the ready-reward card's own action, not a
     separate prompt).
  2. No confirmed phone → "Add your mobile number. You'll need it to collect
     rewards."
  3. Guest may have stamps saved under another number → "Find my previous
     stamps".
  4. No email → "Add an email for reward updates" (only when the product needs
     it for reward collection).
  5. No birthday → "Add your birthday" (only if the venue uses it).
- **Fix:** a reward blocked by setup must never say "Ready for scan" or show
  a QR on home. It says "Reward unlocked. Finish setting up to collect." with
  "Get it ready".
- **Empty state:** "No cards yet. Scan the QR at a venue to get your first
  stamp." Primary "Scan a venue QR".

### R. Rewards (`/home/rewards`, `/reward/{id}`)

- **R1 List:** group by what the guest can do: "Ready to collect", "Needs
  setting up" (not "Coming soon"), "On the way" (with concrete date), and
  "Collected".
- **R2 Waiting** (`reward_waiting`): headline = the reward name (or "Mystery
  reward" sealed); support "Ready from Wed 1 Oct, 12:00." (capitalised
  properly; today it lower-cases to "wed 1 oct"). If setup is outstanding,
  one line: "You can get it ready now." with action "Get it ready". Must not
  imply that setup brings the date forward.
- **R3 Before you collect** (`reward_waiting` preparing / `reward_ready`
  with setup outstanding): keep the reward visible at the top (name, venue,
  date). Below, **only the next unmet requirement**:
  - **Details:** "Add your name and date of birth" (two fields, one screen).
  - **Email:** "Confirm your email" (enter address → code → done).
  - **Phone:** "Confirm your mobile number" (number → code → done).
  - Completed requirements show as a compact checklist with ticks ("Name and
    birthday saved", "Email confirmed"), never as fields.
  - Progress "Step 2 of 3" only when accurate for this guest; the phone step
    must be counted from the start.
  - **Phone code failure here:** keep the typed number; offer "Send a new
    code", "Text me instead", "Change number". Keep the reward card on screen.
    Leaving and returning resumes at the same requirement.
  - **Number already used by another card:** "This number is used by another
    Nabaperks card. Sign in with that number, or ask staff at {Venue}." Do not
    reveal anything about the other card.
- **R4 Ready to collect** (`reward_ready`, nothing outstanding): headline the
  reward name; the reward code / QR large and bright, screen-brightness hint;
  "Show this at the counter."; if age check "Staff will check photo ID." No
  other prompts.
- **R5 Collected** (`redeemed_proof`): "Collected. Enjoy." with the time; primary
  "Back to my card".
- **R6 Unavailable / expired:** reward-specific wording (do not reuse "Card
  unavailable").

### P. Profile (`/home/profile`)

- Sections: **Your details** (name, birthday), **Contact** (mobile, email: each
  shows value and status "Confirmed" or an action "Confirm"), **Messages from
  venues** (optional marketing, one row per channel, plus push), **Previous
  stamps** (the find/connect task), **Sign out**.
- Remove the warning "Email sign-in is paused, so you could not sign back in…"
  (it exposes a rollout setting and contradicts the email rule). If a guest has
  no confirmed phone, the honest message is "Add your mobile number so you can
  sign in on another phone." shown in the Contact section.
- Remove "verified and locked for account security"; a confirmed email shows
  "Confirmed" and, if it cannot be changed here, "To change it, ask staff at a
  venue."
- Resolve the overlapping controls: one "Messages from venues" block with
  per-channel toggles, and channel preference only when both WhatsApp and text
  are on.

### W. Find my previous stamps (wallet linking)

- **Intention:** "I had stamps under another number or email; bring them
  here."
- **Entry:** Profile "Previous stamps", the home suggestion, or after reward
  setup when the guest's phone or email is in use elsewhere. **Never** during
  joining or on the stamp success screen.
- **Flow:** explain in one line ("Confirm the other number or email and we'll
  bring its stamps here."), then the same code pattern as J2/J3 or J4/J5.
- **Outcomes:**
  - **Brought together:** "Your stamps are together now." Show the combined
    card counts. Do not promise email sign-in.
  - **Needs sign-in again:** "For your security, sign in again, then confirm
    the other number." Primary "Sign in again" returning to where they were
    (for example the reward), not a hard-coded profile page.
  - **Needs a review:** "We can't bring these together automatically. Your
    stamps haven't changed. Ask staff at {Venue} for help." No promise of a
    timeline.
  - **Used by someone else:** "This number is used by another card. Sign in
    with that number, or ask staff for help."
- Never show another card's balances before ownership is proven.

### E. Shared error and edge screens

- Error boundary: "Something went wrong. Your stamps are safe." Primary "Try
  again". (No em dash.)
- Signed out on this device; session reset; offline banner ("You're offline.
  We'll try again when you're back online.").
- `/scan` scanner: eyebrow removed ("Customer scanner" is internal); headline
  "Scan the venue QR"; statuses "Starting camera", "Point at the QR on the
  counter", "Found it. Opening your card", "That's not a Nabaperks QR", camera
  blocked with how to allow it.
- `/start`: guests only ("Scan a venue QR", "Open my cards"); the merchant
  link becomes a small footer link.

---

## 6. Accessibility and interaction requirements

- WCAG 2.2 AA contrast on paper and dark themes; never rely on colour alone
  (stamps also differ by fill/mark).
- 44px minimum targets; primary action reachable by thumb; sticky action bar
  that stays above the on-screen keyboard (test with the keyboard open at
  375×667).
- Visible focus on every control; logical focus order; focus moves to the
  headline on step change and to the first invalid field on error.
- Live regions: polite for "Code sent", "New code sent", "Stamp added";
  assertive only for blocking errors.
- Code inputs: `autocomplete="one-time-code"`, numeric keypad, paste support,
  no auto-advance traps.
- Respect `prefers-reduced-motion`: the stamp slam becomes a fade.
- Labels are real `<label>`s; checkbox text is the label; the "Read the
  terms" link does not toggle the checkbox.
- No horizontal overflow at 320px width.

---

## 7. What to deliver

1. **A clickable prototype** (HTML/CSS/JS or React; plain and portable, using
   the Wet Ink tokens above as CSS variables) covering every screen and state
   in section 5, with a state switcher (a side panel or query parameter) so
   each state can be opened directly. Include rollout mode (`off`,
   `existing`, `full`) and channel (WhatsApp, text) toggles.
2. **Three breakpoints**: 375px (primary), 768px, 1280px (the customer column
   stays 410px max, centred, with sensible surrounding paper).
3. **Light and dark** versions via tokens.
4. **Happy-path walk-throughs** clickable end to end:
   - new guest by phone to "Stamp added";
   - returning guest by phone to "Stamp added";
   - phone code never arrives → email fallback → new card (mode `full`);
   - phone code never arrives → email fallback → existing card at this venue;
   - already stamped today;
   - card full → reward waiting → before you collect (details, email, phone
     with one failed code) → ready → collected;
   - find my previous stamps: linked, review needed, used by someone else.
5. **A copy deck**: a table of every string, keyed by screen and state, in the
   order it appears, so it can be moved into `lib/customer/experience/copy.ts`
   without paraphrasing.
6. **A change list**: screens removed, merged or split versus today (see
   section 8), with one sentence of rationale each.
7. **Annotations** for focus order, live-region announcements, and keyboard
   behaviour on each form screen.

Do not deliver: new illustrations or a new logo, a new colour palette, a
marketing site, merchant console screens, or any flow where email is a way in.

---

## 8. Today versus target (for your change list)

| Today                                                                                   | Target                                                            |
| --------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| "Email confirmed / Continue with your email" choice screen with three competing actions | Removed. Email code success goes straight to join or stamp        |
| Welcome tells email joiners to wait 30 seconds on the code screen                       | Removed. Email only appears on the code screen when needed        |
| "Yes to all" combines terms and marketing                                               | Separate required terms and optional marketing                    |
| "In 20 seconds", "One tick", "One message", "No spam, ever"                             | Removed                                                           |
| Stamp success followed by contact prompts                                               | Stamp success stands alone; one quiet optional suggestion on home |
| Up to two stacked prompts on home, non-dismissible                                      | At most one, dismissible, prioritised                             |
| Setup-blocked reward shown as "Ready for scan" on home                                  | "Reward unlocked. Finish setting up to collect."                  |
| "Next venue trading day", "daily reset"                                                 | Concrete next date/time, or "on your next visit"                  |
| Wallet-link rules inside contact forms                                                  | Separate "Find my previous stamps" task                           |
| "Verified and locked for account security"                                              | "Confirmed"                                                       |
| Collection steps "Step 1 of 3" then "Step 1 of 1"                                       | Accurate count from the start, phone included                     |
| Expired code + resend says "Enter a valid phone number"                                 | Back to the number screen, number kept, "Your code expired"       |
| "Customer scanner", "ready for merchant scan", "Card unavailable" for rewards           | Guest words                                                       |
| "Email sign-in is paused" warning in profile                                            | Removed                                                           |

---

## 9. Reference screens in the running app

Local dev previews (no database needed; run `pnpm dev`):

- `/dev/welcome-offer`: all join steps (welcome, phone, code, email, email
  code, email choice, terms).
- `/dev/customer-login`: returning sign-in.
- `/dev/home-harness/home`, `/stamp`, `/rewards`, `/profile`,
  `/referral-bank`: signed-in guest states.
- `/dev/reward-collection`: reward setup and collection states.
- `/dev/design-system`: Wet Ink components, forms and feedback.

Source files by area (for exact current behaviour):

- Join: `components/customer/join-wizard.tsx`, `join-welcome-step.tsx`,
  `join-forms.tsx`, `join-otp-form.tsx`, `join-email-forms.tsx`,
  `join-email-otp-form.tsx`, `join-action-bar.tsx`, `legal-sheet.tsx`.
- Sign-in: `customer-login-form.tsx`, `customer-login-phone-step.tsx`,
  `customer-login-email-step.tsx`, `customer-login-scan-step.tsx`.
- Stamp and card: `customer-card-experience.tsx`, `stamp-collector.tsx`,
  `stamp-press-button.tsx`, `verify-visit-controls.tsx`,
  `join-first-stamp-recovery-panel.tsx`, `location-permission-help.tsx`,
  `venue-code-form.tsx`.
- Home: `app/home/(authed)/page.tsx`, `home-*.tsx`,
  `referral-share-panel.tsx`.
- Rewards: `reward-panels.tsx`, `reward-list-cards.tsx`,
  `reward-collection-qr.tsx`, `profile-gate-forms.tsx`.
- Profile and linking: `profile-*.tsx`, `wallet-link-next-step.tsx`.
- All current copy: `lib/customer/experience/copy.ts`,
  `lib/customer/experience/stamp-choreography.ts`,
  `lib/customer/experience/block-reasons.ts`, `lib/copy/product-copy.ts`.
