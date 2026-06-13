// Nabaperks v2 — app shell: surface switcher + Tweaks wiring
const { useState: useStateA, useEffect: useEffectA } = React;

const V2_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "celebration": "Slam",
  "reveal": "Hold",
  "mo": 1,
  "ink": "#E8430F",
  "grain": true
}/*EDITMODE-END*/;

function V2App() {
  const [t, setTweak] = useTweaks(V2_TWEAK_DEFAULTS);
  const [surface, setSurface] = useStateA(localStorage.getItem("v2_surface") || "Customer");

  useEffectA(() => { localStorage.setItem("v2_surface", surface); }, [surface]);
  useEffectA(() => {
    document.documentElement.style.setProperty("--w-accent", t.ink);
    document.body.dataset.grain = String(t.grain);
  }, [t.ink, t.grain]);

  const surfaces = ["Customer", "Merchant", "Marketing"];

  return (
    <div>
      {surface === "Customer" && <CustomerFlow t={t} />}
      {surface === "Merchant" && <MerchantApp t={t} />}
      {surface === "Marketing" && <MarketingSite t={t} />}

      {/* surface switcher — prototype chrome */}
      <div style={{
        position: "fixed", bottom: 16, left: "50%", transform: "translateX(-50%)",
        zIndex: 50, display: "flex", gap: 4,
        background: "var(--w-ink)", border: "2px solid var(--w-ink)",
        borderRadius: 999, padding: 4, boxShadow: "0 6px 24px rgba(33,28,22,0.35)",
      }}>
        {surfaces.map((s) => (
          <button key={s} onClick={() => setSurface(s)} style={{
            fontFamily: "var(--w-mono)", fontSize: 11.5, fontWeight: 700,
            textTransform: "uppercase", letterSpacing: "0.06em",
            padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer",
            background: surface === s ? "var(--w-paper)" : "transparent",
            color: surface === s ? "var(--w-ink)" : "rgba(246,241,230,0.6)",
          }}>{s}</button>
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

ReactDOM.createRoot(document.getElementById("root")).render(<V2App />);
