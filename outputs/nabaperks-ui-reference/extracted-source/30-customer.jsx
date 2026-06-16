// Nabaperks v3 "Wet Ink" — Customer journey (the star of the flow)
// scan → landing → firstStamp → save → otp → card → sealed → revealed → ready → redeemed
// plus the calm one-per-day "alreadyStamped" screen.
const { useState: useStateCu, useEffect: useEffectCu, useRef: useRefCu } = React;

const CU_LS_KEY = "v3_customer";

const CU_FALLBACK = { step: "scan", visits: 0, saved: false, dayReady: false, stampedToday: false };

const CU_PRESETS = {
  scan: { step: "scan", visits: 0, saved: false, dayReady: false, stampedToday: false },
  landing: { step: "landing", visits: 0, saved: false, dayReady: false, stampedToday: false },
  firstStamp: { step: "firstStamp", visits: 1, saved: false, dayReady: false, stampedToday: true },
  save: { step: "save", visits: 1, saved: false, dayReady: false, stampedToday: true },
  card: { step: "card", visits: 2, saved: true, dayReady: false, stampedToday: false },
  sealed: { step: "sealed", visits: 3, saved: true, dayReady: false, stampedToday: true },
  revealed: { step: "revealed", visits: 3, saved: true, dayReady: false, stampedToday: true },
  ready: { step: "ready", visits: 3, saved: true, dayReady: true, stampedToday: false },
  redeemed: { step: "redeemed", visits: 3, saved: true, dayReady: true, stampedToday: false },
  alreadyStamped: { step: "alreadyStamped", visits: 1, saved: false, dayReady: false, stampedToday: true },
};

function cuLoadState() {
  try { return JSON.parse(localStorage.getItem(CU_LS_KEY)) || null; } catch (e) { return null; }
}

/* ---------- scan: phone-camera viewfinder mock ---------- */

function CuScanView({ mo, onDone }) {
  const [locked, setLocked] = useStateCu(false);
  useEffectCu(() => {
    const a = setTimeout(() => setLocked(true), 820 * mo);
    const b = setTimeout(() => onDone && onDone(), 1500 * mo);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, []);

  const edge = "3px solid rgba(246,241,230,0.92)";
  const corner = { position: "absolute", width: 34, height: 34, pointerEvents: "none" };
  const chrome = { color: "rgba(246,241,230,0.55)", fontSize: 10 };

  return (
    <div data-screen-label="Customer · Scan" onClick={onDone}
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`, cursor: "pointer" }}>
      <div style={{ textAlign: "center", margin: "2px 0 16px" }}>
        <MonoTag tone={locked ? "accent" : "ink"}>
          {locked ? "Found it — opening your card" : "Point your camera at the till card"}
        </MonoTag>
      </div>

      <div style={{
        position: "relative", background: "var(--w-ink)", border: "2px solid var(--w-ink)",
        borderRadius: 18, height: 468, overflow: "hidden", boxShadow: "var(--w-shadow)",
        display: "grid", placeItems: "center",
      }}>
        {/* camera chrome */}
        <div style={{ position: "absolute", top: 14, left: 20, right: 20, display: "flex", justifyContent: "space-between" }}>
          <MonoLine style={chrome}>Camera</MonoLine>
          <MonoLine style={chrome}>Thu 12 Jun</MonoLine>
        </div>

        {/* corner brackets */}
        <div style={{ ...corner, top: 40, left: 18, borderTop: edge, borderLeft: edge, borderTopLeftRadius: 10 }}></div>
        <div style={{ ...corner, top: 40, right: 18, borderTop: edge, borderRight: edge, borderTopRightRadius: 10 }}></div>
        <div style={{ ...corner, bottom: 44, left: 18, borderBottom: edge, borderLeft: edge, borderBottomLeftRadius: 10 }}></div>
        <div style={{ ...corner, bottom: 44, right: 18, borderBottom: edge, borderRight: edge, borderBottomRightRadius: 10 }}></div>

        {/* searching ripples behind the card */}
        {!locked && [0, 1].map((i) => (
          <div key={i} style={{
            position: "absolute", left: "50%", top: "50%",
            width: 90, height: 90, marginLeft: -45, marginTop: -45,
            border: "2.5px solid rgba(246,241,230,0.4)", borderRadius: "50%",
            animation: `w-ripple ${1500 * mo}ms ${i * 500 * mo}ms cubic-bezier(0.2,0,0,1) infinite`,
            opacity: 0,
          }}></div>
        ))}

        {/* the till card in frame */}
        <div style={{
          position: "relative", width: 234, background: "var(--w-card)",
          border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
          padding: "14px 16px 14px", textAlign: "center", transform: "rotate(-3deg)",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
            <VenueMark size={36} angle={-8} />
            <div style={{ textAlign: "left" }}>
              <MonoLine style={{ fontSize: 9 }}>The Old Crown · Bristol</MonoLine>
              <div style={{ fontWeight: 800, fontSize: 13.5, lineHeight: 1.12, marginTop: 2 }}>
                Free hot drink after 3 visits
              </div>
            </div>
          </div>
          <div style={{
            display: "inline-block", marginTop: 10, padding: 6, borderRadius: 8,
            border: `3px solid ${locked ? "var(--w-leaf)" : "transparent"}`,
            transition: `border-color ${180 * mo}ms`,
          }}>
            <QrBlock size={110} />
          </div>
          <MonoLine style={{ fontSize: 8.5, marginTop: 8 }}>Scan to join · no app, no plastic</MonoLine>
          {locked && (
            <div style={{
              position: "absolute", left: "50%", bottom: -14, transform: "translateX(-50%)",
              animation: `w-pop ${320 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
            }}>
              <MonoTag tone="accent">QR found</MonoTag>
            </div>
          )}
        </div>

        {/* status line */}
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center" }}>
          <MonoLine style={chrome}>
            {locked ? "nabaperks.app/q/oc-0248" : "Looking for a code… · tap to skip"}
          </MonoLine>
        </div>
      </div>
      <MonoLine style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
        Scans are rate-limited to 60 a minute — a busy counter is fine
      </MonoLine>
    </div>
  );
}

/* ---------- the customer flow ---------- */

function CustomerFlow({ t, go }) {
  const [cu, setCu] = useStateCu(() => ({ ...CU_FALLBACK, ...(cuLoadState() || {}) }));
  const { step, visits, saved, dayReady, stampedToday } = cu;
  const patch = (p) => setCu((s) => ({ ...s, ...p }));

  const [sheetOpen, setSheetOpen] = useStateCu(false);
  const [sheetPurpose, setSheetPurpose] = useStateCu("stamp"); // stamp | redeem
  const [slam, setSlam] = useStateCu(-1);
  const [shake, setShake] = useStateCu(false);
  const [phone, setPhone] = useStateCu("");
  const [otp, setOtp] = useStateCu("");
  const cuTimers = useRefCu([]);

  useEffectCu(() => {
    localStorage.setItem(CU_LS_KEY, JSON.stringify({ step, visits, saved, dayReady, stampedToday }));
  }, [cu]);

  // Clear any pending stamp-animation timers on unmount (surface switch).
  useEffectCu(() => () => {
    cuTimers.current.forEach(clearTimeout);
    cuTimers.current = [];
  }, []);

  const mo = t.mo;
  const cuDates = ["10 JUN", "11 JUN", "12 JUN"].slice(3 - Math.min(3, visits));

  const requestStamp = () => {
    if (stampedToday) { patch({ step: "alreadyStamped" }); return; }
    setSheetPurpose("stamp");
    setSheetOpen(true);
  };

  const doStamp = () => {
    setSheetOpen(false);
    const next = Math.min(3, visits + 1);
    setSlam(next - 1);
    setShake(true);
    patch({ visits: next, stampedToday: true });
    cuTimers.current.push(setTimeout(() => setShake(false), 360 * mo));
    cuTimers.current.push(setTimeout(() => setSlam(-1), 1400 * mo));
    if (step === "landing") cuTimers.current.push(setTimeout(() => patch({ step: "firstStamp" }), 950 * mo));
    else if (next >= 3) cuTimers.current.push(setTimeout(() => patch({ step: "sealed" }), 1100 * mo));
  };

  const doRedeem = () => {
    setSheetOpen(false);
    patch({ step: "redeemed" });
  };

  const reset = () => {
    cuTimers.current.forEach(clearTimeout);
    cuTimers.current = [];
    localStorage.removeItem(CU_LS_KEY);
    setCu({ ...CU_FALLBACK });
    setSheetOpen(false); setPhone(""); setOtp(""); setSlam(-1); setShake(false);
  };

  /* ---------- shared receipt body ---------- */
  const cardBody = (extra) => (
    <ReceiptCard shaking={shake} mo={mo}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <MonoLine>The Old Crown · Bristol</MonoLine>
          <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.12, marginTop: 5 }}>
            Free hot drink after 3 visits
          </div>
        </div>
        <VenueMark size={62} />
      </div>
      <ReceiptRule />
      <div style={{ position: "relative", padding: "8px 0 4px" }}>
        <StampRow current={visits} total={3} slamIndex={slam} celebration={t.celebration} mo={mo} dates={cuDates} />
      </div>
      <ReceiptRule />
      <ProgressLine current={visits} total={3} />
      {extra}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14 }}>
        <MonoLine style={{ fontSize: 10 }}>CARD Nº OC-0248</MonoLine>
        <MonoLine style={{ fontSize: 10 }}>{saved ? "SAVED TO 07123···89" : "UNSAVED · THIS BROWSER"}</MonoLine>
      </div>
    </ReceiptCard>
  );

  /* ---------- steps ---------- */

  let body = null;

  if (step === "scan") {
    body = <CuScanView mo={mo} onDone={() => patch({ step: "landing" })} />;
  }

  if (step === "landing") {
    body = (
      <div data-screen-label="Customer · Landing" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
          <MonoTag>Scanned at the counter</MonoTag>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, margin: "16px 0 10px" }}>
            Your first stamp is waiting.
          </h1>
          <p style={{ fontSize: 15.5, lineHeight: "23px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "30ch" }}>
            The Old Crown stamps this card every visit. Three visits unseal a mystery reward. No app — it lives right here.
          </p>
        </div>
        {cardBody(null)}
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <InkButton full onClick={requestStamp}>Collect my first stamp</InkButton>
          <MonoLine style={{ textAlign: "center", fontSize: 10 }}>No signup yet · takes ten seconds</MonoLine>
        </div>
      </div>
    );
  }

  if (step === "firstStamp") {
    body = (
      <div data-screen-label="Customer · First stamp">
        <div style={{ textAlign: "center", margin: "6px 0 22px", animation: `w-rise ${380 * mo}ms both` }}>
          <MonoTag tone="accent">Stamped</MonoTag>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, margin: "16px 0 10px" }}>That's one.</h1>
          <p style={{ fontSize: 15.5, lineHeight: "23px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "28ch" }}>
            Two more visits and the seal breaks. Keep the card so it survives a closed tab.
          </p>
        </div>
        {cardBody(null)}
        <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
          <InkButton full onClick={() => patch({ step: "save" })}>Keep my card</InkButton>
          <GhostLink onClick={() => patch({ step: "card" })}>Maybe later</GhostLink>
        </div>
      </div>
    );
  }

  if (step === "save") {
    body = (
      <div data-screen-label="Customer · Save card" style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 24px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08, margin: "10px 0" }}>Keep your card</h1>
          <p style={{ fontSize: 15, lineHeight: "22px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "30ch" }}>
            One text, no password. Your stamp is already on the card.
          </p>
        </div>
        <ReceiptCard mo={mo}>
          <MonoLine style={{ marginBottom: 8 }}>Mobile number</MonoLine>
          <input
            value={phone} inputMode="tel" placeholder="07123 456789"
            onChange={(e) => setPhone(e.target.value)}
            style={{
              width: "100%", padding: "14px 16px", fontSize: 18,
              fontFamily: "var(--w-mono)", color: "var(--w-ink)",
              background: "var(--w-paper)", border: "2px solid var(--w-ink)",
              borderRadius: "var(--w-r)", outline: "none",
            }} />
          <div style={{ marginTop: 14 }}>
            <InkButton full onClick={() => patch({ step: "otp" })}>Text me the code</InkButton>
          </div>
        </ReceiptCard>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <GhostLink onClick={() => patch({ step: "card" })}>Skip for now</GhostLink>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    const done = otp.length === 6;
    body = (
      <div data-screen-label="Customer · Verify code" style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 24px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0" }}>Enter the code</h1>
          <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
            Sent to {phone || "07123 456789"} · expires in 10 min
          </p>
        </div>
        <OtpBoxes value={otp} onChange={setOtp} />
        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          <InkButton full disabled={!done} onClick={() => patch({ saved: true, step: "card" })}>
            Save my card
          </InkButton>
          <div style={{ textAlign: "center" }}>
            <DemoTag onClick={() => setOtp("482915")}>Autofill code</DemoTag>
          </div>
          <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
            Texts are limited to five each quarter hour — plenty for one card
          </MonoLine>
        </div>
      </div>
    );
  }

  if (step === "card") {
    body = (
      <div data-screen-label="Customer · Card" style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "4px 0 18px" }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Your card</h1>
          <MonoTag tone={saved ? "ink" : "plain"}>{saved ? "Saved" : "Unsaved"}</MonoTag>
        </div>
        {cardBody(
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: "var(--w-r)",
            border: "2px dashed var(--w-line)", display: "flex", gap: 12, alignItems: "center",
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", background: "var(--w-sun)",
              border: "2px solid var(--w-ink)", display: "grid", placeItems: "center",
              fontWeight: 800, fontSize: 19, transform: "rotate(-6deg)", flexShrink: 0,
            }}>?</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Mystery reward, sealed</div>
              <div style={{ fontSize: 13, color: "var(--w-ink-soft)" }}>
                {3 - visits} more {3 - visits === 1 ? "visit" : "visits"} to break it open.
              </div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <InkButton full variant="dark" onClick={requestStamp}>
            I'm at the counter — stamp it
          </InkButton>
          {stampedToday && (
            <MonoLine style={{ textAlign: "center", fontSize: 10 }}>Today's stamp is on · one per day</MonoLine>
          )}
          {!saved && <GhostLink onClick={() => patch({ step: "save" })}>Save this card</GhostLink>}
          <div style={{ textAlign: "center" }}>
            <DemoTag onClick={() => go("Staff", "pin")}>See what staff see</DemoTag>
          </div>
        </div>
      </div>
    );
  }

  if (step === "alreadyStamped") {
    body = (
      <div data-screen-label="Customer · Already stamped" style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
          <MonoTag tone="ink">Today's done</MonoTag>
          <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.08, margin: "16px 0 10px" }}>
            One stamp a day keeps it fair.
          </h1>
          <p style={{ fontSize: 15, lineHeight: "22px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "30ch" }}>
            Today's stamp is already drying on your card. The next one's waiting whenever you're back.
          </p>
        </div>
        {cardBody(
          <div style={{
            marginTop: 14, padding: "12px 14px", borderRadius: "var(--w-r)",
            border: "2px dashed var(--w-line)",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
          }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14.5 }}>Next stamp</div>
              <div style={{ fontSize: 13, color: "var(--w-ink-soft)" }}>One per UK business day.</div>
            </div>
            <MonoTag>From 13 Jun</MonoTag>
          </div>
        )}
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <InkButton full variant="dark" onClick={() => patch({ step: "card" })}>Back to my card</InkButton>
          <div style={{ textAlign: "center" }}>
            <DemoTag onClick={() => patch({ stampedToday: false, step: "card" })}>Skip to tomorrow</DemoTag>
          </div>
        </div>
      </div>
    );
  }

  if (step === "sealed") {
    body = (
      <div data-screen-label="Customer · Sealed" style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
          <MonoTag tone="accent">Three visits</MonoTag>
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.06, margin: "16px 0 8px" }}>
            Something's under there.
          </h1>
          <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
            You've earned the mystery reward.
          </p>
        </div>
        <ReceiptCard mo={mo}>
          <div style={{ padding: "16px 0 10px" }}>
            <Seal mode={t.reveal} mo={mo} onBroken={() => patch({ step: "revealed" })} />
          </div>
          <ReceiptRule />
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <MonoLine style={{ fontSize: 10 }}>CARD Nº OC-0248</MonoLine>
            <MonoLine style={{ fontSize: 10 }}>SEALED 12 JUN</MonoLine>
          </div>
        </ReceiptCard>
      </div>
    );
  }

  if (step === "revealed" || step === "ready") {
    const isReady = step === "ready" || dayReady;
    body = (
      <div data-screen-label={isReady ? "Customer · Reward ready" : "Customer · Revealed"}
        style={{ animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`, position: "relative" }}>
        {step === "revealed" && <CelebrationBits type={t.celebration === "Ripple" ? "Ripple" : "Burst"} mo={mo} seed={9} />}
        <div style={{ textAlign: "center", margin: "6px 0 20px" }}>
          <MonoTag tone="accent">Unsealed</MonoTag>
          <h1 style={{ fontSize: 36, fontWeight: 800, lineHeight: 1.02, margin: "16px 0 8px" }}>
            Free flat white
          </h1>
          <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
            From the Old Crown, with thanks.
          </p>
        </div>
        <ReceiptCard mo={mo}>
          <div style={{ textAlign: "center", padding: "6px 0" }}>
            <VenueMark size={84} caption="Nº RW-8821" initials="✱" color={isReady ? "var(--w-leaf)" : "var(--w-ink-soft)"} />
            <ReceiptRule />
            {isReady ? (
              <div>
                <MonoTag tone="ink">Ready to redeem</MonoTag>
                <p style={{ fontSize: 14, color: "var(--w-ink-soft)", margin: "12px 0 0" }}>
                  Show this at the counter. Staff redeem it once with their PIN.
                </p>
              </div>
            ) : (
              <div>
                <MonoTag>Redeemable from tomorrow</MonoTag>
                <p style={{ fontSize: 14, color: "var(--w-ink-soft)", margin: "12px 0 0" }}>
                  Give it a day to breathe — it's yours from opening time tomorrow.
                </p>
              </div>
            )}
          </div>
        </ReceiptCard>
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          {isReady ? (
            <InkButton full onClick={() => { setSheetPurpose("redeem"); setSheetOpen(true); }}>
              Staff: redeem this reward
            </InkButton>
          ) : (
            <div style={{ textAlign: "center" }}>
              <DemoTag onClick={() => patch({ dayReady: true, stampedToday: false, step: "ready" })}>
                Skip to tomorrow
              </DemoTag>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "redeemed") {
    body = (
      <div data-screen-label="Customer · Redeemed" style={{ animation: `w-pop ${420 * mo}ms both`, textAlign: "center" }}>
        <div style={{ margin: "12px 0 20px" }}>
          <div style={{ display: "inline-block", animation: `w-slam ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` }}>
            <VenueMark size={110} initials="✓" caption="12 JUN 2026" color="var(--w-leaf)" angle={-6} />
          </div>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Enjoy.</h1>
        <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: "0 0 26px" }}>
          The card starts again — same deal, next visit.
        </p>
        <InkButton full variant="dark" onClick={() => patch({ visits: 0, dayReady: false, step: "card" })}>
          Back to my card
        </InkButton>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 410, margin: "0 auto", padding: "26px 20px 110px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>nabaperks</span>
        </div>
        <DemoTag onClick={reset}>Restart flow</DemoTag>
      </div>
      {body}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} mo={mo}>
        {sheetPurpose === "stamp" && t.verify === "GPS" ? (
          <GpsCheck venue="The Old Crown" mo={mo} onDone={doStamp} />
        ) : (
          <PinPad
            label={sheetPurpose === "stamp" ? "Staff: stamp this card" : "Staff: redeem reward"}
            sublabel={sheetPurpose === "stamp"
              ? "Customer hands the phone across the counter"
              : "One redemption — marked off for good"}
            onDone={sheetPurpose === "stamp" ? doStamp : doRedeem} />
        )}
      </Sheet>
    </div>
  );
}

/* ---------- exports ---------- */
Object.assign(window, {
  CustomerFlow,
  CustomerEntry: { lsKey: CU_LS_KEY, presets: CU_PRESETS },
});
