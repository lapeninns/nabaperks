// Nabaperks v2 Full Flow — app shell: surface switcher + journey nav + Tweaks wiring
const { useState: useStateSh, useEffect: useEffectSh } = React;

const V3_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "celebration": "Slam",
  "reveal": "Hold",
  "verify": "PIN",
  "mo": 1,
  "ink": "#E8430F",
  "grain": true
}/*EDITMODE-END*/;

const V3_SURFACES = ["Journey", "Marketing", "Merchant", "Customer", "Staff", "Admin"];

function V3App() {
  const [t, setTweak] = useTweaks(V3_TWEAK_DEFAULTS);
  const [surface, setSurfaceRaw] = useStateSh(() => {
    const s = localStorage.getItem("v3_surface");
    return V3_SURFACES.includes(s) ? s : "Journey";
  });

  useEffectSh(() => { localStorage.setItem("v3_surface", surface); }, [surface]);
  useEffectSh(() => {
    document.documentElement.style.setProperty("--w-accent", t.ink);
    document.body.dataset.grain = String(t.grain);
  }, [t.ink, t.grain]);

  // go("Customer", "sealed") — prime the target surface's state, then switch.
  const go = (target, preset) => {
    const entries = {
      Customer: window.CustomerEntry,
      Merchant: window.MerchantEntry,
      Staff: window.StaffEntry,
      Admin: window.AdminEntry,
      Marketing: window.MarketingEntry,
    };
    const entry = entries[target];
    if (entry && preset && entry.presets && entry.presets[preset]) {
      localStorage.setItem(entry.lsKey, JSON.stringify(entry.presets[preset]));
    }
    setSurfaceRaw(target);
    window.scrollTo(0, 0);
  };

  return (
    <div>
      {surface === "Journey" && <JourneyMap t={t} go={go} />}
      {surface === "Marketing" && <MarketingSite t={t} go={go} />}
      {surface === "Merchant" && <MerchantSurface t={t} go={go} />}
      {surface === "Customer" && <CustomerFlow t={t} go={go} />}
      {surface === "Staff" && <StaffSurface t={t} go={go} />}
      {surface === "Admin" && <AdminSurface t={t} go={go} />}

      {/* surface switcher — prototype chrome */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 50, display: "flex", gap: 3,
        maxWidth: "calc(100vw - 24px)", overflowX: "auto", WebkitOverflowScrolling: "touch",
        background: "var(--w-ink)", border: "2px solid var(--w-ink)",
        borderRadius: 999, padding: 4, boxShadow: "0 6px 24px rgba(33,28,22,0.35)",
      }}>
        {V3_SURFACES.map((s) => (
          <button key={s} onClick={() => { setSurfaceRaw(s); window.scrollTo(0, 0); }} style={{
            fontFamily: "var(--w-mono)", fontSize: 10.5, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "8px 13px", borderRadius: 999, border: "none", cursor: "pointer",
            background: surface === s ? "var(--w-paper)" : "transparent",
            color: surface === s ? "var(--w-ink)" : "rgba(246,241,230,0.6)",
            whiteSpace: "nowrap",
          }}>{s === "Journey" ? "✱ Journey" : s}</button>
        ))}
      </div>

      <TweaksPanel>
        <TweakSection label="Celebration" />
        <TweakRadio label="Stamp moment" value={t.celebration}
          options={["Slam", "Ripple", "Burst"]}
          onChange={(v) => setTweak("celebration", v)} />
        <TweakRadio label="Seal reveal" value={t.reveal}
          options={["Hold", "Tap"]}
          onChange={(v) => setTweak("reveal", v)} />
        <TweakRadio label="Counter check" value={t.verify}
          options={["PIN", "GPS"]}
          onChange={(v) => setTweak("verify", v)} />
        <TweakSlider label="Motion scale" value={t.mo} min={0.5} max={2} step={0.1}
          onChange={(v) => setTweak("mo", v)} />
        <TweakSection label="Ink" />
        <TweakColor label="Accent ink" value={t.ink}
          options={["#E8430F", "#2B43C8", "#1E8A4C"]}
          onChange={(v) => setTweak("ink", v)} />
        <TweakToggle label="Paper grain" value={t.grain}
          onChange={(v) => setTweak("grain", v)} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<V3App />);
