// Nabaperks v2 — Customer journey (the star of the redesign)
// scan → value first → stamp at the counter → THEN save the card → mystery reveal
const { useState: useStateC, useEffect: useEffectC } = React;

const C_LS_KEY = "v2_customer_state_v1";

function loadCState() {
  try { return JSON.parse(localStorage.getItem(C_LS_KEY)) || null; } catch (e) { return null; }
}

function CustomerFlow({ t, fixedStep }) {
  const init = fixedStep
    ? { step: fixedStep, visits: fixedStep === "card" ? 2 : 0, saved: true, dayReady: false }
    : (loadCState() || { step: "landing", visits: 0, saved: false, dayReady: false });
  const [step, setStep] = useStateC(init.step);
  const [visits, setVisits] = useStateC(init.visits);
  const [saved, setSaved] = useStateC(init.saved);
  const [dayReady, setDayReady] = useStateC(init.dayReady);
  const [pinOpen, setPinOpen] = useStateC(false);
  const [pinPurpose, setPinPurpose] = useStateC("stamp"); // stamp | redeem
  const [slam, setSlam] = useStateC(-1);
  const [shake, setShake] = useStateC(false);
  const [phone, setPhone] = useStateC("");
  const [otp, setOtp] = useStateC("");

  useEffectC(() => {
    if (fixedStep) return;
    localStorage.setItem(C_LS_KEY, JSON.stringify({ step, visits, saved, dayReady }));
  }, [step, visits, saved, dayReady]);

  const mo = t.mo;

  const doStamp = () => {
    setPinOpen(false);
    const next = visits + 1;
    setVisits(next);
    setSlam(next - 1);
    setShake(true);
    setTimeout(() => setShake(false), 360 * mo);
    setTimeout(() => setSlam(-1), 1400 * mo);
    if (step === "landing") setTimeout(() => setStep("firstStamp"), 950 * mo);
    if (next >= 3) setTimeout(() => setStep("sealed"), 1100 * mo);
  };

  const doRedeem = () => {
    setPinOpen(false);
    setStep("redeemed");
  };

  const reset = () => {
    localStorage.removeItem(C_LS_KEY);
    setStep("landing"); setVisits(0); setSaved(false); setDayReady(false);
    setPhone(""); setOtp(""); setSlam(-1);
  };

  const dates = ["TODAY", "TODAY", "TODAY"];

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
        <StampRow current={visits} total={3} slamIndex={slam} celebration={t.celebration} mo={mo} dates={dates} />
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

  if (step === "landing") {
    body = (
      <div style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
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
          <InkButton full onClick={() => { setPinPurpose("stamp"); setPinOpen(true); }}>
            Collect my first stamp
          </InkButton>
          <MonoLine style={{ textAlign: "center", fontSize: 10 }}>No signup yet · takes ten seconds</MonoLine>
        </div>
      </div>
    );
  }

  if (step === "firstStamp") {
    body = (
      <div>
        <div style={{ textAlign: "center", margin: "6px 0 22px", animation: `w-rise ${380 * mo}ms both` }}>
          <MonoTag tone="accent">Stamped</MonoTag>
          <h1 style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.05, margin: "16px 0 10px" }}>That's one.</h1>
          <p style={{ fontSize: 15.5, lineHeight: "23px", color: "var(--w-ink-soft)", margin: "0 auto", maxWidth: "28ch" }}>
            Two more visits and the seal breaks. Keep the card so it survives a closed tab.
          </p>
        </div>
        {cardBody(null)}
        <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
          <InkButton full onClick={() => setStep("save")}>Keep my card</InkButton>
          <GhostLink onClick={() => setStep("card")}>Maybe later</GhostLink>
        </div>
      </div>
    );
  }

  if (step === "save") {
    body = (
      <div style={{ animation: `w-rise ${380 * mo}ms both` }}>
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
            <InkButton full onClick={() => setStep("otp")}>Text me the code</InkButton>
          </div>
        </ReceiptCard>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <GhostLink onClick={() => setStep("card")}>Skip for now</GhostLink>
        </div>
      </div>
    );
  }

  if (step === "otp") {
    const done = otp.length === 6;
    body = (
      <div style={{ animation: `w-rise ${380 * mo}ms both` }}>
        <div style={{ textAlign: "center", margin: "6px 0 24px" }}>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0" }}>Enter the code</h1>
          <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
            Sent to {phone || "07123 456789"} · expires in 10 min
          </p>
        </div>
        <OtpBoxes value={otp} onChange={setOtp} />
        <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
          <InkButton full disabled={!done} onClick={() => { setSaved(true); setStep("card"); }}>
            Save my card
          </InkButton>
          <div style={{ textAlign: "center" }}>
            <DemoTag onClick={() => setOtp("482915")}>Autofill code</DemoTag>
          </div>
        </div>
      </div>
    );
  }

  if (step === "card") {
    body = (
      <div style={{ animation: `w-rise ${380 * mo}ms both` }}>
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
              <div style={{ fontSize: 13, color: "var(--w-ink-soft)" }}>{3 - visits} more {3 - visits === 1 ? "visit" : "visits"} to break it open.</div>
            </div>
          </div>
        )}
        <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
          <InkButton full variant="dark" onClick={() => { setPinPurpose("stamp"); setPinOpen(true); }}>
            I'm at the counter — stamp it
          </InkButton>
          {!saved && <GhostLink onClick={() => setStep("save")}>Save this card</GhostLink>}
        </div>
      </div>
    );
  }

  if (step === "sealed") {
    body = (
      <div style={{ animation: `w-rise ${380 * mo}ms both` }}>
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
            <Seal mode={t.reveal} mo={mo} onBroken={() => setStep("revealed")} />
          </div>
        </ReceiptCard>
      </div>
    );
  }

  if (step === "revealed" || step === "ready") {
    const isReady = step === "ready" || dayReady;
    body = (
      <div style={{ animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`, position: "relative" }}>
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
            <InkButton full onClick={() => { setPinPurpose("redeem"); setPinOpen(true); }}>
              Staff: redeem this reward
            </InkButton>
          ) : (
            <div style={{ textAlign: "center" }}>
              <DemoTag onClick={() => { setDayReady(true); setStep("ready"); }}>Skip to tomorrow</DemoTag>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (step === "redeemed") {
    body = (
      <div style={{ animation: `w-pop ${420 * mo}ms both`, textAlign: "center" }}>
        <div style={{ margin: "12px 0 20px" }}>
          <div style={{ display: "inline-block", animation: `w-slam ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` }}>
            <VenueMark size={110} initials="✓" caption="12 JUN 2026" color="var(--w-leaf)" angle={-6} />
          </div>
        </div>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>Enjoy.</h1>
        <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: "0 0 26px" }}>
          The card starts again — same deal, next visit.
        </p>
        <InkButton full variant="dark" onClick={() => { setVisits(0); setDayReady(false); setStep("card"); }}>
          Back to my card
        </InkButton>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 410, margin: "0 auto", padding: "26px 20px 90px", minHeight: "100vh" }} data-screen-label="Customer flow">
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
      <Sheet open={pinOpen} onClose={() => setPinOpen(false)} mo={mo}>
        <PinPad
          label={pinPurpose === "stamp" ? "Staff: stamp this card" : "Staff: redeem reward"}
          sublabel="Customer hands the phone across the counter"
          onDone={pinPurpose === "stamp" ? doStamp : doRedeem} />
      </Sheet>
    </div>
  );
}

window.CustomerFlow = CustomerFlow;
