// Nabaperks v2 "Wet Ink" — Merchant ops screens (Activity · Customers · QR studio · Settings · Billing)
// Rendered inside MerchantSurface (20-merchant-core). Each receives ({ t, go }).
const { useState: useStateMo, useEffect: useEffectMo } = React;

/* ================================================================
   Shared Mo helpers
   ================================================================ */

function MoHead({ title, sub, right }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 16, flexWrap: "wrap", marginBottom: 20 }}>
      <div>
        <h2 style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.05, margin: 0 }}>{title}</h2>
        {sub && <MonoLine style={{ marginTop: 7 }}>{sub}</MonoLine>}
      </div>
      {right}
    </div>
  );
}

function MoChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700,
      textTransform: "uppercase", letterSpacing: "0.07em",
      padding: "7px 14px", borderRadius: 999, cursor: "pointer",
      border: active ? "2px solid var(--w-ink)" : "2px solid var(--w-line)",
      background: active ? "var(--w-ink)" : "transparent",
      color: active ? "var(--w-paper)" : "var(--w-ink-soft)",
      whiteSpace: "nowrap",
    }}>{children}</button>
  );
}

function MoToggle({ on, onClick, mo = 1 }) {
  return (
    <button onClick={onClick} aria-pressed={on} style={{
      width: 60, height: 32, borderRadius: 999, border: "2px solid var(--w-ink)",
      background: on ? "var(--w-leaf)" : "var(--w-paper-2)", cursor: "pointer",
      position: "relative", padding: 0, boxShadow: "var(--w-shadow-sm)", flexShrink: 0,
    }}>
      <span style={{
        position: "absolute", top: 2, left: 2,
        width: 24, height: 24, borderRadius: "50%",
        background: "var(--w-card)", border: "2px solid var(--w-ink)",
        transform: on ? "translateX(28px)" : "translateX(0)",
        transition: `transform ${170 * mo}ms cubic-bezier(0.2,0,0,1)`,
        display: "block", boxSizing: "border-box",
      }}></span>
    </button>
  );
}

function MoMiniStamps({ current, total = 3 }) {
  return (
    <div style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        i < current ? (
          <span key={i} style={{
            width: 18, height: 18, borderRadius: "50%", background: "var(--w-accent)",
            border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center",
            color: "#fff", fontSize: 9, fontWeight: 800, transform: "rotate(-6deg)",
          }}>✱</span>
        ) : (
          <span key={i} style={{ width: 18, height: 18, borderRadius: "50%", border: "2px dashed var(--w-line)", display: "inline-block" }}></span>
        )
      ))}
      <span style={{ fontFamily: "var(--w-mono)", fontSize: 11.5, fontWeight: 700, marginLeft: 4 }}>{current}/{total}</span>
    </div>
  );
}

function MoField({ label, value, onChange, prefix }) {
  return (
    <div>
      <MonoLine style={{ marginBottom: 7 }}>{label}</MonoLine>
      <div style={{ display: "flex", alignItems: "stretch" }}>
        {prefix && (
          <span style={{
            display: "inline-flex", alignItems: "center", padding: "0 10px",
            fontFamily: "var(--w-mono)", fontSize: 12.5, color: "var(--w-ink-soft)",
            border: "2px solid var(--w-ink)", borderRight: "none",
            borderRadius: "var(--w-r) 0 0 var(--w-r)", background: "var(--w-paper-2)", whiteSpace: "nowrap",
          }}>{prefix}</span>
        )}
        <input value={value} onChange={(e) => onChange(e.target.value)} style={{
          width: "100%", padding: "12px 14px", fontSize: 16, fontFamily: "var(--w-mono)",
          color: "var(--w-ink)", background: "var(--w-paper)", border: "2px solid var(--w-ink)",
          borderRadius: prefix ? "0 var(--w-r) var(--w-r) 0" : "var(--w-r)", outline: "none",
        }} />
      </div>
    </div>
  );
}

/* ================================================================
   Activity feed
   ================================================================ */

const MO_DOT = {
  stamp: "var(--w-accent)", reward: "var(--w-sun)", join: "var(--w-cobalt)",
  redeem: "var(--w-leaf)", system: "var(--w-ink-soft)",
};

const MO_FILTERS = [
  { id: "all", label: "All" }, { id: "stamp", label: "Stamps" }, { id: "reward", label: "Rewards" },
  { id: "join", label: "Joins" }, { id: "redeem", label: "Redemptions" }, { id: "system", label: "System" },
];

const MO_EVENTS = [
  {
    day: "Today · Thu 12 Jun", items: [
      { cat: "reward", time: "11:42", text: "Mystery reward unsealed for Asha K.", sub: "Free flat white drawn from the pool · Nº RW-8821 · redeemable from tomorrow" },
      { cat: "stamp", time: "11:41", text: "Asha K. collected stamp 3 of 3", sub: "Card Nº OC-0248 · approved with the staff PIN" },
      { cat: "stamp", time: "10:18", text: "Tom R. collected stamp 2 of 3", sub: "Approved by Jordan at the counter" },
      { cat: "join", time: "09:51", text: "Priya S. joined from the counter QR", sub: "First stamp collected on the spot · card saved by text" },
      { cat: "system", time: "04:00", text: "Staff PIN rotated overnight", sub: "Yesterday's PIN retired · today's lives in Settings" },
    ],
  },
  {
    day: "Yesterday · Wed 11 Jun", items: [
      { cat: "redeem", time: "16:24", text: "Dan W. redeemed Slice of cake", sub: "Nº RW-8794 · approved by Maya · his card starts a fresh cycle" },
      { cat: "system", time: "11:05", text: "Counter poster downloaded", sub: "A4 print PDF · same permanent code as every reprint" },
      { cat: "stamp", time: "09:12", text: "Asha K. collected stamp 2 of 3", sub: "Morning visit · approved by Maya" },
    ],
  },
  {
    day: "Earlier this week", items: [
      { cat: "stamp", time: "Tue 17:31", text: "R. O. collected stamp 2 of 3", sub: "Initials only — full details stay with the account owner" },
      { cat: "stamp", time: "Mon 09:02", text: "Tom R. collected stamp 1 of 3", sub: "First stamp, one minute after joining" },
      { cat: "join", time: "Mon 08:55", text: "Tom R. joined from the counter QR", sub: "Morning rush · joined before his coffee cooled" },
      { cat: "system", time: "Mon 07:48", text: "Card design saved", sub: "Free hot drink after 3 visits · live at the counter" },
      { cat: "system", time: "Mon 07:30", text: "Billing updated", sub: "Growth pilot · day 19 of 30 at the time" },
    ],
  },
];

const MO_SIM = [
  { cat: "stamp", time: "Now", text: "Dan W. collected stamp 1 of 3", sub: "Fresh cycle after yesterday's slice of cake" },
  { cat: "join", time: "Now", text: "New member joined from the counter QR", sub: "Initials pending · they're saving their card" },
  { cat: "redeem", time: "Now", text: "R. O. redeemed 20% off next visit", sub: "Approved by Jordan · cycle restarted" },
];

function MoEventRow({ ev, first, mo, live }) {
  return (
    <div style={{
      display: "grid", gridTemplateColumns: "14px 1fr auto", gap: 13, alignItems: "start",
      padding: "11px 0 10px", borderTop: first ? "none" : "2px dashed var(--w-line)",
      animation: live ? `w-rise ${340 * mo}ms cubic-bezier(0.2,0,0,1) both` : "none",
    }}>
      <span style={{
        width: 11, height: 11, borderRadius: "50%", marginTop: 5,
        background: MO_DOT[ev.cat], border: "1.5px solid var(--w-ink)",
      }}></span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25 }}>{ev.text}</div>
        <div style={{ fontSize: 12.5, color: "var(--w-ink-soft)", marginTop: 2 }}>{ev.sub}</div>
      </div>
      <span style={{ fontFamily: "var(--w-mono)", fontSize: 11.5, color: "var(--w-ink-soft)", marginTop: 2, whiteSpace: "nowrap" }}>{ev.time}</span>
    </div>
  );
}

function MerchantActivity({ t, go }) {
  const mo = t.mo;
  const [filter, setFilter] = useStateMo("all");
  const [live, setLive] = useStateMo([]);

  const groups = MO_EVENTS.map((g, gi) => ({
    ...g,
    items: gi === 0 ? [...live, ...g.items] : g.items,
  })).map((g) => ({
    ...g,
    items: g.items.filter((ev) => filter === "all" || ev.cat === filter),
  })).filter((g) => g.items.length > 0);

  const total = MO_EVENTS.reduce((n, g) => n + g.items.length, 0) + live.length;

  return (
    <div data-screen-label="Merchant · Activity" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <MoHead
        title="Activity"
        sub={`This week at the counter · ${total} events`}
        right={<DemoTag onClick={() => setLive((l) => [{ ...MO_SIM[l.length % MO_SIM.length], live: true }, ...l])}>Simulate a live event</DemoTag>}
      />
      <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 20 }}>
        {MO_FILTERS.map((f) => (
          <MoChip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>{f.label}</MoChip>
        ))}
      </div>
      <div style={{ display: "grid", gap: 22, maxWidth: 720 }}>
        {groups.map((g) => (
          <ReceiptCard key={g.day} mo={mo}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <MonoLine style={{ fontWeight: 700, color: "var(--w-ink)" }}>{g.day}</MonoLine>
              <MonoLine style={{ fontSize: 10 }}>{g.items.length} {g.items.length === 1 ? "event" : "events"}</MonoLine>
            </div>
            <div style={{ marginTop: 8 }}>
              {g.items.map((ev, i) => (
                <MoEventRow key={g.day + i + ev.text} ev={ev} first={i === 0} mo={mo} live={ev.live} />
              ))}
            </div>
          </ReceiptCard>
        ))}
        {groups.length === 0 && (
          <div style={{ border: "2px dashed var(--w-line)", borderRadius: "var(--w-r)", padding: "26px 22px", textAlign: "center" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>Nothing in this lane yet.</div>
            <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 4 }}>It fills up as the counter hums.</div>
          </div>
        )}
        <MonoLine style={{ fontSize: 10, textAlign: "center" }}>Events keep for 12 months · customers appear as initials beyond your own till</MonoLine>
      </div>
    </div>
  );
}

/* ================================================================
   Customers — privacy-first readback
   ================================================================ */

const MO_CUSTOMERS = [
  { name: "Asha K.", phone: "07··· ···48", joined: "27 May", stamps: 3, visit: "Today 11:42", state: "Reward ready", tone: "accent" },
  { name: "Priya S.", phone: "07··· ···21", joined: "Today", stamps: 1, visit: "Today 09:51", state: "New today", tone: "ink" },
  { name: "Tom R.", phone: "07··· ···89", joined: "8 Jun", stamps: 2, visit: "Today 10:18", state: "Collecting", tone: "plain" },
  { name: "Dan W.", phone: "07··· ···52", joined: "14 May", stamps: 0, visit: "Yesterday", state: "Redeemed 11 Jun", tone: "plain" },
  { name: "R. O.", phone: "07··· ···34", joined: "30 May", stamps: 2, visit: "Tue 9 Jun", state: "Collecting", tone: "plain" },
  { name: "S. B.", phone: "07··· ···17", joined: "2 Jun", stamps: 1, visit: "Mon 8 Jun", state: "Collecting", tone: "plain" },
  { name: "J. P.", phone: "07··· ···73", joined: "19 May", stamps: 1, visit: "21 May", state: "Gone quiet", tone: "plain" },
];

function MerchantCustomers({ t, go }) {
  const mo = t.mo;
  const cols = "minmax(170px, 1.5fr) 80px minmax(120px, 1fr) minmax(105px, 1fr) minmax(125px, 1fr)";
  return (
    <div data-screen-label="Merchant · Customers" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <MoHead
        title="Customers"
        sub="7 members · readback only"
        right={<MonoTag tone="plain">Initials only · phones stay hashed</MonoTag>}
      />
      <ReceiptCard mo={mo} style={{ maxWidth: 860 }}>
        <div style={{ display: "grid", gridTemplateColumns: cols, gap: 12, paddingBottom: 9 }}>
          {["Member", "Joined", "Stamps", "Last visit", "Reward"].map((h) => (
            <MonoLine key={h} style={{ fontSize: 10, fontWeight: 700 }}>{h}</MonoLine>
          ))}
        </div>
        {MO_CUSTOMERS.map((c) => (
          <div key={c.name} style={{
            display: "grid", gridTemplateColumns: cols, gap: 12, alignItems: "center",
            padding: "11px 0", borderTop: "2px dashed var(--w-line)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <span style={{
                width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                background: "var(--w-paper-2)", border: "2px solid var(--w-ink)",
                display: "inline-grid", placeItems: "center", transform: "rotate(-6deg)",
                fontFamily: "var(--w-mono)", fontSize: 10.5, fontWeight: 700,
              }}>{c.name.split(" ").map((w) => w[0]).join("").replace(/\./g, "")}</span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap" }}>{c.name}</div>
                <div style={{ fontFamily: "var(--w-mono)", fontSize: 10, color: "var(--w-ink-soft)" }}>{c.phone}</div>
              </div>
            </div>
            <span style={{ fontFamily: "var(--w-mono)", fontSize: 12 }}>{c.joined}</span>
            <MoMiniStamps current={c.stamps} />
            <span style={{ fontFamily: "var(--w-mono)", fontSize: 12, color: c.visit.startsWith("Today") ? "var(--w-ink)" : "var(--w-ink-soft)" }}>{c.visit}</span>
            <div><MonoTag tone={c.tone} style={{ fontSize: 9.5 }}>{c.state}</MonoTag></div>
          </div>
        ))}
      </ReceiptCard>
      <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 16, flexWrap: "wrap" }}>
        <MonoLine style={{ fontSize: 10 }}>No marketing without a separate opt-in · exports live with the account owner</MonoLine>
        <DemoTag onClick={() => go("Customer", "ready")}>Open Asha's card as the customer</DemoTag>
      </div>
    </div>
  );
}

/* ================================================================
   QR studio — print assets, one permanent code
   ================================================================ */

function MoPosterPreview() {
  return (
    <div style={{
      aspectRatio: "3 / 4", background: "var(--w-card)", border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)", boxShadow: "var(--w-shadow)", transform: "rotate(-2deg)",
      padding: "16px 14px", display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "space-between", textAlign: "center", overflow: "hidden",
    }}>
      <div>
        <MonoLine style={{ fontSize: 9 }}>The Old Crown · Bristol</MonoLine>
        <div style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.05, marginTop: 6 }}>Stamp your visit.</div>
      </div>
      <QrBlock size={92} />
      <div>
        <MonoLine style={{ fontSize: 8.5, fontWeight: 700, color: "var(--w-ink)" }}>Free hot drink after 3 visits</MonoLine>
        <div style={{ display: "flex", justifyContent: "center", marginTop: 7 }}><VenueMark size={34} angle={-8} /></div>
      </div>
    </div>
  );
}

function MoTillPreview() {
  return (
    <div style={{
      aspectRatio: "5 / 3", background: "var(--w-card)", border: "2px solid var(--w-ink)",
      borderRadius: "var(--w-r)", boxShadow: "var(--w-shadow)", transform: "rotate(1.5deg)",
      padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, overflow: "hidden",
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <MonoLine style={{ fontSize: 8.5 }}>The Old Crown</MonoLine>
        <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.08, margin: "5px 0 6px" }}>Stamp your visit.</div>
        <MonoLine style={{ fontSize: 8 }}>3 visits · mystery reward</MonoLine>
      </div>
      <QrBlock size={66} />
    </div>
  );
}

function MoStickerPreview() {
  return (
    <div style={{ display: "grid", placeItems: "center", aspectRatio: "1 / 1" }}>
      <div style={{
        width: "82%", aspectRatio: "1 / 1", borderRadius: "50%", background: "var(--w-card)",
        border: "2px solid var(--w-ink)", boxShadow: "var(--w-shadow)", transform: "rotate(-8deg)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 7, position: "relative", padding: 12,
      }}>
        <div style={{ position: "absolute", inset: 7, borderRadius: "50%", border: "1.5px dashed var(--w-line)" }}></div>
        <MonoLine style={{ fontSize: 8, fontWeight: 700, color: "var(--w-accent)" }}>Stamp your visit</MonoLine>
        <QrBlock size={64} />
        <MonoLine style={{ fontSize: 7.5 }}>The Old Crown</MonoLine>
      </div>
    </div>
  );
}

const MO_ASSETS = [
  { id: "poster", name: "Counter poster", sub: "A4 for the till, tables, and the door.", spec: "A4 · 300dpi", Preview: MoPosterPreview },
  { id: "till", name: "Till card", sub: "Lands beside the card machine.", spec: "148×105mm", Preview: MoTillPreview },
  { id: "sticker", name: "Sticker", sub: "Round vinyl for windows and trays.", spec: "60mm round", Preview: MoStickerPreview },
];

function MerchantQrStudio({ t, go }) {
  const mo = t.mo;
  const [dl, setDl] = useStateMo({});
  const [qrOn, setQrOn] = useStateMo(true);

  const download = (key) => {
    if (dl[key]) return;
    setDl((d) => ({ ...d, [key]: "prep" }));
    setTimeout(() => setDl((d) => ({ ...d, [key]: "done" })), 850 * mo);
    setTimeout(() => setDl((d) => { const n = { ...d }; delete n[key]; return n; }), 2600 * mo);
  };
  const lbl = (key, base) => (dl[key] === "prep" ? "Preparing…" : dl[key] === "done" ? "Downloaded ✓" : base);

  return (
    <div data-screen-label="Merchant · QR studio" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <MoHead
        title="QR studio"
        sub="One permanent code — reprints never invalidate it"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontFamily: "var(--w-mono)", fontSize: 21, fontWeight: 700, lineHeight: 1 }}>86</div>
              <MonoLine style={{ fontSize: 9, marginTop: 3 }}>Scans this week</MonoLine>
            </div>
            <MoToggle on={qrOn} onClick={() => setQrOn(!qrOn)} mo={mo} />
          </div>
        }
      />
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <MonoLine style={{ fontSize: 10 }}>{qrOn ? "QR live at the counter · rate limit 60 scans/min — never near it" : "QR paused"}</MonoLine>
      </div>
      {!qrOn && (
        <div style={{
          border: "2px dashed var(--w-ink-soft)", borderRadius: "var(--w-r)", padding: "14px 18px",
          marginBottom: 20, animation: `w-rise ${300 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>Paused, not broken.</div>
          <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 3 }}>
            Scans now show a polite "ask a team member" note. Stamps already collected are safe,
            and this exact code wakes back up the moment you switch it on — no reprints needed.
          </div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 22, opacity: qrOn ? 1 : 0.55, transition: `opacity ${220 * mo}ms` }}>
        {MO_ASSETS.map(({ id, name, sub, spec, Preview }) => (
          <div key={id} style={{ display: "grid", gap: 14, alignContent: "start" }}>
            <div style={{ padding: "8px 6px" }}><Preview /></div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <div style={{ fontWeight: 800, fontSize: 16.5 }}>{name}</div>
                <MonoLine style={{ fontSize: 9.5 }}>{spec}</MonoLine>
              </div>
              <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 3 }}>{sub}</div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <InkButton size="sm" variant="outline" disabled={dl[id + "png"] === "prep"} onClick={() => download(id + "png")}>
                {lbl(id + "png", "PNG")}
              </InkButton>
              <InkButton size="sm" variant="dark" disabled={dl[id + "pdf"] === "prep"} onClick={() => download(id + "pdf")}>
                {lbl(id + "pdf", "Print PDF")}
              </InkButton>
            </div>
          </div>
        ))}
      </div>
      <ReceiptRule style={{ margin: "26px 0 16px" }} />
      <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <MonoLine style={{ fontSize: 10 }}>Points to nabaperks.app/m/old-crown · printed copies never expire</MonoLine>
        <DemoTag onClick={() => go("Customer", "landing")}>Scan it as a customer</DemoTag>
      </div>
    </div>
  );
}

/* ================================================================
   Settings — venue, staff PIN, team, pause
   ================================================================ */

function MerchantSettings({ t, go }) {
  const mo = t.mo;
  const [name, setName] = useStateMo("The Old Crown");
  const [city, setCity] = useStateMo("Bristol");
  const [slug, setSlug] = useStateMo("old-crown");
  const [savedTick, setSavedTick] = useStateMo(false);
  const [pin, setPin] = useStateMo("7312");
  const [pinShown, setPinShown] = useStateMo(false);
  const [rotated, setRotated] = useStateMo(false);
  const [pauseOpen, setPauseOpen] = useStateMo(false);
  const [paused, setPaused] = useStateMo(false);

  useEffectMo(() => {
    if (!pinShown) return;
    const id = setTimeout(() => setPinShown(false), 3400 * mo);
    return () => clearTimeout(id);
  }, [pinShown, pin]);

  const saveVenue = () => {
    setSavedTick(true);
    setTimeout(() => setSavedTick(false), 1800 * mo);
  };
  const rotateNow = () => {
    setPin("4906");
    setRotated(true);
    setPinShown(true);
  };

  return (
    <div data-screen-label="Merchant · Settings" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <MoHead title="Settings" sub="Venue · staff PIN · team · programme" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))", gap: 24, alignItems: "start" }}>

        {/* venue details */}
        <ReceiptCard mo={mo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Venue details</div>
            <VenueMark size={44} angle={-8} />
          </div>
          <ReceiptRule />
          <div style={{ display: "grid", gap: 14 }}>
            <MoField label="Venue name" value={name} onChange={setName} />
            <MoField label="City" value={city} onChange={setCity} />
            <MoField label="Card link" value={slug} onChange={setSlug} prefix="nabaperks.app/m/" />
            <InkButton size="md" variant={savedTick ? "outline" : "dark"} onClick={saveVenue}>
              {savedTick ? "Saved ✓" : "Save venue details"}
            </InkButton>
            <MonoLine style={{ fontSize: 9.5 }}>Changing the link keeps the same QR — the code redirects.</MonoLine>
          </div>
        </ReceiptCard>

        {/* staff PIN */}
        <ReceiptCard mo={mo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Staff PIN</div>
            {rotated && <MonoTag tone="accent" style={{ fontSize: 9 }}>Rotated just now</MonoTag>}
          </div>
          <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 4 }}>
            One shared counter PIN approves stamps and redemptions.
          </div>
          <ReceiptRule />
          <div style={{ display: "flex", gap: 9, justifyContent: "center", margin: "6px 0 14px" }}>
            {pin.split("").map((d, i) => (
              <div key={i} style={{
                width: 46, height: 56, border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
                background: "var(--w-paper)", display: "grid", placeItems: "center",
                fontFamily: "var(--w-mono)", fontSize: pinShown ? 24 : 15, fontWeight: 700,
                animation: pinShown ? `w-pop ${280 * mo}ms ${i * 45 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both` : "none",
              }}>{pinShown ? d : "●"}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
            <InkButton size="sm" variant="outline" onClick={() => setPinShown(!pinShown)}>
              {pinShown ? "Hide it" : "Reveal today's PIN"}
            </InkButton>
            <DemoTag onClick={rotateNow}>Rotate now</DemoTag>
          </div>
          {pinShown && (
            <MonoLine style={{ fontSize: 9.5, textAlign: "center", marginTop: 10 }}>Hides again in a moment — say it, don't screenshot it.</MonoLine>
          )}
          <ReceiptRule />
          <MonoLine style={{ fontSize: 9.5, lineHeight: 1.7 }}>
            Rotates nightly at 04:00 UK · 3 wrong tries locks the pad for 10 minutes
          </MonoLine>
        </ReceiptCard>

        {/* team */}
        <ReceiptCard mo={mo}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>Team</div>
          <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 4 }}>
            Everyone at the counter shares today's PIN.
          </div>
          <ReceiptRule />
          {[
            { n: "Maya", role: "Manager", note: "Can reveal the PIN" },
            { n: "Jordan", role: "Counter", note: "Stamps & redeems" },
          ].map((s, i) => (
            <div key={s.n} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
              borderTop: i === 0 ? "none" : "2px dashed var(--w-line)",
            }}>
              <span style={{
                width: 34, height: 34, borderRadius: "50%", background: i === 0 ? "var(--w-accent)" : "var(--w-paper-2)",
                color: i === 0 ? "#fff" : "var(--w-ink)", border: "2px solid var(--w-ink)",
                display: "inline-grid", placeItems: "center", fontWeight: 800, fontSize: 14, transform: "rotate(-6deg)",
              }}>{s.n[0]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{s.n}</div>
                <div style={{ fontSize: 12, color: "var(--w-ink-soft)" }}>{s.note}</div>
              </div>
              <MonoTag tone={i === 0 ? "ink" : "plain"} style={{ fontSize: 9 }}>{s.role}</MonoTag>
            </div>
          ))}
          <ReceiptRule />
          <MonoLine style={{ fontSize: 9.5 }}>Signed in as hello@oldcrown.pub</MonoLine>
        </ReceiptCard>

        {/* pause programme */}
        <ReceiptCard mo={mo}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Programme</div>
            <MonoTag tone={paused ? "ink" : "plain"} style={{ fontSize: 9 }}>{paused ? "Paused" : "Running"}</MonoTag>
          </div>
          <div style={{ fontSize: 13, color: "var(--w-ink-soft)", marginTop: 4 }}>
            {paused
              ? "The counter QR shows a polite pause note. Every stamp and unsealed reward is safe."
              : "Live since 21 May. Pausing stops new stamps — it never deletes a thing."}
          </div>
          <ReceiptRule />
          {paused ? (
            <InkButton size="md" full onClick={() => setPaused(false)}>Resume programme</InkButton>
          ) : (
            <InkButton size="md" full variant="outline" onClick={() => setPauseOpen(true)}>Pause programme</InkButton>
          )}
          <MonoLine style={{ fontSize: 9.5, marginTop: 12 }}>Customers keep their stamps either way</MonoLine>
        </ReceiptCard>
      </div>

      <Sheet open={pauseOpen} onClose={() => setPauseOpen(false)} mo={mo}>
        <div style={{ textAlign: "center", padding: "4px 4px 6px" }}>
          <h3 style={{ fontSize: 23, fontWeight: 800, margin: "4px 0 8px" }}>Pause the programme?</h3>
          <p style={{ fontSize: 14.5, lineHeight: "21px", color: "var(--w-ink-soft)", margin: "0 auto 20px", maxWidth: "34ch" }}>
            Customers keep every stamp and any unsealed reward. The QR shows a friendly
            pause note until you switch back on.
          </p>
          <div style={{ display: "grid", gap: 10 }}>
            <InkButton full variant="dark" onClick={() => { setPaused(true); setPauseOpen(false); }}>
              Pause it
            </InkButton>
            <GhostLink onClick={() => setPauseOpen(false)}>Keep it running</GhostLink>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ================================================================
   Billing — £29/month, one venue, pilot day 23 of 30
   ================================================================ */

const MO_INVOICES = [
  { id: "NP-0034", date: "01 Jun 2026", amount: "£0.00", note: "Pilot month", status: "PAID" },
  { id: "NP-0021", date: "21 May 2026", amount: "£0.00", note: "Pilot start", status: "PAID" },
];

function MerchantBilling({ t, go }) {
  const mo = t.mo;
  const [day30, setDay30] = useStateMo(false);
  const [stripe, setStripe] = useStateMo("idle"); // idle | opening | note

  const openStripe = () => {
    if (stripe !== "idle") return;
    setStripe("opening");
    setTimeout(() => setStripe("note"), 1100 * mo);
    setTimeout(() => setStripe("idle"), 3600 * mo);
  };

  const day = day30 ? 30 : 23;
  const invoices = day30
    ? [{ id: "NP-0048", date: "19 Jun 2026", amount: "£29.00", note: "First month", status: "PAID" }, ...MO_INVOICES]
    : [{ id: "NP-0048", date: "19 Jun 2026", amount: "£29.00", note: "First month", status: "UPCOMING" }, ...MO_INVOICES];

  return (
    <div data-screen-label="Merchant · Billing" style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
      <MoHead
        title="Billing"
        sub="One price · one venue · Stripe handles the cards"
        right={<MonoTag tone={day30 ? "ink" : "accent"}>{day30 ? "Active" : `Trial · day ${day} of 30`}</MonoTag>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 24, alignItems: "start", maxWidth: 880 }}>

        {/* plan */}
        <ReceiptCard mo={mo}>
          <MonoLine>Growth plan · The Old Crown</MonoLine>
          <div style={{ fontWeight: 800, fontSize: 27, lineHeight: 1.05, margin: "8px 0 4px" }}>
            £29<span style={{ fontSize: 16, fontWeight: 700, color: "var(--w-ink-soft)" }}>/month after the pilot</span>
          </div>
          <div style={{ fontSize: 13.5, color: "var(--w-ink-soft)" }}>
            {day30 ? "Pilot complete — the plan rolled over without a hiccup." : "First 30 days free. No card was needed to start."}
          </div>
          <ReceiptRule />
          <ProgressLine current={day} total={30} label="Pilot day" />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 8 }}>
            <MonoLine style={{ fontSize: 10 }}>{day30 ? "Next charge 19 Jul · £29.00" : "Pilot ends Fri 19 Jun · first charge £29.00"}</MonoLine>
            <DemoTag onClick={() => setDay30(!day30)}>{day30 ? "Rewind to day 23" : "Skip to day 30"}</DemoTag>
          </div>
          <ReceiptRule />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{
              fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700, padding: "5px 9px",
              border: "2px solid var(--w-ink)", borderRadius: 6, background: "var(--w-paper-2)",
            }}>VISA</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: "var(--w-mono)", fontSize: 13.5, fontWeight: 700 }}>···· 4242</div>
              <MonoLine style={{ fontSize: 9.5 }}>Expires 08/27 · added on day 12</MonoLine>
            </div>
            <InkButton size="sm" variant="dark" disabled={stripe === "opening"} onClick={openStripe}>
              {stripe === "opening" ? "Opening…" : "Manage in Stripe"}
            </InkButton>
          </div>
          {stripe === "note" && (
            <MonoLine style={{ fontSize: 9.5, marginTop: 10, animation: `w-rise ${280 * mo}ms both` }}>
              Stripe portal would open in a new tab — simulated here, nothing left the page.
            </MonoLine>
          )}
        </ReceiptCard>

        <div style={{ display: "grid", gap: 24 }}>
          {/* invoices */}
          <ReceiptCard mo={mo}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Invoices</div>
            <ReceiptRule />
            {invoices.map((inv, i) => (
              <div key={inv.id} style={{
                display: "grid", gridTemplateColumns: "auto 1fr auto auto", gap: 12, alignItems: "baseline",
                padding: "10px 0", borderTop: i === 0 ? "none" : "2px dashed var(--w-line)",
                fontFamily: "var(--w-mono)",
                animation: day30 && i === 0 ? `w-rise ${320 * mo}ms both` : "none",
              }}>
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>{inv.id}</span>
                <span style={{ fontSize: 11, color: "var(--w-ink-soft)" }}>{inv.date} · {inv.note}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>{inv.amount}</span>
                <MonoTag tone={inv.status === "PAID" ? "ink" : "plain"} style={{ fontSize: 8.5 }}>{inv.status}</MonoTag>
              </div>
            ))}
            <ReceiptRule />
            <MonoLine style={{ fontSize: 9.5 }}>Receipts also land at hello@oldcrown.pub</MonoLine>
          </ReceiptCard>

          {/* past_due explainer */}
          <div style={{ border: "2px dashed var(--w-line)", borderRadius: "var(--w-r)", padding: "16px 18px" }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>If a payment ever fails</div>
            <div style={{ fontSize: 13, lineHeight: "19px", color: "var(--w-ink-soft)", marginTop: 5 }}>
              Nothing dramatic. Customers keep every stamp and cards stay visible.
              Stripe retries for a week and we email you first — only new stamps
              wait if it stays unpaid, and everything resumes the moment it clears.
            </div>
            <MonoLine style={{ fontSize: 9.5, marginTop: 10 }}>past_due → suspended only after repeated retries · never silently</MonoLine>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   exports
   ================================================================ */
Object.assign(window, {
  MerchantActivity, MerchantCustomers, MerchantQrStudio, MerchantSettings, MerchantBilling,
});
