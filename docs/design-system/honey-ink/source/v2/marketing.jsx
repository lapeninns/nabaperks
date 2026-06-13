// Nabaperks v2 — Marketing: a riso poster, not a SaaS page.
function MarketingSite({ t }) {
  const marqueeItems = "NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · ";
  return (
    <div style={{ paddingBottom: 110 }} data-screen-label="Marketing site">
      {/* marquee strip */}
      <div style={{ background: "var(--w-ink)", color: "var(--w-paper)", overflow: "hidden", borderBottom: "2px solid var(--w-ink)" }}>
        <div style={{
          display: "flex", whiteSpace: "nowrap", width: "max-content",
          animation: `w-marquee ${22 / t.mo}s linear infinite`,
          fontFamily: "var(--w-mono)", fontSize: 12, letterSpacing: "0.12em", padding: "8px 0",
        }}>
          <span>{marqueeItems.repeat(6)}</span><span>{marqueeItems.repeat(6)}</span>
        </div>
      </div>

      {/* nav */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "18px 28px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{
            width: 30, height: 30, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 15, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 19 }}>nabaperks</span>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <GhostLink style={{ fontSize: 14 }}>Pricing</GhostLink>
          <InkButton size="sm" variant="outline">Merchant login</InkButton>
          <InkButton size="sm">Start free</InkButton>
        </div>
      </div>

      {/* hero */}
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "44px 28px 30px",
        display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 50, alignItems: "center",
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
            <InkButton>Start a 30-day pilot</InkButton>
            <InkButton variant="outline">Watch the counter moment</InkButton>
          </div>
          <MonoLine>£29/month after the pilot · one price, one venue</MonoLine>
        </div>

        {/* receipt demo */}
        <div style={{ transform: "rotate(2deg)" }}>
          <ReceiptCard mo={t.mo}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <MonoLine>The Old Crown · Bristol</MonoLine>
                <div style={{ fontWeight: 800, fontSize: 20, marginTop: 5 }}>Free hot drink after 3 visits</div>
              </div>
              <VenueMark size={58} />
            </div>
            <ReceiptRule />
            <div style={{ padding: "8px 0 4px" }}>
              <StampRow current={2} total={3} celebration={t.celebration} mo={t.mo} dates={["3 JUN", "9 JUN"]} />
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
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18 }}>
          {[
            { n: "01", t: "Scan", c: "Customers point a camera at your till card. The stamp card opens in the browser — nothing to install." },
            { n: "02", t: "Stamp", c: "They show a code; staff approve it at the counter station. A rubber stamp slams down. That's the whole transaction." },
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
        <div style={{ textAlign: "center", marginTop: 46 }}>
          <MonoLine>Built for cafes, barbers, bakeries &amp; bars · UK pilot now open</MonoLine>
        </div>
      </div>
    </div>
  );
}

window.MarketingSite = MarketingSite;
