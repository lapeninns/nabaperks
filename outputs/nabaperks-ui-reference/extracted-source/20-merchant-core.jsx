// Nabaperks v3 "Wet Ink" — 20-merchant-core
// Merchant surface OWNER. Stage machine: auth → onboarding → app.
// Renders Today + Counter itself; Activity/Customers/QR studio/Settings/Billing
// come from 21-merchant-ops (MerchantActivity, MerchantCustomers, MerchantQrStudio,
// MerchantSettings, MerchantBilling — each receives { t, go }).
const { useState: useStateMc, useEffect: useEffectMc } = React;

const MC_LS_KEY = "v3_merchant";

const MC_REWARDS_SEED = [
  { name: "Free flat white", weight: 3 },
  { name: "Slice of cake", weight: 2 },
  { name: "20% off next visit", weight: 1 },
];

const MC_DEFAULTS = {
  stage: "auth", // auth | onboarding | app
  tab: "today",  // today | activity | customers | qr | settings | billing | counter
  obStep: 1,
  venue: "",
  city: "",
  rewards: MC_REWARDS_SEED,
};

const MC_TABS = [
  { id: "today", label: "Today" },
  { id: "activity", label: "Activity" },
  { id: "customers", label: "Customers" },
  { id: "qr", label: "QR studio" },
  { id: "settings", label: "Settings" },
  { id: "billing", label: "Billing" },
  { id: "counter", label: "Counter" },
];

const MC_INPUT = {
  width: "100%", padding: "14px 16px", fontSize: 18,
  fontFamily: "var(--w-mono)", color: "var(--w-ink)",
  background: "var(--w-paper)", border: "2px solid var(--w-ink)",
  borderRadius: "var(--w-r)", outline: "none",
};

function mcBoot() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(MC_LS_KEY)); } catch (e) { saved = null; }
  const merged = { ...MC_DEFAULTS, ...(saved || {}) };
  if (!Array.isArray(merged.rewards) || merged.rewards.length === 0) merged.rewards = MC_REWARDS_SEED;
  return merged;
}

/* ---------- QrBlock (owned + exported by this module) ---------- */

function QrBlock({ size = 148 }) {
  // deterministic fake QR — same pattern every render
  const cells = [];
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    const v = Math.sin(x * 13.7 + y * 7.3) * 43758.5453;
    if ((v - Math.floor(v)) > 0.52) cells.push([x, y]);
  }
  const finder = (cx, cy) => (
    <g key={cx + "-" + cy}>
      <rect x={cx} y={cy} width={3} height={3} fill="none" stroke="var(--w-ink)" strokeWidth={0.55} />
      <rect x={cx + 1} y={cy + 1} width={1} height={1} fill="var(--w-ink)" />
    </g>
  );
  return (
    <div style={{ background: "var(--w-card)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", padding: 12, display: "inline-block" }}>
      <svg width={size} height={size} viewBox="0 0 13 13">
        {cells.filter(([x, y]) => !((x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8)))
          .map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="var(--w-ink)" />)}
        {finder(0, 0)}{finder(10, 0)}{finder(0, 10)}
      </svg>
    </div>
  );
}

/* ---------- small bits ---------- */

function McBrand({ venue }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{
        width: 28, height: 28, borderRadius: "50%", background: "var(--w-accent)",
        border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
        color: "#fff", fontWeight: 800, fontSize: 14, transform: "rotate(-6deg)",
      }}>✱</span>
      <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>nabaperks</span>
      {venue && <MonoTag style={{ marginLeft: 6 }}>{venue}</MonoTag>}
    </div>
  );
}

function McStat({ value, label, tone }) {
  return (
    <div style={{
      background: tone === "accent" ? "var(--w-accent)" : "var(--w-card)",
      color: tone === "accent" ? "#fff" : "var(--w-ink)",
      border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
      boxShadow: "var(--w-shadow-sm)", padding: "16px 18px",
    }}>
      <div style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: 38, lineHeight: 1 }}>{value}</div>
      <div style={{
        fontFamily: "var(--w-mono)", fontSize: 10.5, textTransform: "uppercase",
        letterSpacing: "0.08em", marginTop: 8, opacity: tone === "accent" ? 0.9 : 0.6,
      }}>{label}</div>
    </div>
  );
}

function McFeedLine({ time, what, tone }) {
  const dot = { stamp: "var(--w-accent)", reward: "var(--w-sun)", join: "var(--w-cobalt)", redeem: "var(--w-leaf)" }[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "2px dashed var(--w-line)" }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: dot, border: "1.5px solid var(--w-ink)", flexShrink: 0 }}></span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{what}</span>
      <span style={{ fontFamily: "var(--w-mono)", fontSize: 11, color: "var(--w-ink-soft)" }}>{time}</span>
    </div>
  );
}

function McField({ label, value, onChange, placeholder, inputStyle }) {
  return (
    <div>
      <MonoLine style={{ marginBottom: 8 }}>{label}</MonoLine>
      <input value={value} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...MC_INPUT, ...inputStyle }} />
    </div>
  );
}

/* ---------- stage: auth ---------- */

function McAuth({ t, onDone }) {
  const mo = t.mo;
  const [mode, setMode] = useStateMc("create");   // create | signin
  const [phase, setPhase] = useStateMc("email");  // email | code
  const [email, setEmail] = useStateMc("");
  const [code, setCode] = useStateMc("");
  const emailOk = /\S+@\S+\.\S+/.test(email);
  const create = mode === "create";

  const label = phase === "code"
    ? "Merchant · Check your email"
    : create ? "Merchant · Create account" : "Merchant · Sign in";

  return (
    <div data-screen-label={label} style={{ maxWidth: 460, margin: "0 auto", animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      {phase === "email" ? (
        <div>
          <div style={{ textAlign: "center", margin: "26px 0 24px" }}>
            <MonoTag tone={create ? "accent" : "plain"}>{create ? "Start your 30-day pilot" : "Merchant access"}</MonoTag>
            <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.06, margin: "16px 0 10px" }}>
              {create ? "Set up your loyalty counter." : "Welcome back to the counter."}
            </h1>
            <p style={{ fontSize: 15, lineHeight: "22px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "32ch" }}>
              {create
                ? "No password, no card details. We email a six-digit code and the whole setup takes about five minutes."
                : "No password here — we email a six-digit code to sign you in."}
            </p>
          </div>
          <ReceiptCard mo={mo}>
            <McField label="Venue email" value={email} onChange={setEmail} placeholder="hello@oldcrown.pub" />
            <div style={{ marginTop: 14 }}>
              <InkButton full disabled={!emailOk} onClick={() => setPhase("code")}>Email me a code</InkButton>
            </div>
            <div style={{ textAlign: "center", marginTop: 12 }}>
              <DemoTag onClick={() => setEmail("hello@oldcrown.pub")}>Autofill hello@oldcrown.pub</DemoTag>
            </div>
          </ReceiptCard>
          <div style={{ textAlign: "center", marginTop: 14 }}>
            <GhostLink onClick={() => { setMode(create ? "signin" : "create"); setCode(""); }}>
              {create ? "Already set up? Sign in" : "New here? Create your account"}
            </GhostLink>
            <MonoLine style={{ fontSize: 10, marginTop: 10 }}>30 days free · £29/month after · one price, one venue</MonoLine>
          </div>
        </div>
      ) : (
        <div>
          <div style={{ textAlign: "center", margin: "26px 0 24px" }}>
            <MonoTag tone="ink">Code sent</MonoTag>
            <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.06, margin: "16px 0 10px" }}>Check your inbox.</h1>
            <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
              Sent to {email || "hello@oldcrown.pub"} · expires in 10 min
            </p>
          </div>
          <OtpBoxes value={code} onChange={setCode} />
          <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
            <InkButton full disabled={code.length !== 6} onClick={() => onDone(mode)}>
              {create ? "Create my account" : "Sign me in"}
            </InkButton>
            <div style={{ textAlign: "center" }}>
              <DemoTag onClick={() => setCode("482915")}>Autofill code</DemoTag>
            </div>
            <div style={{ textAlign: "center" }}>
              <GhostLink onClick={() => { setPhase("email"); setCode(""); }}>Use a different email</GhostLink>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- stage: onboarding ---------- */

function McOnboarding({ t, obStep, setObStep, venue, setVenue, city, setCity, rewards, setRewards, onLive, onSkip }) {
  const mo = t.mo;
  const [newReward, setNewReward] = useStateMc("");
  const [live, setLive] = useStateMc(false);

  const cycleWeight = (i) => setRewards(rewards.map((r, j) => j === i ? { ...r, weight: (r.weight % 3) + 1 } : r));
  const removeReward = (i) => setRewards(rewards.filter((_, j) => j !== i));
  const addReward = () => {
    if (!newReward.trim()) return;
    setRewards([...rewards, { name: newReward.trim(), weight: 1 }]);
    setNewReward("");
  };

  const steps = [
    { n: 1, title: "Name your venue", done: venue.trim() ? `${venue.trim()} · ${city.trim() || "Bristol"}` : null },
    { n: 2, title: "Stock the reward pool", done: obStep > 2 ? `${rewards.length} rewards sealed in` : null },
    { n: 3, title: "Print your QR", done: null },
  ];

  return (
    <div data-screen-label="Merchant · Onboarding" style={{ maxWidth: 640, animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <MonoLine>Setup · about 5 minutes</MonoLine>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, margin: "6px 0 22px" }}>Three steps, then you're live.</h1>
        </div>
        <div style={{ marginBottom: 24 }}><DemoTag onClick={onSkip}>Skip setup</DemoTag></div>
      </div>
      <div style={{ display: "grid", gap: 14 }}>
        {steps.map((s) => {
          const state = s.n < obStep ? "done" : s.n === obStep ? "now" : "next";
          return (
            <div key={s.n} style={{
              border: "2px solid " + (state === "next" ? "var(--w-line)" : "var(--w-ink)"),
              borderRadius: "var(--w-r)", background: "var(--w-card)",
              boxShadow: state === "now" ? "var(--w-shadow)" : "none",
              padding: "18px 20px", opacity: state === "next" ? 0.6 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <span style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  border: "2px solid var(--w-ink)", display: "grid", placeItems: "center",
                  background: state === "done" ? "var(--w-leaf)" : state === "now" ? "var(--w-accent)" : "transparent",
                  color: state === "next" ? "var(--w-ink)" : "#fff",
                  fontWeight: 800, transform: "rotate(-6deg)",
                }}>{state === "done" ? "✓" : s.n}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800, fontSize: 17 }}>{s.title}</div>
                  {s.done && state !== "now" && <MonoLine style={{ fontSize: 10, marginTop: 2 }}>{s.done}</MonoLine>}
                </div>
                {state === "done" && (
                  <GhostLink style={{ fontSize: 13 }} onClick={() => setObStep(s.n)}>Edit</GhostLink>
                )}
              </div>

              {state === "now" && s.n === 1 && (
                <div style={{ marginTop: 16, display: "grid", gap: 14 }}>
                  <McField label="Venue name" value={venue} onChange={setVenue} placeholder="The Old Crown" />
                  <McField label="City" value={city} onChange={setCity} placeholder="Bristol" />
                  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <InkButton size="md" disabled={!venue.trim()} onClick={() => setObStep(2)}>Save — next</InkButton>
                    <DemoTag onClick={() => { setVenue("The Old Crown"); setCity("Bristol"); }}>Autofill The Old Crown</DemoTag>
                  </div>
                  <MonoLine style={{ fontSize: 10 }}>Customers see this name the moment their card opens.</MonoLine>
                </div>
              )}

              {state === "now" && s.n === 2 && (
                <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                  {rewards.map((r, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                      border: "2px dashed var(--w-line)", borderRadius: 8, padding: "8px 8px 8px 13px",
                      fontFamily: "var(--w-mono)", fontSize: 12.5,
                    }}>
                      <span style={{ flex: 1 }}>{r.name}</span>
                      <button onClick={() => cycleWeight(i)} title="Tap to change the draw weight" style={{
                        fontFamily: "var(--w-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
                        border: "1.5px solid var(--w-ink)", borderRadius: 999, padding: "4px 10px",
                        background: "var(--w-paper)", color: "var(--w-ink)", cursor: "pointer",
                      }}>WEIGHT ×{r.weight}</button>
                      {rewards.length > 1 && (
                        <button onClick={() => removeReward(i)} title="Remove from the pool" style={{
                          width: 28, height: 28, border: "1.5px dashed var(--w-line)", borderRadius: 8,
                          background: "transparent", color: "var(--w-ink-soft)", cursor: "pointer",
                          fontSize: 15, lineHeight: 1, fontFamily: "var(--w-mono)",
                        }}>×</button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newReward} placeholder="Add a reward — e.g. Free pastry"
                      onChange={(e) => setNewReward(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addReward(); }}
                      style={{ ...MC_INPUT, fontSize: 14, padding: "10px 13px", flex: 1 }} />
                    <InkButton size="sm" variant="outline" disabled={!newReward.trim()} onClick={addReward}>Add</InkButton>
                  </div>
                  <MonoLine style={{ fontSize: 10 }}>Heavier weights turn up more often. One is drawn when the seal breaks at visit 3.</MonoLine>
                  <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 4 }}>
                    <InkButton size="md" onClick={() => setObStep(3)}>Pool's stocked — next</InkButton>
                    <GhostLink onClick={() => setObStep(1)}>Back</GhostLink>
                  </div>
                </div>
              )}

              {state === "now" && s.n === 3 && (
                <div style={{ marginTop: 16, position: "relative" }}>
                  {live && <CelebrationBits type={t.celebration === "Ripple" ? "Ripple" : "Burst"} mo={mo} seed={7} />}
                  {!live ? (
                    <div style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                      <QrBlock size={110} />
                      <div style={{ display: "grid", gap: 8 }}>
                        <InkButton size="md" onClick={() => setLive(true)}>Print poster + till card</InkButton>
                        <MonoLine style={{ fontSize: 10 }}>One permanent code · this is the moment you go live.</MonoLine>
                        <GhostLink style={{ justifySelf: "start", padding: "4px 0" }} onClick={() => setObStep(2)}>Back</GhostLink>
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: "center", padding: "10px 0 4px", animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` }}>
                      <MonoTag tone="accent">Live at {venue.trim() || "The Old Crown"}</MonoTag>
                      <h2 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.08, margin: "14px 0 8px" }}>The counter is ready.</h2>
                      <p style={{ fontSize: 14.5, color: "var(--w-ink-soft)", margin: "0 auto 18px", maxWidth: "36ch" }}>
                        Stick the poster where the queue forms. The first scan does the rest.
                      </p>
                      <InkButton onClick={onLive}>Open Today at the counter</InkButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- app tab: Today ---------- */

function McToday({ t, goTab, go }) {
  const mo = t.mo;
  const [pinShown, setPinShown] = useStateMc(false);
  return (
    <div style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <MonoLine>Thursday 12 June · Bristol</MonoLine>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 0" }}>Today at the counter</h1>
        </div>
        <MonoTag tone="ink">Pilot · day 23 of 30</MonoTag>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 20 }}>
        <McStat value="14" label="Stamps today" tone="accent" />
        <McStat value="3" label="Rewards ready" />
        <McStat value="5" label="New members" />
        <McStat value="41%" label="Come back twice" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, alignItems: "start" }}>
        <ReceiptCard mo={mo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Live from the till</div>
            <MonoTag>Auto-refreshing</MonoTag>
          </div>
          <ReceiptRule />
          <McFeedLine time="11:42" what="Asha K. unsealed a mystery reward" tone="reward" />
          <McFeedLine time="11:41" what="Asha K. — stamp 3 of 3" tone="stamp" />
          <McFeedLine time="10:18" what="Tom R. — stamp 2 of 3" tone="stamp" />
          <McFeedLine time="09:51" what="Priya S. joined from the counter QR" tone="join" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 10, flexWrap: "wrap" }}>
            <MonoLine style={{ fontSize: 10 }}>Weekly digest lands Monday 08:00.</MonoLine>
            <GhostLink style={{ fontSize: 13.5, padding: "4px 0" }} onClick={() => goTab("activity")}>Full activity log</GhostLink>
          </div>
        </ReceiptCard>

        <div style={{ display: "grid", gap: 18 }}>
          <ReceiptCard mo={mo}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Your till QR</div>
            <MonoLine style={{ marginBottom: 14 }}>One permanent code · 60 scans/min headroom</MonoLine>
            <div style={{ textAlign: "center" }}><QrBlock /></div>
            <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
              <InkButton full size="sm" variant="outline" onClick={() => goTab("qr")}>Reprint poster &amp; till card</InkButton>
              <GhostLink style={{ fontSize: 13, justifySelf: "center" }} onClick={() => go("Customer", "card")}>See what customers get</GhostLink>
            </div>
          </ReceiptCard>
          <div role="button" onClick={() => setPinShown(!pinShown)} style={{ cursor: "pointer" }}>
            <ReceiptCard mo={mo}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Staff PIN</div>
              <div key={String(pinShown)} style={{
                fontFamily: "var(--w-mono)", fontSize: 30, fontWeight: 700, letterSpacing: "0.3em",
                margin: "10px 0 4px", color: pinShown ? "var(--w-accent)" : "var(--w-ink)",
                animation: `w-pop ${300 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
              }}>{pinShown ? "7 3 1 2" : "● ● ● ●"}</div>
              <MonoLine style={{ fontSize: 10 }}>
                {pinShown ? "Today's PIN · rotates tonight at 04:00 · tap to hide" : "Rotates nightly at 04:00 · tap to reveal"}
              </MonoLine>
            </ReceiptCard>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- app tab: Counter ---------- */

function McCounter({ t }) {
  const mo = t.mo;
  const [extra, setExtra] = useStateMc(0);
  const sims = [
    "DAN W. · JUST NOW · STAMP 1/3",
    "S. B. · JUST NOW · STAMP 2/3",
    "R. O. · JUST NOW · STAMP 3/3 — SEAL BREAKS",
  ];
  const last = extra === 0 ? "LAST: ASHA K. · 11:41 · STAMP 3/3" : "LAST: " + sims[(extra - 1) % sims.length];
  const count = 14 + extra;
  return (
    <div style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <div style={{
        background: "var(--w-ink)", color: "var(--w-paper)",
        border: "2px solid var(--w-ink)", borderRadius: 16, padding: "34px 30px",
        textAlign: "center",
      }}>
        <MonoLine style={{ color: "rgba(246,241,230,0.55)" }}>Counter mode · pin this tab</MonoLine>
        <div style={{ fontFamily: "var(--w-mono)", fontSize: 15, margin: "16px 0 4px", color: "rgba(246,241,230,0.55)" }}>STAMPS TODAY</div>
        <div key={count} style={{
          fontSize: 110, fontWeight: 800, lineHeight: 1, fontFamily: "var(--w-display)",
          animation: `w-pop ${360 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
        }}>{count}</div>
        <div style={{
          display: "inline-flex", gap: 10, alignItems: "center", margin: "22px 0",
          border: "2px solid rgba(246,241,230,0.3)", borderRadius: 999, padding: "8px 18px",
        }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--w-leaf)" }}></span>
          <span style={{ fontFamily: "var(--w-mono)", fontSize: 12.5 }}>{last}</span>
        </div>
        <p style={{ fontSize: 15, color: "rgba(246,241,230,0.7)", maxWidth: "38ch", margin: "0 auto" }}>
          Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job.
        </p>
      </div>
      <div style={{ textAlign: "center", marginTop: 16 }}>
        <DemoTag onClick={() => setExtra(extra + 1)}>Simulate a stamp</DemoTag>
      </div>
    </div>
  );
}

/* ---------- surface owner ---------- */

function MerchantSurface({ t, go }) {
  const mo = t.mo;
  const [boot] = useStateMc(mcBoot);
  const [stage, setStage] = useStateMc(boot.stage);
  const [tab, setTab] = useStateMc(boot.tab);
  const [obStep, setObStep] = useStateMc(boot.obStep);
  const [venue, setVenue] = useStateMc(boot.venue);
  const [city, setCity] = useStateMc(boot.city);
  const [rewards, setRewards] = useStateMc(boot.rewards);

  useEffectMc(() => {
    localStorage.setItem(MC_LS_KEY, JSON.stringify({ stage, tab, obStep, venue, city, rewards }));
  }, [stage, tab, obStep, venue, city, rewards]);

  const restart = () => {
    localStorage.removeItem(MC_LS_KEY);
    setStage("auth"); setTab("today"); setObStep(1);
    setVenue(""); setCity(""); setRewards(MC_REWARDS_SEED);
  };

  const venueTag = stage === "app" ? (venue.trim() || "The Old Crown") : null;
  const tabLabel = (MC_TABS.find((tb) => tb.id === tab) || MC_TABS[0]).label;

  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "26px 28px 110px", minHeight: "100vh" }}
      data-screen-label={stage === "app" ? `Merchant · ${tabLabel}` : undefined}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: stage === "app" ? 14 : 22, flexWrap: "wrap", gap: 12 }}>
        <McBrand venue={venueTag} />
        <DemoTag onClick={restart}>Restart flow</DemoTag>
      </div>

      {stage === "auth" && (
        <McAuth t={t} onDone={(mode) => {
          if (mode === "create") { setObStep(1); setStage("onboarding"); }
          else { setTab("today"); setStage("app"); }
        }} />
      )}

      {stage === "onboarding" && (
        <McOnboarding t={t}
          obStep={obStep} setObStep={setObStep}
          venue={venue} setVenue={setVenue}
          city={city} setCity={setCity}
          rewards={rewards} setRewards={setRewards}
          onLive={() => { setTab("today"); setStage("app"); }}
          onSkip={() => { setTab("today"); setStage("app"); }} />
      )}

      {stage === "app" && (
        <div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 24 }}>
            {MC_TABS.map((tb) => (
              <button key={tb.id} onClick={() => setTab(tb.id)} style={{
                fontFamily: "var(--w-display)", fontWeight: 700, fontSize: 14,
                padding: "9px 16px", borderRadius: 999, cursor: "pointer",
                border: "2px solid " + (tab === tb.id ? "var(--w-ink)" : "transparent"),
                background: tab === tb.id ? "var(--w-ink)" : "transparent",
                color: tab === tb.id ? "var(--w-paper)" : "var(--w-ink-soft)",
              }}>{tb.label}</button>
            ))}
          </div>
          {tab === "today" && <McToday t={t} goTab={setTab} go={go} />}
          {tab === "activity" && <MerchantActivity t={t} go={go} />}
          {tab === "customers" && <MerchantCustomers t={t} go={go} />}
          {tab === "qr" && <MerchantQrStudio t={t} go={go} />}
          {tab === "settings" && <MerchantSettings t={t} go={go} />}
          {tab === "billing" && <MerchantBilling t={t} go={go} />}
          {tab === "counter" && <McCounter t={t} />}
        </div>
      )}
    </div>
  );
}

/* ---------- entry + exports ---------- */

const MerchantEntry = {
  lsKey: MC_LS_KEY,
  presets: {
    signup: { stage: "auth" },
    onboarding: { stage: "onboarding", obStep: 1 },
    today: { stage: "app", tab: "today" },
    activity: { stage: "app", tab: "activity" },
    customers: { stage: "app", tab: "customers" },
    qr: { stage: "app", tab: "qr" },
    settings: { stage: "app", tab: "settings" },
    billing: { stage: "app", tab: "billing" },
    counter: { stage: "app", tab: "counter" },
  },
};

Object.assign(window, { MerchantSurface, MerchantEntry, QrBlock });
