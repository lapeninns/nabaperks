// Nabaperks v2 "Wet Ink" — 60-journey.jsx
// JourneyMap: the full-flow storyboard and front door. Stateless (no Entry).
const { useState: useStateJy } = React;

/* ---------- tiny screen glyphs (inline SVG, 20×16 viewBox) ---------- */

const JY_GLYPHS = {
  form: <path d="M3 3.5h14M3 8h10M3 12.5h7" />,
  steps: <path d="M2 13.5h4.5v-4H11v-4h4.5V2.5" />,
  qr: (
    <g fill="var(--w-ink)" stroke="none">
      <rect x="3" y="2" width="5" height="5" rx="1" />
      <rect x="12" y="2" width="5" height="5" rx="1" />
      <rect x="3" y="9" width="5" height="5" rx="1" />
      <rect x="12" y="9" width="2.2" height="2.2" />
      <rect x="14.8" y="11.8" width="2.2" height="2.2" />
    </g>
  ),
  dash: <path d="M4 13V8M8 13V4M12 13V6.5M16 13V9.5" />,
  feed: (
    <g>
      <circle cx="4" cy="4" r="1.3" fill="var(--w-ink)" stroke="none" />
      <circle cx="4" cy="8" r="1.3" fill="var(--w-ink)" stroke="none" />
      <circle cx="4" cy="12" r="1.3" fill="var(--w-ink)" stroke="none" />
      <path d="M7.5 4H17M7.5 8H14M7.5 12H16" />
    </g>
  ),
  people: (
    <g>
      <circle cx="7" cy="5" r="2.5" />
      <path d="M2.5 14c0-3 2-4.5 4.5-4.5s4.5 1.5 4.5 4.5" />
      <circle cx="14.5" cy="6" r="2" />
      <path d="M13 9.8c2.8 0 4.3 1.5 4.5 4.2" />
    </g>
  ),
  key: (
    <g>
      <circle cx="6" cy="8" r="3" />
      <path d="M9 8h8M14 8v3M17 8v2.5" />
    </g>
  ),
  pound: <text x="10" y="12.5" textAnchor="middle" fontSize="13" fontWeight="700" fontFamily="var(--w-mono)" fill="var(--w-ink)" stroke="none">£</text>,
  till: (
    <g>
      <rect x="5" y="2" width="10" height="6" rx="1" />
      <path d="M3 14h14M8 8v6M12 8v6" />
    </g>
  ),
  phone: (
    <g>
      <rect x="6.5" y="1.5" width="7" height="13" rx="1.8" />
      <path d="M9 12.5h2" />
    </g>
  ),
  spark: <path d="M10 2.5v11M5.4 5.2l9.2 5.6M14.6 5.2L5.4 10.8" />,
  stamp: (
    <g>
      <circle cx="10" cy="8" r="5.8" />
      <path d="M10 4.8v6.4M7.2 6.4l5.6 3.2M12.8 6.4L7.2 9.6" />
    </g>
  ),
  save: <path d="M6 2.5h8V14l-4-3.2L6 14z" />,
  card: (
    <g>
      <path d="M4 11V2.5h12V11M6.5 6h7" />
      <path d="M4 11l1.5 2 1.5-2 1.5 2 1.5-2 1.5 2 1.5-2 1.5 2 1.5-2" />
    </g>
  ),
  seal: (
    <g>
      <circle cx="10" cy="8" r="5.8" />
      <text x="10" y="11" textAnchor="middle" fontSize="8.5" fontWeight="800" fontFamily="var(--w-display)" fill="var(--w-ink)" stroke="none">?</text>
    </g>
  ),
  gift: (
    <g>
      <rect x="4" y="6" width="12" height="8" rx="1" />
      <path d="M10 6v8M4 9.5h12M10 6C8 6 6 5 7 3.2 8 1.8 10 3.5 10 6c0-2.5 2-4.2 3-2.8 1 1.8-1 2.8-3 2.8" />
    </g>
  ),
  clock: (
    <g>
      <circle cx="10" cy="8" r="5.8" />
      <path d="M10 4.8V8l2.4 1.8" />
    </g>
  ),
  check: <path d="M4.5 8.5l3.5 4 7.5-9" />,
  calendar: (
    <g>
      <rect x="3.5" y="3" width="13" height="11" rx="1.2" />
      <path d="M3.5 6.8h13M7 1.8v2.4M13 1.8v2.4" />
      <rect x="6" y="9" width="2.4" height="2.4" fill="var(--w-ink)" stroke="none" />
    </g>
  ),
  tab: (
    <g>
      <rect x="2.5" y="2.5" width="15" height="11.5" rx="1.4" />
      <path d="M2.5 6.5h15M4.5 4.5h4" />
    </g>
  ),
  hand: (
    <g>
      <rect x="4" y="3" width="6.5" height="11" rx="1.5" transform="rotate(-12 7 8.5)" />
      <path d="M13 8h4.5M15.7 6l1.8 2-1.8 2" />
    </g>
  ),
  lock: (
    <g>
      <rect x="5" y="7" width="10" height="7.5" rx="1.4" />
      <path d="M7 7V5a3 3 0 0 1 6 0v2" />
    </g>
  ),
  shield: <path d="M10 1.8l5.8 2v5c0 3.6-2.9 5.6-5.8 6.6-2.9-1-5.8-3-5.8-6.6v-5z" />,
  pulse: <path d="M2 9h3.6L7.5 4l3.3 8.6L12.8 8H18" />,
  rows: (
    <g>
      <rect x="3" y="2.5" width="14" height="3.4" rx="0.8" />
      <rect x="3" y="7" width="14" height="3.4" rx="0.8" />
      <rect x="3" y="11.5" width="14" height="3.4" rx="0.8" />
    </g>
  ),
  sync: (
    <g>
      <path d="M5.2 6.2a5.4 5.4 0 0 1 9.3-1.5M14.8 9.8a5.4 5.4 0 0 1-9.3 1.5" />
      <path d="M14.8 1.8v3h-3M5.2 14.2v-3h3" />
    </g>
  ),
  scroll: <path d="M3.5 3l1 1.2L6.5 2M9 3.5h8M3.5 8l1 1.2L6.5 7M9 8.5h8M3.5 13l1 1.2L6.5 12M9 13.5h6" />,
  flag: <path d="M5 1.8v12.7M5 2.8h9.5l-2.2 3 2.2 3H5" />,
  home: <path d="M3 8l7-6 7 6M5.5 6.8V14h9V6.8" />,
  tag: (
    <g>
      <path d="M3 3h5.5L16 10.5 11.5 15 4 7.5z" />
      <circle cx="6" cy="6" r="1.1" fill="var(--w-ink)" stroke="none" />
    </g>
  ),
  scale: (
    <g>
      <path d="M10 2.5v10M5 4.5h10M6.5 14h7" />
      <path d="M5 4.5L3 9a2.4 2.4 0 0 0 4 0zM15 4.5L13 9a2.4 2.4 0 0 0 4 0z" />
    </g>
  ),
};

function JyGlyph({ kind }) {
  return (
    <span style={{
      width: 34, height: 27, flexShrink: 0, border: "1.5px solid var(--w-ink)",
      borderRadius: 4, background: "var(--w-paper)", display: "inline-grid", placeItems: "center",
    }}>
      <svg width="20" height="16" viewBox="0 0 20 16" style={{ display: "block" }}
        fill="none" stroke="var(--w-ink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {JY_GLYPHS[kind] || JY_GLYPHS.form}
      </svg>
    </span>
  );
}

/* ---------- the storyboard data ---------- */

const JY_LANES = [
  {
    label: "Merchant", who: "hello@oldcrown.pub", surface: "Merchant",
    steps: [
      { n: "01", preset: "signup", title: "Sign up", desc: "Email, six-digit code, kettle on. The pilot starts free.", glyph: "form" },
      { n: "02", preset: "onboarding", title: "Three-step setup", desc: "Venue, card, reward pool — under five minutes.", glyph: "steps" },
      { n: "03", preset: "qr", title: "Print the QR", desc: "Poster, till card, sticker. PNG and print-ready PDF.", glyph: "qr" },
      { n: "04", preset: "today", title: "Today at the counter", desc: "Members, stamps and redeems, live this morning.", glyph: "dash" },
      { n: "05", preset: "activity", title: "Read the room", desc: "Every scan, join and stamp on one feed.", glyph: "feed" },
      { n: "06", preset: "customers", title: "Know your regulars", desc: "Asha, Tom, Priya, Dan — visits at a glance.", glyph: "people" },
      { n: "07", preset: "settings", title: "Keys & PIN", desc: "Today's staff PIN, fresh every night at 04:00.", glyph: "key" },
      { n: "08", preset: "billing", title: "£29, settled", desc: "One price, one venue. Stripe keeps the score.", glyph: "pound", tie: "Stripe webhooks" },
      { n: "09", preset: "counter", title: "Counter mode", desc: "A big, calm screen for busy hands at the till.", glyph: "till" },
    ],
  },
  {
    label: "Customer", who: "Asha K. · first visit", surface: "Customer",
    steps: [
      { n: "01", preset: "scan", title: "Scan the till card", desc: "Camera up at the counter. No app store detour.", glyph: "phone" },
      { n: "02", preset: "landing", title: "First stamp waiting", desc: "The card shows its value before asking anything.", glyph: "spark" },
      { n: "03", preset: "firstStamp", title: "That's one", desc: "Staff tap in the PIN. The stamp slams down.", glyph: "stamp", tie: "Counter moment" },
      { n: "04", preset: "save", title: "Keep the card", desc: "One text, no password. Survives a closed tab.", glyph: "save" },
      { n: "05", preset: "card", title: "The card", desc: "Progress, dates, and a mystery sealed in wax.", glyph: "card" },
      { n: "06", preset: "sealed", title: "Seal at three", desc: "Something's under there. Three visits earn the break.", glyph: "seal" },
      { n: "07", preset: "revealed", title: "Break it open", desc: "Hold the wax, crack it — free flat white.", glyph: "gift" },
      { n: "08", preset: "ready", title: "Ready next day", desc: "Give it a day to breathe. Redeemable tomorrow.", glyph: "clock" },
      { n: "09", preset: "redeemed", title: "Enjoy", desc: "Staff redeem it once. The card starts again.", glyph: "check" },
      { n: "··", preset: "alreadyStamped", title: "One a day", desc: "Second stamp today? The card politely says tomorrow.", glyph: "calendar", spur: true },
    ],
  },
  {
    label: "Staff", who: "Maya & Jordan · behind the bar", surface: "Staff",
    steps: [
      { n: "01", preset: "idle", title: "Pin this tab", desc: "The stamp screen lives open beside the till.", glyph: "tab" },
      { n: "02", preset: "pin", title: "Phone handed over", desc: "Asha's phone crosses the counter. Four digits in.", glyph: "hand", tie: "Counter moment" },
      { n: "03", preset: "success", title: "Stamped, hand it back", desc: "Slammed and done before the milk steams.", glyph: "check" },
      { n: "··", preset: "locked", title: "Locked out", desc: "Three wrong tries buys ten minutes on the bench.", glyph: "lock", spur: true },
    ],
  },
  {
    label: "Admin", who: "internal support", surface: "Admin",
    steps: [
      { n: "01", preset: "gate", title: "MFA gate", desc: "Six digits before any support tooling opens.", glyph: "shield" },
      { n: "02", preset: "overview", title: "Platform pulse", desc: "Merchants, members and stamps across the estate.", glyph: "pulse" },
      { n: "03", preset: "merchants", title: "Merchants", desc: "Every venue, plan and status in one table.", glyph: "rows" },
      { n: "04", preset: "billing", title: "Billing sync", desc: "Stripe webhooks reconciled; drift gets flagged.", glyph: "sync", tie: "Stripe webhooks" },
      { n: "05", preset: "audit", title: "Audit trail", desc: "Every manual action, signed, dated, kept.", glyph: "scroll" },
      { n: "06", preset: "fraud", title: "Fraud flags", desc: "high_stamp_velocity and friends, queued for review.", glyph: "flag" },
    ],
  },
  {
    label: "Marketing", who: "the shop window", surface: "Marketing", slim: true,
    steps: [
      { n: "01", preset: "home", title: "Home", desc: "Loyalty, stamped before the coffee cools.", glyph: "home" },
      { n: "02", preset: "pricing", title: "Pricing", desc: "£29 a month, 30 days free. That's the table.", glyph: "tag" },
      { n: "03", preset: "legal", title: "Plain-English legal", desc: "Terms a landlord can actually read.", glyph: "scale" },
    ],
  },
];

/* ---------- pieces ---------- */

function JyArrowLink({ spur }) {
  const ink = spur ? "var(--w-accent)" : "var(--w-ink-soft)";
  return (
    <div style={{ alignSelf: "center", flexShrink: 0, display: "flex", alignItems: "center", padding: "0 3px" }}>
      <div style={{ width: 16, borderTop: `2px dashed ${ink}` }}></div>
      <svg width="7" height="10" viewBox="0 0 7 10" style={{ display: "block" }}>
        <path d="M0 0L7 5 0 10z" fill={ink} />
      </svg>
    </div>
  );
}

function JyStepCard({ step, slim, mo, onClick }) {
  const [hov, setHov] = useStateJy(false);
  const [down, setDown] = useStateJy(false);
  const lift = down ? "translate(2px,2px)" : hov ? "translate(-2px,-2px)" : "none";
  const shadow = down ? "drop-shadow(1px 1px 0 var(--w-ink))"
    : hov ? "drop-shadow(5px 5px 0 var(--w-ink))" : "drop-shadow(3px 3px 0 var(--w-ink))";
  const border = step.spur ? "2px dashed var(--w-ink)" : "2px solid var(--w-ink)";
  return (
    <div role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => { setHov(false); setDown(false); }}
      onPointerDown={() => setDown(true)} onPointerUp={() => setDown(false)}
      style={{
        width: slim ? 168 : 180, flexShrink: 0, cursor: "pointer", outline: "none",
        filter: shadow, transform: lift,
        transition: `transform ${90 * mo}ms, filter ${90 * mo}ms`,
      }}>
      <div style={{
        background: "var(--w-card)", border, borderBottom: step.spur ? border : "none",
        borderRadius: step.spur ? "var(--w-r)" : "var(--w-r) var(--w-r) 0 0",
        padding: "12px 13px 9px", minHeight: slim ? 88 : 122,
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <span style={{
            fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700,
            letterSpacing: "0.08em", color: "var(--w-accent)", paddingTop: 5,
          }}>{step.spur ? "SPUR" : "Nº " + step.n}</span>
          <JyGlyph kind={step.glyph} />
        </div>
        <div style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: 14.5, lineHeight: 1.15, marginTop: 7 }}>
          {step.title}
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.45, color: "var(--w-ink-soft)", marginTop: 5 }}>
          {step.desc}
        </div>
        {step.tie && (
          <div style={{ marginTop: "auto", paddingTop: 8 }}>
            <MonoTag tone="accent" style={{ fontSize: 8.5, padding: "2px 8px" }}>{step.tie}</MonoTag>
          </div>
        )}
      </div>
      {!step.spur && (
        <div style={{
          height: 8, marginTop: -1,
          background:
            "linear-gradient(-45deg, transparent 5px, var(--w-ink) 5px, var(--w-ink) 7px, var(--w-card) 7px) 0 0 / 10px 100%, " +
            "linear-gradient(45deg, transparent 5px, var(--w-ink) 5px, var(--w-ink) 7px, var(--w-card) 7px) 0 0 / 10px 100%",
        }}></div>
      )}
    </div>
  );
}

function JyLane({ lane, go, mo, delay }) {
  return (
    <section style={{ animation: `w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <MonoTag tone="ink">{lane.label}</MonoTag>
        <MonoLine style={{ fontSize: 10 }}>{lane.who}</MonoLine>
        <div style={{ flex: 1, minWidth: 40, borderTop: "2px dashed var(--w-line)" }}></div>
        <MonoLine style={{ fontSize: 10 }}>{lane.steps.length} screens</MonoLine>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", overflowX: "auto", padding: "10px 6px 14px" }}>
        {lane.steps.map((step, i) => (
          <React.Fragment key={step.preset}>
            {i > 0 && <JyArrowLink spur={step.spur} />}
            <JyStepCard step={step} slim={lane.slim} mo={mo} onClick={() => go(lane.surface, step.preset)} />
          </React.Fragment>
        ))}
      </div>
    </section>
  );
}

function JyTieStrip({ label, note, mo, delay }) {
  return (
    <div style={{
      display: "grid", justifyItems: "center", gap: 3, margin: "-4px 0 2px",
      animation: `w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both`,
    }}>
      <div style={{ height: 14, borderLeft: "2px dashed var(--w-accent)" }}></div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
        <MonoTag tone="accent">✱ {label}</MonoTag>
        <MonoLine style={{ fontSize: 10 }}>{note}</MonoLine>
      </div>
      <div style={{ height: 14, borderLeft: "2px dashed var(--w-accent)" }}></div>
    </div>
  );
}

/* ---------- the map ---------- */

function JourneyMap({ t, go }) {
  const mo = t.mo;
  const [wiped, setWiped] = useStateJy(false);
  const jyResetAll = () => {
    ["v3_customer", "v3_merchant", "v3_staff", "v3_admin", "v3_marketing"].forEach((k) => localStorage.removeItem(k));
    setWiped(true);
    setTimeout(() => setWiped(false), 1600 * mo);
  };

  return (
    <div data-screen-label="Journey map" style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 24px 130px", minHeight: "100vh" }}>
      {/* brand row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>nabaperks</span>
          <MonoTag style={{ marginLeft: 6 }}>Full flow · v2</MonoTag>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <MonoLine style={{ fontSize: 10 }}>Thu 12 Jun 2026 · Bristol</MonoLine>
          <DemoTag onClick={jyResetAll}>{wiped ? "All flows reset ✓" : "Reset every flow"}</DemoTag>
        </div>
      </div>

      {/* header */}
      <header style={{ margin: "30px 0 8px", animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
        <h1 style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.05, margin: "0 0 12px", maxWidth: "22ch" }}>
          The whole loop, on one table.
        </h1>
        <p style={{ fontSize: 16, lineHeight: "24px", color: "var(--w-ink-soft)", margin: "0 0 16px", maxWidth: "62ch" }}>
          Every surface of Nabaperks v2 — merchant, customer, staff, admin and the shop window —
          dealt out as one storyboard. Tap any card to jump into that exact screen, live.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <MonoTag>6 surfaces</MonoTag>
          <MonoTag>30+ screens</MonoTag>
          <MonoTag tone="accent">One counter</MonoTag>
        </div>
      </header>

      {/* swimlanes */}
      <div style={{ display: "grid", gap: 14, marginTop: 22 }}>
        <JyLane lane={JY_LANES[0]} go={go} mo={mo} delay={60} />
        <JyLane lane={JY_LANES[1]} go={go} mo={mo} delay={120} />
        <JyTieStrip mo={mo} delay={150} label="The counter moment"
          note="Customer 03 · Staff 02 — one phone, one PIN, one slam" />
        <JyLane lane={JY_LANES[2]} go={go} mo={mo} delay={180} />
        <JyTieStrip mo={mo} delay={210} label="Stripe webhooks"
          note="Merchant 08 · Admin 04 — billing truth flows both ways" />
        <JyLane lane={JY_LANES[3]} go={go} mo={mo} delay={240} />
        <JyLane lane={JY_LANES[4]} go={go} mo={mo} delay={300} />
      </div>

      {/* footer strip */}
      <div style={{ marginTop: 30, animation: `w-rise ${380 * mo}ms ${340 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
        <ReceiptCard mo={mo}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <VenueMark size={58} />
              <div>
                <MonoLine style={{ fontSize: 10 }}>The cast · The Old Crown, Bristol</MonoLine>
                <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 4 }}>
                  Asha K. · Tom R. · Priya S. · Dan W. — regulars&nbsp;&nbsp;·&nbsp;&nbsp;Maya (manager) · Jordan — crew
                </div>
              </div>
            </div>
            <MonoLine style={{ fontSize: 10 }}>Card Nº OC-0248 · Reward Nº RW-8821</MonoLine>
          </div>
          <ReceiptRule />
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "space-between" }}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <MonoTag>One stamp a day</MonoTag>
              <MonoTag>Seal at three</MonoTag>
              <MonoTag>Next-day redeem</MonoTag>
              <MonoTag tone="ink">£29 a month</MonoTag>
            </div>
            <MonoLine style={{ fontSize: 10 }}>Tweak the ink, motion & counter check from the Tweaks panel</MonoLine>
          </div>
        </ReceiptCard>
      </div>
    </div>
  );
}

/* ---------- exports ---------- */
Object.assign(window, { JourneyMap });
