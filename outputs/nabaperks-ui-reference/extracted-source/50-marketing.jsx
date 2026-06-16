// Nabaperks v3 "Wet Ink" — Marketing site: a riso poster with three rooms.
// Views: home | pricing | legal. State in localStorage v3_marketing.
const { useState: useStateMk, useEffect: useEffectMk, useRef: useRefMk } = React;

const MK_LS = "v3_marketing";

function mkLoadState() {
  try { return JSON.parse(localStorage.getItem(MK_LS)) || null; } catch (e) { return null; }
}

/* ---------- content ---------- */

const MK_BEATS = [
  { n: "01", t: "Scan", c: "Camera up at the till card. The stamp card opens in the browser — two seconds, no app store detour." },
  { n: "02", t: "Hand over", c: "The phone crosses the counter, screen first. Same ritual as a paper card, minus the soggy cardboard." },
  { n: "03", t: "PIN", c: "Staff tap today's 4-digit PIN. It rotates itself nightly at 04:00, so there's nothing to remember on a Friday." },
  { n: "04", t: "Slam", c: "The stamp slams, the receipt shakes. On visit three a wax seal breaks over a mystery reward." },
];

const MK_QUOTES = [
  { q: "Regulars hand their phone over before they've even ordered. It's the bit of theatre our counter was missing.", who: "Maya · Manager", venue: "The Old Crown, Bristol", initials: "OC", angle: -2 },
  { q: "Set up between the lunch rush and the school run. Nobody has once asked where the app is.", who: "Fern · Owner", venue: "Fern & Loaf, Bath", initials: "FL", angle: 1.6 },
  { q: "The seal is silly and brilliant. People book a third cut just to break the thing open.", who: "Marlowe · Barber", venue: "Marlowe's, Leeds", initials: "ML", angle: -1 },
];

const MK_PLAN_BULLETS = [
  "Unlimited stamps & members",
  "Mystery reward pool — you pick the prizes",
  "Printed QR kit: A4 poster, till card, sticker",
  "Staff PIN that rotates itself nightly at 04:00",
  "Weekly digest of visits, regulars & redemptions",
];

const MK_FAQS = [
  { q: "Is there a contract?", a: "No. It's month to month after the pilot — £29, one venue, one month's notice to leave. The pilot itself needs no card at all." },
  { q: "Do I need any hardware?", a: "None. Customers use their own phones, and staff approve stamps by typing a 4-digit PIN on the customer's screen. The only kit is printed paper — we send print-ready files." },
  { q: "Who owns the customer data?", a: "You do, scoped to your venue. Phone numbers are stored hashed and shown masked, nothing is sold, and marketing texts only ever go to customers who tick the separate opt-in. UK GDPR throughout." },
  { q: "What counts as a visit?", a: "One stamp per customer per UK business day, approved by staff PIN at the counter. No drive-by stamping from the bus stop." },
  { q: "What if I want to cancel?", a: "One month's notice from your billing page, any time. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal." },
];

const MK_TERMS = {
  title: "Terms, condensed", no: "Nº T-2026", rows: [
    ["Participation", "The card lives in your browser. No app, no plastic, nothing to install — if the QR scans, you're in."],
    ["Merchant-controlled reward terms", "Each venue sets its own offer, visit target and exclusions. We do the stamping; they do the generosity."],
    ["Abuse & fraud prevention", "One stamp per UK business day, approved at the counter. Odd patterns get flagged for a human, never silently punished."],
    ["Availability restrictions", "If billing lapses, new joins and stamps pause but earned rewards stand. Merchants leave with one month's notice."],
  ],
};

const MK_PRIVACY = {
  title: "Privacy, condensed", no: "Nº P-2026", rows: [
    ["Data collected", "Visits, stamps, rewards — and a phone number only if you save your card, stored hashed and shown masked."],
    ["Purposes", "Used to run the card: show progress, unseal rewards, spot misuse. Never sold, never swapped."],
    ["Marketing consent separation", "Marketing is a separate, optional tick. No consent, no texts — your stamps work either way."],
    ["Data requests", "Ask and we'll show, export or delete what we hold on you. UK GDPR, minus the runaround."],
  ],
};

/* ---------- chrome ---------- */

function MkNav({ go, view, setView }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
      <button onClick={() => view === "home" ? window.scrollTo({ top: 0, behavior: "smooth" }) : setView("home")}
        style={{ display: "flex", alignItems: "center", gap: 10, background: "none", border: "none", cursor: "pointer", padding: 0, color: "var(--w-ink)" }}>
        <span style={{
          width: 30, height: 30, borderRadius: "50%", background: "var(--w-accent)",
          border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
          color: "#fff", fontWeight: 800, fontSize: 15, transform: "rotate(-6deg)",
        }}>✱</span>
        <span style={{ fontWeight: 800, fontSize: 19, fontFamily: "var(--w-display)" }}>nabaperks</span>
      </button>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {view !== "home" && <GhostLink style={{ fontSize: 14 }} onClick={() => setView("home")}>← Home</GhostLink>}
        {view !== "pricing" && <GhostLink style={{ fontSize: 14 }} onClick={() => setView("pricing")}>Pricing</GhostLink>}
        <InkButton size="sm" variant="outline" onClick={() => go("Merchant", "signup")}>Merchant login</InkButton>
        <InkButton size="sm" onClick={() => go("Merchant", "signup")}>Start free</InkButton>
      </div>
    </div>
  );
}

function MkQuoteCard({ q, who, venue, initials, angle, mo }) {
  return (
    <div style={{ transform: `rotate(${angle}deg)` }}>
      <ReceiptCard mo={mo}>
        <div style={{ fontSize: 16.5, fontWeight: 700, lineHeight: 1.4, fontFamily: "var(--w-display)" }}>
          "{q}"
        </div>
        <ReceiptRule />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <div>
            <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>{who}</MonoLine>
            <MonoLine style={{ fontSize: 10, marginTop: 3 }}>{venue}</MonoLine>
          </div>
          <VenueMark size={46} initials={initials} angle={-7} />
        </div>
      </ReceiptCard>
    </div>
  );
}

function MkFaqItem({ q, a, open, onToggle, mo }) {
  return (
    <div style={{ borderTop: "2px dashed var(--w-line)" }}>
      <button onClick={onToggle} style={{
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14,
        background: "none", border: "none", cursor: "pointer", padding: "16px 2px", textAlign: "left",
      }}>
        <span style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: 17.5, color: "var(--w-ink)" }}>{q}</span>
        <span style={{
          fontFamily: "var(--w-mono)", fontSize: 17, fontWeight: 700, color: open ? "#fff" : "var(--w-ink)",
          width: 30, height: 30, borderRadius: "50%", border: "2px solid var(--w-ink)", flexShrink: 0,
          display: "grid", placeItems: "center", background: open ? "var(--w-accent)" : "var(--w-card)",
          transform: open ? "rotate(-6deg)" : "none", transition: `transform ${160 * mo}ms`,
        }}>{open ? "–" : "+"}</span>
      </button>
      {open && (
        <p style={{
          margin: "0 0 18px", maxWidth: "62ch", fontSize: 15, lineHeight: "23px",
          color: "var(--w-ink-soft)", animation: `w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        }}>{a}</p>
      )}
    </div>
  );
}

function MkLegalColumn({ data, mo, angle }) {
  return (
    <div style={{ transform: `rotate(${angle}deg)` }}>
      <ReceiptCard mo={mo}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <div style={{ fontWeight: 800, fontSize: 22, fontFamily: "var(--w-display)" }}>{data.title}</div>
          <MonoLine style={{ fontSize: 10 }}>{data.no}</MonoLine>
        </div>
        {data.rows.map(([h, body], i) => (
          <div key={h}>
            <ReceiptRule style={{ margin: "13px 0" }} />
            <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700, marginBottom: 5 }}>{h}</MonoLine>
            <p style={{ margin: 0, fontSize: 14, lineHeight: "21px", color: "var(--w-ink-soft)" }}>{body}</p>
          </div>
        ))}
        <ReceiptRule style={{ margin: "14px 0 10px" }} />
        <MonoLine style={{ fontSize: 9.5 }}>Full text travels with your merchant agreement</MonoLine>
      </ReceiptCard>
    </div>
  );
}

function MkFooter({ setView, onReset }) {
  return (
    <div style={{ borderTop: "2px dashed var(--w-line)", marginTop: 60 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "26px 28px 8px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 16.5 }}>nabaperks</span>
          <MonoLine style={{ marginLeft: 10 }}>For UK counters</MonoLine>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <GhostLink style={{ fontSize: 13.5 }} onClick={() => setView("legal")}>Terms</GhostLink>
          <GhostLink style={{ fontSize: 13.5 }} onClick={() => setView("legal")}>Privacy</GhostLink>
          <DemoTag onClick={onReset}>Restart flow</DemoTag>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
        <MonoLine style={{ fontSize: 9.5 }}>© 2026 Nabaperks · Bristol · Stamped, not tracked</MonoLine>
      </div>
    </div>
  );
}

/* ---------- home ---------- */

function MkHome({ t, go, setView }) {
  const mo = t.mo;
  const counterRef = useRefMk(null);
  const [slamKey, setSlamKey] = useStateMk(0);

  const watchMoment = () => {
    if (counterRef.current) counterRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => setSlamKey((k) => k + 1), 650 * mo);
  };

  return (
    <div data-screen-label="Marketing — Home" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      {/* hero */}
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "44px 28px 30px",
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 50, alignItems: "center",
      }}>
        <div>
          <MonoTag tone="accent">For UK counters</MonoTag>
          <h1 style={{
            fontSize: "clamp(44px, 6vw, 76px)", fontWeight: 800, lineHeight: 0.98,
            letterSpacing: "-0.02em", margin: "20px 0 18px",
          }}>
            Loyalty, stamped before the coffee cools.
          </h1>
          <p style={{ fontSize: 17, lineHeight: "27px", color: "var(--w-ink-soft)", maxWidth: "36ch", margin: "0 0 28px" }}>
            A paper stamp card that lives in the customer's browser. They scan your till QR, you stamp with a PIN, a mystery reward unseals on visit three.
          </p>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 26 }}>
            <InkButton onClick={() => go("Merchant", "signup")}>Start a 30-day pilot</InkButton>
            <InkButton variant="outline" onClick={watchMoment}>Watch the counter moment</InkButton>
          </div>
          <MonoLine>£29/month after the pilot · one price, one venue</MonoLine>
        </div>

        {/* receipt demo */}
        <div style={{ transform: "rotate(2deg)" }}>
          <ReceiptCard mo={mo}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <MonoLine>The Old Crown · Bristol</MonoLine>
                <div style={{ fontWeight: 800, fontSize: 20, marginTop: 5 }}>Free hot drink after 3 visits</div>
              </div>
              <VenueMark size={58} />
            </div>
            <ReceiptRule />
            <div style={{ padding: "8px 0 4px" }}>
              <StampRow current={2} total={3} celebration={t.celebration} mo={mo} dates={["3 JUN", "9 JUN"]} />
            </div>
            <ReceiptRule />
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <MonoLine style={{ fontSize: 10 }}>CARD Nº OC-0248</MonoLine>
              <MonoLine style={{ fontSize: 10 }}>1 VISIT TO THE SEAL</MonoLine>
            </div>
          </ReceiptCard>
        </div>
      </div>

      {/* three steps */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "30px 28px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 18 }}>
          {[
            { n: "01", t: "Scan", c: "Customers point a camera at your till card. The stamp card opens in the browser — nothing to install." },
            { n: "02", t: "Stamp", c: "They hand the phone over; staff type a 4-digit PIN. A rubber stamp slams down. That's the whole transaction." },
            { n: "03", t: "Unseal", c: "Visit three breaks a wax seal on a mystery reward from your pool. Redeemable from the next day." },
          ].map((s, i) => (
            <div key={s.n} style={{
              border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
              background: i === 1 ? "var(--w-accent)" : "var(--w-card)",
              color: i === 1 ? "#fff" : "var(--w-ink)",
              boxShadow: "var(--w-shadow)", padding: "22px 22px 24px",
              transform: `rotate(${i === 1 ? -1 : i === 0 ? 0.6 : 0.8}deg)`,
            }}>
              <div style={{ fontFamily: "var(--w-mono)", fontSize: 12, fontWeight: 700, opacity: 0.65 }}>{s.n}</div>
              <div style={{ fontWeight: 800, fontSize: 26, margin: "8px 0 10px" }}>{s.t}</div>
              <p style={{ fontSize: 14.5, lineHeight: "22px", margin: 0, opacity: i === 1 ? 0.95 : 0.7 }}>{s.c}</p>
            </div>
          ))}
        </div>
        <div style={{ textAlign: "center", marginTop: 46, marginBottom: 50 }}>
          <MonoLine>Built for cafes, barbers, bakeries &amp; bars · UK pilot now open</MonoLine>
        </div>
      </div>

      {/* the counter moment — dark ink band */}
      <div ref={counterRef} style={{ background: "var(--w-ink)", color: "var(--w-paper)", borderTop: "2px solid var(--w-ink)", borderBottom: "2px solid var(--w-ink)" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "54px 28px 58px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 30, flexWrap: "wrap", marginBottom: 38 }}>
            <div style={{ maxWidth: "46ch" }}>
              <MonoTag tone="accent">The counter moment</MonoTag>
              <h2 style={{ fontSize: "clamp(30px, 4vw, 46px)", fontWeight: 800, lineHeight: 1.04, margin: "16px 0 10px", color: "var(--w-paper)" }}>
                Four beats, under ten seconds.
              </h2>
              <p style={{ fontSize: 15.5, lineHeight: "24px", margin: 0, color: "var(--w-paper)", opacity: 0.65 }}>
                The whole product is one small piece of theatre at the till. Choreographed so the queue never notices.
              </p>
            </div>
            <div style={{ textAlign: "center" }}>
              <div key={slamKey} style={{ display: "inline-block", position: "relative" }}>
                <StampDisc filled index={2} slammed={slamKey > 0} celebration={t.celebration} mo={mo} size={96} date="12 JUN" />
              </div>
              <div style={{ marginTop: 14 }}>
                <InkButton size="sm" onClick={() => setSlamKey((k) => k + 1)}>Play the slam</InkButton>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 22 }}>
            {MK_BEATS.map((b) => (
              <div key={b.n} style={{ borderTop: "2px dashed rgba(246,241,230,0.3)", paddingTop: 14 }}>
                <div style={{ fontFamily: "var(--w-mono)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", color: "var(--w-accent)" }}>BEAT {b.n}</div>
                <div style={{ fontWeight: 800, fontSize: 22, margin: "8px 0 8px", color: "var(--w-paper)" }}>{b.t}</div>
                <p style={{ fontSize: 13.5, lineHeight: "21px", margin: 0, color: "var(--w-paper)", opacity: 0.6 }}>{b.c}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* social proof strip */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "58px 28px 6px" }}>
        <div style={{ textAlign: "center", marginBottom: 30 }}>
          <MonoTag>From the pilot</MonoTag>
          <h2 style={{ fontSize: "clamp(28px, 3.6vw, 40px)", fontWeight: 800, lineHeight: 1.05, margin: "14px 0 0" }}>
            Counters that kept it.
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: 24 }}>
          {MK_QUOTES.map((qt) => <MkQuoteCard key={qt.initials} {...qt} mo={mo} />)}
        </div>
      </div>

      {/* pricing teaser */}
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "52px 28px 0" }}>
        <div style={{ transform: "rotate(-1deg)" }}>
          <ReceiptCard mo={mo}>
            <div style={{ textAlign: "center", padding: "8px 0 2px" }}>
              <MonoLine>After the 30-day pilot</MonoLine>
              <div style={{ fontSize: 58, fontWeight: 800, lineHeight: 1, margin: "12px 0 4px" }}>
                £29<span style={{ fontSize: 19, fontWeight: 700, color: "var(--w-ink-soft)" }}>/month</span>
              </div>
              <MonoLine style={{ fontSize: 10 }}>One price · one venue · no contracts</MonoLine>
              <ReceiptRule />
              <p style={{ fontSize: 14.5, lineHeight: "22px", color: "var(--w-ink-soft)", margin: "0 0 16px" }}>
                Unlimited stamps, the mystery pool, the printed QR kit — everything, no tiers.
              </p>
              <InkButton full onClick={() => setView("pricing")}>See what's included</InkButton>
              <MonoLine style={{ fontSize: 10, marginTop: 12 }}>No card to start the pilot</MonoLine>
            </div>
          </ReceiptCard>
        </div>
      </div>
    </div>
  );
}

/* ---------- pricing ---------- */

function MkPricing({ t, go }) {
  const mo = t.mo;
  const [openFaq, setOpenFaq] = useStateMk(0);
  return (
    <div data-screen-label="Marketing — Pricing" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "36px 28px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <MonoTag tone="accent">Pricing</MonoTag>
          <h1 style={{ fontSize: "clamp(38px, 5vw, 60px)", fontWeight: 800, lineHeight: 1, letterSpacing: "-0.02em", margin: "18px 0 12px" }}>
            One price. The whole machine.
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: "25px", color: "var(--w-ink-soft)", maxWidth: "44ch", margin: "0 auto" }}>
            £29 a month per venue, after a free 30-day pilot. No tiers, no seats, no "contact sales".
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 40, alignItems: "start" }}>
          {/* the plan receipt */}
          <div style={{ transform: "rotate(-1deg)", maxWidth: 520, margin: "0 auto", width: "100%" }}>
            <ReceiptCard mo={mo}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>Growth plan · per venue</MonoLine>
                <MonoTag tone="ink">The only plan</MonoTag>
              </div>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, margin: "16px 0 4px" }}>
                £29<span style={{ fontSize: 20, fontWeight: 700, color: "var(--w-ink-soft)" }}>/month</span>
              </div>
              <MonoLine style={{ fontSize: 10 }}>Billed monthly through Stripe · VAT included</MonoLine>
              <ReceiptRule />
              <MonoLine style={{ marginBottom: 12 }}>Everything included</MonoLine>
              <div style={{ display: "grid", gap: 11 }}>
                {MK_PLAN_BULLETS.map((b) => (
                  <div key={b} style={{ display: "flex", gap: 11, alignItems: "baseline" }}>
                    <span style={{ color: "var(--w-accent)", fontWeight: 800, fontSize: 16, flexShrink: 0 }}>✱</span>
                    <span style={{ fontSize: 15.5, fontWeight: 700, lineHeight: 1.4 }}>{b}</span>
                  </div>
                ))}
              </div>
              <ReceiptRule />
              <InkButton full onClick={() => go("Merchant", "signup")}>Start your 30-day pilot</InkButton>
              <MonoLine style={{ fontSize: 10, textAlign: "center", marginTop: 12 }}>No card to start · cancel any time</MonoLine>
            </ReceiptCard>
          </div>

          {/* pilot explainer */}
          <div style={{ paddingTop: 8 }}>
            <MonoTag>The pilot</MonoTag>
            <h2 style={{ fontSize: "clamp(26px, 3vw, 36px)", fontWeight: 800, lineHeight: 1.06, margin: "14px 0 12px" }}>
              30 days free. No card. If it doesn't earn its keep, walk away.
            </h2>
            <p style={{ fontSize: 15.5, lineHeight: "24px", color: "var(--w-ink-soft)", margin: "0 0 22px", maxWidth: "46ch" }}>
              Most venues see their first repeat visit inside the first week, so you'll know long before day 30. Your dashboard counts the regulars; you do the maths.
            </p>
            <div style={{ border: "2px dashed var(--w-line)", borderRadius: "var(--w-r)", padding: "16px 18px", maxWidth: 440 }}>
              <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700, marginBottom: 6 }}>After day 30</MonoLine>
              <p style={{ fontSize: 14, lineHeight: "21px", color: "var(--w-ink-soft)", margin: 0 }}>
                Pop a card into Stripe and carry on. Leaving later takes one month's notice from your billing page — earned rewards stay good for your regulars.
              </p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "58px 0 0" }}>
          <h2 style={{ fontSize: "clamp(26px, 3vw, 34px)", fontWeight: 800, margin: "0 0 18px" }}>Asked at the counter</h2>
          <div style={{ borderBottom: "2px dashed var(--w-line)" }}>
            {MK_FAQS.map((f, i) => (
              <MkFaqItem key={f.q} q={f.q} a={f.a} open={openFaq === i} mo={mo}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)} />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 44 }}>
            <InkButton onClick={() => go("Merchant", "signup")}>Start your 30-day pilot</InkButton>
            <MonoLine style={{ marginTop: 14 }}>No card to start · £29/month after · one month's notice</MonoLine>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- legal ---------- */

function MkLegal({ t, setView }) {
  const mo = t.mo;
  return (
    <div data-screen-label="Marketing — Legal" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "36px 28px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <MonoTag>Plain English summary · not the full legal text</MonoTag>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.02em", margin: "18px 0 12px" }}>
            The small print, kept legible.
          </h1>
          <p style={{ fontSize: 16, lineHeight: "24px", color: "var(--w-ink-soft)", maxWidth: "46ch", margin: "0 auto" }}>
            Two receipts: what everyone agrees to, and what happens to the data. The full versions arrive with your merchant agreement.
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 34, alignItems: "start" }}>
          <MkLegalColumn data={MK_TERMS} mo={mo} angle={-0.8} />
          <MkLegalColumn data={MK_PRIVACY} mo={mo} angle={0.9} />
        </div>
        <div style={{ textAlign: "center", marginTop: 44 }}>
          <InkButton variant="outline" onClick={() => setView("home")}>Back to the homepage</InkButton>
        </div>
      </div>
    </div>
  );
}

/* ---------- surface root ---------- */

function MarketingSite({ t, go }) {
  const [view, setViewRaw] = useStateMk(() => {
    const s = mkLoadState();
    return s && ["home", "pricing", "legal"].includes(s.view) ? s.view : "home";
  });

  useEffectMk(() => {
    localStorage.setItem(MK_LS, JSON.stringify({ view }));
  }, [view]);

  const setView = (v) => { setViewRaw(v); window.scrollTo(0, 0); };
  const reset = () => { localStorage.removeItem(MK_LS); setView("home"); };

  const marqueeItems = "NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · ";

  return (
    <div style={{ paddingBottom: 110 }}>
      {/* marquee strip */}
      <div style={{ background: "var(--w-ink)", color: "var(--w-paper)", overflow: "hidden", borderBottom: "2px solid var(--w-ink)" }}>
        <div style={{
          display: "flex", whiteSpace: "nowrap", width: "max-content",
          animation: `w-marquee ${22 * t.mo}s linear infinite`,
          fontFamily: "var(--w-mono)", fontSize: 12, letterSpacing: "0.12em", padding: "8px 0",
        }}>
          <span>{marqueeItems.repeat(6)}</span><span>{marqueeItems.repeat(6)}</span>
        </div>
      </div>

      <MkNav go={go} view={view} setView={setView} />

      {view === "home" && <MkHome t={t} go={go} setView={setView} />}
      {view === "pricing" && <MkPricing t={t} go={go} />}
      {view === "legal" && <MkLegal t={t} setView={setView} />}

      <MkFooter setView={setView} onReset={reset} />
    </div>
  );
}

window.MarketingEntry = {
  lsKey: MK_LS,
  presets: {
    home: { view: "home" },
    pricing: { view: "pricing" },
    legal: { view: "legal" },
  },
};

Object.assign(window, { MarketingSite, MarketingEntry: window.MarketingEntry });
