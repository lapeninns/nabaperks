// Nabaperks v3 "Wet Ink" — Staff counter station
// Mobile-first, mostly dark: the tab that stays pinned by the till all day.
// States: idle (counter mode) → pin (customer hands phone over) → success | locked.
const { useState: useStateSt, useEffect: useEffectSt, useRef: useRefSt } = React;

const ST_LS = "v3_staff";

const ST_DEF = {
  mode: "idle",
  stampsToday: 14,
  attempts: 0,
  lockLeft: 600,
  last: { who: "ASHA K.", at: "11:41", note: "STAMP 3/3" },
};

const ST_PRESETS = {
  idle: { ...ST_DEF },
  pin: { ...ST_DEF, mode: "pin" },
  success: {
    ...ST_DEF, mode: "success", stampsToday: 15,
    last: { who: "ASHA K.", at: "JUST NOW", note: "STAMP 3/3" },
  },
  locked: { ...ST_DEF, mode: "locked", attempts: 3 },
};

function StLoad() {
  try {
    const raw = JSON.parse(localStorage.getItem(ST_LS));
    return raw && raw.mode ? { ...ST_DEF, ...raw } : { ...ST_DEF };
  } catch (e) { return { ...ST_DEF }; }
}

const StClock = (s) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

// paper-on-ink tones for the dark panels
const ST_DIM = "rgba(246,241,230,0.55)";
const ST_MID = "rgba(246,241,230,0.74)";

/* ---------- dark ink panel ---------- */

function StPanel({ children, style }) {
  return (
    <div style={{
      background: "var(--w-ink)", color: "var(--w-paper)",
      border: "2px solid var(--w-ink)", borderRadius: 16,
      padding: "26px 22px", ...style,
    }}>{children}</div>
  );
}

/* ---------- today's PIN, masked · hold to peek ---------- */

function StPinPeek() {
  const [peek, setPeek] = useStateSt(false);
  return (
    <StPanel style={{ padding: "18px 20px", marginTop: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14 }}>
        <div>
          <MonoLine style={{ color: ST_DIM }}>Today's PIN</MonoLine>
          <div
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            style={{
              fontFamily: "var(--w-mono)", fontSize: 31, fontWeight: 700,
              letterSpacing: "0.32em", margin: "8px 0 4px",
              cursor: "pointer", userSelect: "none", touchAction: "none",
              color: peek ? "var(--w-sun)" : "var(--w-paper)",
              transition: "color 120ms",
            }}>
            {peek ? "7312" : "●●●●"}
          </div>
          <MonoLine style={{ fontSize: 10, color: ST_DIM }}>
            {peek ? "Keep it off the till roll" : "Hold to peek · rotates nightly at 04:00"}
          </MonoLine>
        </div>
        <VenueMark size={62} caption="STAFF ONLY" color={peek ? "var(--w-sun)" : ST_DIM} />
      </div>
    </StPanel>
  );
}

/* ---------- card context strip (whose phone is this?) ---------- */

function StCardStrip() {
  return (
    <StPanel style={{ padding: "15px 18px", display: "flex", alignItems: "center", gap: 14 }}>
      <VenueMark size={48} color="var(--w-paper)" angle={-6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MonoLine style={{ fontSize: 10, color: ST_DIM }}>Card Nº OC-0248</MonoLine>
        <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.1, marginTop: 3 }}>Asha K.</div>
      </div>
      <MonoTag tone="accent">Stamp 2 of 3</MonoTag>
    </StPanel>
  );
}

/* ---------- surface ---------- */

function StaffSurface({ t, go }) {
  const mo = t.mo;
  const [st, setSt] = useStateSt(StLoad);
  const [shake, setShake] = useStateSt(false);
  const [leftMs, setLeftMs] = useStateSt(2200 * mo);
  const stTimers = useRefSt([]);
  const fumbling = useRefSt(false);

  const up = (patch) => setSt((s) => ({ ...s, ...patch }));

  useEffectSt(() => { localStorage.setItem(ST_LS, JSON.stringify(st)); }, [st]);

  // locked: a real ten-minute clock, ticking once a second
  useEffectSt(() => {
    if (st.mode !== "locked") return;
    const id = setInterval(() => {
      setSt((s) => s.lockLeft <= 1
        ? { ...s, mode: "idle", attempts: 0, lockLeft: 600 }
        : { ...s, lockLeft: s.lockLeft - 1 });
    }, 1000);
    return () => clearInterval(id);
  }, [st.mode]);

  // success: slam, then hand the station back to the counter
  useEffectSt(() => {
    if (st.mode !== "success") return;
    const total = 2200 * mo;
    const t0 = Date.now();
    setLeftMs(total);
    const id = setInterval(() => {
      const rem = total - (Date.now() - t0);
      if (rem <= 0) setSt((s) => (s.mode === "success" ? { ...s, mode: "idle" } : s));
      else setLeftMs(rem);
    }, 90);
    return () => clearInterval(id);
  }, [st.mode]);

  useEffectSt(() => () => stTimers.current.forEach(clearTimeout), []);

  const stamped = () => {
    if (fumbling.current) return;
    setSt((s) => ({
      ...s, mode: "success", attempts: 0,
      stampsToday: s.stampsToday + 1,
      last: { who: "ASHA K.", at: "JUST NOW", note: "STAMP 3/3" },
    }));
  };

  const fumble = () => {
    if (fumbling.current) return;
    fumbling.current = true;
    const hit = (n) => {
      up({ attempts: n });
      setShake(true);
      stTimers.current.push(setTimeout(() => setShake(false), 320 * mo));
      if (n < 3) stTimers.current.push(setTimeout(() => hit(n + 1), 560 * mo));
      else stTimers.current.push(setTimeout(() => {
        fumbling.current = false;
        up({ mode: "locked", lockLeft: 600 });
      }, 560 * mo));
    };
    hit(1);
  };

  const reset = () => {
    localStorage.removeItem(ST_LS);
    stTimers.current.forEach(clearTimeout);
    fumbling.current = false;
    setShake(false);
    setSt({ ...ST_DEF });
  };

  const rise = `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`;
  let body = null;

  /* ---------- idle: counter mode ---------- */
  if (st.mode === "idle") {
    body = (
      <div data-screen-label="Staff · Counter idle" style={{ animation: rise }}>
        <StPanel style={{ textAlign: "center", padding: "28px 24px 26px" }}>
          <MonoLine style={{ color: ST_DIM }}>Counter mode · pin this tab</MonoLine>
          <MonoLine style={{ color: ST_DIM, marginTop: 20, fontSize: 12 }}>Stamps today</MonoLine>
          <div style={{ fontFamily: "var(--w-display)", fontSize: 104, fontWeight: 800, lineHeight: 1 }}>
            {st.stampsToday}
          </div>
          <div style={{
            display: "inline-flex", gap: 10, alignItems: "center", margin: "20px 0 4px",
            border: "2px solid rgba(246,241,230,0.3)", borderRadius: 999, padding: "8px 16px",
            maxWidth: "100%",
          }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--w-leaf)", flexShrink: 0 }}></span>
            <span style={{ fontFamily: "var(--w-mono)", fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              LAST: {st.last.who} · {st.last.at} · {st.last.note}
            </span>
          </div>
          <p style={{ fontSize: 14.5, color: ST_MID, maxWidth: "34ch", margin: "12px auto 0", lineHeight: "21px" }}>
            Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job.
          </p>
        </StPanel>
        <StPinPeek />
        <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
          <InkButton full onClick={() => up({ mode: "pin", attempts: 0 })}>
            Customer handed you a phone?
          </InkButton>
          <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
            Thu 12 Jun · QR scans breathe at 60 a minute — plenty for a queue
          </MonoLine>
        </div>
      </div>
    );
  }

  /* ---------- pin: the handed-over phone ---------- */
  if (st.mode === "pin") {
    const triesLeft = 3 - st.attempts;
    body = (
      <div data-screen-label="Staff · PIN entry" style={{ animation: rise }}>
        <StCardStrip />
        <div style={{ marginTop: 16 }}>
          <ReceiptCard shaking={shake} mo={mo}>
            <PinPad
              label="Staff PIN"
              sublabel="Check the purchase, then stamp the visit"
              onDone={stamped}
            />
            <ReceiptRule />
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8 }}>
              {[0, 1, 2].map((i) => (
                <span key={i} style={{
                  width: 10, height: 10, borderRadius: "50%",
                  border: "2px solid var(--w-ink)",
                  background: i < st.attempts ? "var(--w-accent)" : "transparent",
                  transition: "background 120ms",
                }}></span>
              ))}
              <MonoLine style={{ fontSize: 10, marginLeft: 6 }}>
                {st.attempts === 0
                  ? "Three misses locks the pad for 10 min"
                  : `${triesLeft} ${triesLeft === 1 ? "try" : "tries"} left before lockout`}
              </MonoLine>
            </div>
          </ReceiptCard>
        </div>
        <div style={{ marginTop: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <GhostLink onClick={() => up({ mode: "idle", attempts: 0 })}>Back to counter</GhostLink>
          <DemoTag onClick={fumble}>Fumble the PIN ×3</DemoTag>
        </div>
      </div>
    );
  }

  /* ---------- success: stamped, hand it back ---------- */
  if (st.mode === "success") {
    body = (
      <div data-screen-label="Staff · Stamped" style={{ animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` }}>
        <StPanel style={{ textAlign: "center", padding: "38px 24px 30px" }}>
          <div style={{
            position: "relative", display: "inline-block",
            animation: `w-slam ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
          }}>
            <VenueMark size={116} initials="✓" caption="12 JUN · 3/3" color="var(--w-leaf)" angle={-6} />
            <CelebrationBits type={t.celebration} mo={mo} seed={7} />
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, lineHeight: 1.05, margin: "22px 0 8px" }}>
            Stamped. Hand it back.
          </h1>
          <p style={{ fontSize: 14.5, color: ST_MID, margin: "0 auto", maxWidth: "30ch", lineHeight: "21px" }}>
            That's Asha's third visit — the seal is breaking on her screen right now.
          </p>
          <MonoLine style={{ color: ST_DIM, marginTop: 22 }}>
            Back to the counter in {(Math.max(0, leftMs) / 1000).toFixed(1)}s
          </MonoLine>
        </StPanel>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <GhostLink onClick={() => go("Customer", "card")}>See the customer's card</GhostLink>
        </div>
      </div>
    );
  }

  /* ---------- locked: three misses, ten calm minutes ---------- */
  if (st.mode === "locked") {
    body = (
      <div data-screen-label="Staff · Locked out" style={{ animation: rise }}>
        <StPanel style={{ textAlign: "center", padding: "34px 24px 30px" }}>
          <MonoTag tone="accent">PIN pad locked</MonoTag>
          <div style={{
            fontFamily: "var(--w-mono)", fontSize: 82, fontWeight: 700,
            lineHeight: 1, letterSpacing: "0.04em", margin: "26px 0 8px",
            fontVariantNumeric: "tabular-nums",
          }}>
            {StClock(st.lockLeft)}
          </div>
          <MonoLine style={{ color: ST_DIM }}>Three wrong tries · counts down on its own</MonoLine>
          <p style={{ fontSize: 14.5, color: ST_MID, maxWidth: "32ch", margin: "18px auto 0", lineHeight: "21px" }}>
            Take a breath — it unlocks itself. The customer's stamp will keep; nothing is lost.
          </p>
        </StPanel>
        <div style={{ marginTop: 16, display: "grid", gap: 10, justifyItems: "center" }}>
          <DemoTag onClick={() => up({ mode: "idle", attempts: 0, lockLeft: 600 })}>Skip the wait</DemoTag>
          <MonoLine style={{ fontSize: 10, textAlign: "center" }}>
            Maya can reveal today's PIN from the merchant app
          </MonoLine>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 430, margin: "0 auto", padding: "26px 20px 110px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span style={{
            width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)",
          }}>✱</span>
          <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>nabaperks</span>
          <MonoTag style={{ marginLeft: 4 }}>Staff · The Old Crown</MonoTag>
        </div>
        <DemoTag onClick={reset}>Restart flow</DemoTag>
      </div>
      {body}
    </div>
  );
}

/* ---------- exports ---------- */
Object.assign(window, {
  StaffSurface,
  StaffEntry: { lsKey: ST_LS, presets: ST_PRESETS },
});
