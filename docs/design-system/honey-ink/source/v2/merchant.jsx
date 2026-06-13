// Nabaperks v2 — Merchant: a "Today" screen, not a dashboard.
const { useState: useStateM } = React;

function MStat({ value, label, tone }) {
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

function FeedLine({ time, what, tone }) {
  const dot = { stamp: "var(--w-accent)", reward: "var(--w-sun)", join: "var(--w-cobalt)", redeem: "var(--w-leaf)" }[tone];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "2px dashed var(--w-line)" }}>
      <span style={{ width: 11, height: 11, borderRadius: "50%", background: dot, border: "1.5px solid var(--w-ink)", flexShrink: 0 }}></span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{what}</span>
      <span style={{ fontFamily: "var(--w-mono)", fontSize: 11, color: "var(--w-ink-soft)" }}>{time}</span>
    </div>
  );
}

function QrBlock({ size = 148 }) {
  // deterministic fake QR
  const cells = [];
  for (let y = 0; y < 13; y++) for (let x = 0; x < 13; x++) {
    const v = Math.sin(x * 13.7 + y * 7.3) * 43758.5453;
    if ((v - Math.floor(v)) > 0.52) cells.push([x, y]);
  }
  const finder = (cx, cy) => (
    <g key={cx + "-" + cy}>
      <rect x={cx} y={cy} width={3} height={3} fill="none" stroke="#111" strokeWidth={0.55} />
      <rect x={cx + 1} y={cy + 1} width={1} height={1} fill="#111" />
    </g>
  );
  return (
    <div style={{ background: "#fff", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", padding: 12, display: "inline-block" }}>
      <svg width={size} height={size} viewBox="0 0 13 13">
        {cells.filter(([x, y]) => !((x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8)))
          .map(([x, y], i) => <rect key={i} x={x} y={y} width={1} height={1} fill="#111" />)}
        {finder(0, 0)}{finder(10, 0)}{finder(0, 10)}
      </svg>
    </div>
  );
}

function MerchantToday({ t }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <MonoLine>Thursday 12 June · Bristol</MonoLine>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 0" }}>Today at the counter</h1>
        </div>
        <MonoTag tone="ink">Pilot · day 23 of 30</MonoTag>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, marginBottom: 20 }}>
        <MStat value="14" label="Stamps today" tone="accent" />
        <MStat value="3" label="Rewards ready" />
        <MStat value="5" label="New members" />
        <MStat value="41%" label="Come back twice" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 18, alignItems: "start" }}>
        <ReceiptCard mo={t.mo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Live from the till</div>
            <MonoTag>Auto-refreshing</MonoTag>
          </div>
          <ReceiptRule />
          <FeedLine time="11:02" what="Tom R. unsealed a mystery reward" tone="reward" />
          <FeedLine time="10:48" what="Asha K. — stamp 2 of 3" tone="stamp" />
          <FeedLine time="10:31" what="New member joined from the till QR" tone="join" />
          <FeedLine time="09:14" what="Priya S. — stamp 1 of 3" tone="stamp" />
          <FeedLine time="09:02" what="Dan W. redeemed: free flat white" tone="redeem" />
          <div style={{ marginTop: 14 }}>
            <MonoLine style={{ fontSize: 10 }}>Weekly digest lands Monday 08:00 — analytics live there, not here.</MonoLine>
          </div>
        </ReceiptCard>

        <div style={{ display: "grid", gap: 18 }}>
          <ReceiptCard mo={t.mo}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>Your till QR</div>
            <MonoLine style={{ marginBottom: 14 }}>One permanent code</MonoLine>
            <div style={{ textAlign: "center" }}><QrBlock /></div>
            <div style={{ marginTop: 14 }}>
              <InkButton full size="sm" variant="outline">Reprint poster &amp; till card</InkButton>
            </div>
          </ReceiptCard>
          <ReceiptCard mo={t.mo}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Staff PIN</div>
            <div style={{ fontFamily: "var(--w-mono)", fontSize: 30, fontWeight: 700, letterSpacing: "0.3em", margin: "10px 0 4px" }}>7 3 ● ●</div>
            <MonoLine style={{ fontSize: 10 }}>Rotates nightly · tap to reveal</MonoLine>
          </ReceiptCard>
        </div>
      </div>
    </div>
  );
}

function MerchantSetup({ t }) {
  const [step, setStep] = useStateM(2);
  const steps = [
    { n: 1, title: "Name your venue", done: "The Old Crown · Bristol" },
    { n: 2, title: "Stock the reward pool", done: null },
    { n: 3, title: "Print your QR", done: null },
  ];
  return (
    <div style={{ maxWidth: 620 }}>
      <MonoLine>Setup · about 5 minutes</MonoLine>
      <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 22px" }}>Three steps, then you're live.</h1>
      <div style={{ display: "grid", gap: 14 }}>
        {steps.map((s) => {
          const state = s.n < step ? "done" : s.n === step ? "now" : "next";
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
                  {s.done && <MonoLine style={{ fontSize: 10, marginTop: 2 }}>{s.done}</MonoLine>}
                </div>
                {state === "now" && s.n < 3 && <InkButton size="sm" onClick={() => setStep(step + 1)}>Done — next</InkButton>}
              </div>
              {state === "now" && s.n === 2 && (
                <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
                  {["Free flat white — weight 3", "Slice of cake — weight 2", "20% off next visit — weight 1"].map((r) => (
                    <div key={r} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      border: "2px dashed var(--w-line)", borderRadius: 8, padding: "9px 13px",
                      fontFamily: "var(--w-mono)", fontSize: 12.5,
                    }}>
                      <span>{r}</span><span style={{ color: "var(--w-leaf)", fontWeight: 700 }}>ACTIVE</span>
                    </div>
                  ))}
                  <DemoTag onClick={() => { }}>Add another reward</DemoTag>
                </div>
              )}
              {state === "now" && s.n === 3 && (
                <div style={{ marginTop: 16, display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
                  <QrBlock size={110} />
                  <div style={{ display: "grid", gap: 8 }}>
                    <InkButton size="md">Print poster + till card</InkButton>
                    <MonoLine style={{ fontSize: 10 }}>This is the moment you go live.</MonoLine>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MerchantCounter({ t }) {
  return (
    <div style={{
      background: "var(--w-ink)", color: "var(--w-paper)",
      border: "2px solid var(--w-ink)", borderRadius: 16, padding: "34px 30px",
      textAlign: "center",
    }}>
      <MonoLine style={{ color: "rgba(246,241,230,0.55)" }}>Counter mode · pin this tab</MonoLine>
      <div style={{ fontFamily: "var(--w-mono)", fontSize: 15, margin: "16px 0 4px", color: "rgba(246,241,230,0.55)" }}>STAMPS TODAY</div>
      <div style={{ fontSize: 110, fontWeight: 800, lineHeight: 1, fontFamily: "var(--w-display)" }}>14</div>
      <div style={{
        display: "inline-flex", gap: 10, alignItems: "center", margin: "22px 0",
        border: "2px solid rgba(246,241,230,0.3)", borderRadius: 999, padding: "8px 18px",
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--w-leaf)" }}></span>
        <span style={{ fontFamily: "var(--w-mono)", fontSize: 12.5 }}>LAST: ASHA K. · 10:48 · STAMP 2/3</span>
      </div>
      <p style={{ fontSize: 15, color: "rgba(246,241,230,0.7)", maxWidth: "38ch", margin: "0 auto" }}>
        Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job.
      </p>
    </div>
  );
}

function MerchantApp({ t }) {
  const [tab, setTab] = useStateM("Today");
  const tabs = ["Today", "Setup", "Counter mode"];
  return (
    <div style={{ maxWidth: 1060, margin: "0 auto", padding: "26px 28px 110px" }} data-screen-label="Merchant app">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 26, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 28, height: 28, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 14, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 17 }}>nabaperks</span>
          <MonoTag style={{ marginLeft: 6 }}>The Old Crown</MonoTag>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {tabs.map((tb) => (
            <button key={tb} onClick={() => setTab(tb)} style={{
              fontFamily: "var(--w-display)", fontWeight: 700, fontSize: 14,
              padding: "9px 16px", borderRadius: 999, cursor: "pointer",
              border: "2px solid " + (tab === tb ? "var(--w-ink)" : "transparent"),
              background: tab === tb ? "var(--w-ink)" : "transparent",
              color: tab === tb ? "var(--w-paper)" : "var(--w-ink-soft)",
            }}>{tb}</button>
          ))}
        </div>
      </div>
      {tab === "Today" && <MerchantToday t={t} />}
      {tab === "Setup" && <MerchantSetup t={t} />}
      {tab === "Counter mode" && <MerchantCounter t={t} />}
    </div>
  );
}

window.MerchantApp = MerchantApp;
window.QrBlock = QrBlock;
