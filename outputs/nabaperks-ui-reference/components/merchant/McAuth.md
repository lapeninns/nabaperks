# McAuth

- **Surface:** merchant (stage view — the `auth` stage of `MerchantSurface`)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 133–202)
- **Export:** none (rendered by `MerchantSurface`; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (no real email/OTP send; mocked autofill code; inline styles)

## Visual purpose

The merchant entry screen: a passwordless email + six-digit-code sign-in/sign-up. Two phases on one component — an email-capture card, then an OTP-entry view. A mode toggle switches between "Create account" (start a 30-day pilot) and "Sign in" (returning merchant). Centred ≤460px column with the `w-rise` entrance.

## Props / state

| Prop     | Type                                   | Default | Notes                                                                                           |
| -------- | -------------------------------------- | ------- | ----------------------------------------------------------------------------------------------- |
| `t`      | `object` (tweaks)                      | —       | Reads `t.mo` (motion multiplier) for animation duration.                                        |
| `onDone` | `(mode: "create" \| "signin") => void` | —       | Fired when the OTP step is confirmed; the surface routes `create → onboarding`, `signin → app`. |

**State (all `useState`):**
| Hook | Initial | Notes |
| --- | --- | --- |
| `mode` | `"create"` | `"create" \| "signin"` — sign-up vs sign-in. |
| `phase` | `"email"` | `"email" \| "code"` — which sub-view shows. |
| `email` | `""` | Controlled email value. |
| `code` | `""` | Controlled OTP value (driven by `OtpBoxes`). |

Derived: `emailOk = /\S+@\S+\.\S+/.test(email)`; `create = mode === "create"`; `label` (the `data-screen-label`).

## UX behaviour

- **Email phase:** `McField` for the email; "Email me a code" `InkButton` is `disabled` until `emailOk`, and only flips `phase` to `"code"` (no network). A `DemoTag` autofills `hello@oldcrown.pub`. A `GhostLink` toggles `mode` (and clears `code`).
- **Code phase:** `OtpBoxes` collects six digits; the confirm `InkButton` is `disabled` until `code.length === 6`, then calls `onDone(mode)`. A `DemoTag` autofills the code `482915`. A `GhostLink` ("Use a different email") resets to the email phase and clears `code`.
- **Prototype-isms:** no email is ever sent; the "code" is the hardcoded literal `482915`; the displayed expiry copy ("expires in 10 min", "Sent to …") is static text, not a timer.

## Dependencies

- **Shared primitives:** `MonoTag`, `MonoLine`, `ReceiptCard`, `InkButton`, `GhostLink`, `DemoTag`, `OtpBoxes`.
- **Module-local:** `McField`.
- **CSS variables:** `--w-ink-soft`, plus those consumed by the primitives.
- **Keyframes:** `w-rise` (entrance, `380 * mo` ms).
- **localStorage:** none directly (the surface persists stage/tab after `onDone`).
- **Globals / window:** reads shared primitives from `window`; receives `t` and the `onDone` callback from `MerchantSurface`. Not itself exported.

## Reuse notes

Prototype-only: the passwordless flow is mocked end-to-end (no Twilio/email send, hardcoded `482915` code, no real expiry). The screen layout, copy, and the email→OTP→done shape are a faithful reference for the production merchant auth (which is Supabase Auth, not first-party OTP — so the real flow differs). For production: wire `onDone` to a real verification call, drive expiry from a server timestamp, remove the `DemoTag` autofills, and lift inline styles to the token layer. Note the `data-screen-label` attribute is a prototype harness hook for the screenshot tooling.

## Source snippet

```jsx
function McAuth({ t, onDone }) {
  const mo = t.mo
  const [mode, setMode] = useStateMc("create") // create | signin
  const [phase, setPhase] = useStateMc("email") // email | code
  const [email, setEmail] = useStateMc("")
  const [code, setCode] = useStateMc("")
  const emailOk = /\S+@\S+\.\S+/.test(email)
  const create = mode === "create"

  const label =
    phase === "code"
      ? "Merchant · Check your email"
      : create
        ? "Merchant · Create account"
        : "Merchant · Sign in"

  return (
    <div
      data-screen-label={label}
      style={{
        maxWidth: 460,
        margin: "0 auto",
        animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`,
      }}
    >
      {phase === "email" ? (
        <div>
          <div style={{ textAlign: "center", margin: "26px 0 24px" }}>
            <MonoTag tone={create ? "accent" : "plain"}>
              {create ? "Start your 30-day pilot" : "Merchant access"}
            </MonoTag>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 800,
                lineHeight: 1.06,
                margin: "16px 0 10px",
              }}
            >
              {create
                ? "Set up your loyalty counter."
                : "Welcome back to the counter."}
            </h1>
            <p
              style={{
                fontSize: 15,
                lineHeight: "22px",
                color: "var(--w-ink-soft)",
                margin: "0 auto",
                maxWidth: "32ch",
              }}
            >
              {create
                ? "No password, no card details. We email a six-digit code and the whole setup takes about five minutes."
                : "No password here — we email a six-digit code to sign you in."}
            </p>
          </div>
          <ReceiptCard mo={mo}>
            <McField
              label="Venue email"
              value={email}
              onChange={setEmail}
              placeholder="hello@oldcrown.pub"
            />
            <div style={{ marginTop: 14 }}>
              <InkButton
                full
                disabled={!emailOk}
                onClick={() => setPhase("code")}
              >
                Email me a code
              </InkButton>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <DemoTag onClick={() => setEmail("hello@oldcrown.pub")}>
                Autofill hello@oldcrown.pub
              </DemoTag>
            </div>
          </ReceiptCard>
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <GhostLink
              onClick={() => {
                setMode(create ? "signin" : "create")
                setCode("")
              }}
            >
              {create
                ? "Already set up? Sign in"
                : "New here? Create your account"}
            </GhostLink>
            <MonoLine style={{ fontSize: 10, marginTop: 10 }}>
              30 days free · £29/month after · one price, one venue
            </MonoLine>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: "center", margin: "26px 0 24px" }}>
            <MonoTag tone="ink">Code sent</MonoTag>
            <h1
              style={{
                fontSize: 30,
                fontWeight: 800,
                lineHeight: 1.06,
                margin: "16px 0 10px",
              }}
            >
              Check your inbox.
            </h1>
            <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
              Sent to {email || "hello@oldcrown.pub"} · expires in 10 min
            </p>
          </div>
          <OtpBoxes value={code} onChange={setCode} />
          <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
            <InkButton
              full
              disabled={code.length !== 6}
              onClick={() => onDone(mode)}
            >
              {create ? "Create my account" : "Sign me in"}
            </InkButton>
            <div style={{ textAlign: "center" }}>
              <DemoTag onClick={() => setCode("482915")}>Autofill code</DemoTag>
            </div>
            <div style={{ textAlign: "center" }}>
              <GhostLink
                onClick={() => {
                  setPhase("email")
                  setCode("")
                }}
              >
                Use a different email
              </GhostLink>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```
