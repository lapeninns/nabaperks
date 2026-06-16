// Nabaperks v2 "Wet Ink" — 40-admin.jsx
// Internal support console. Gate (MFA) → Overview · Merchants · Billing · Audit · Fraud.
// Quieter ink: paper-2 panels, hard borders, almost no rotation — an internal tool wearing the brand.
const { useState: useStateAd, useEffect: useEffectAd } = React;

const AD_LS = "v3_admin";

function adLoad() {
  try { return JSON.parse(localStorage.getItem(AD_LS)) || {}; } catch (e) { return {}; }
}

/* ---------- support data (canon: The Old Crown + plausible UK venues) ---------- */

const AD_MERCHANTS = [
  { id: "m1", name: "The Old Crown", city: "Bristol", kind: "Pub", initials: "OC",
    owner: "hello@oldcrown.pub", status: "trial", note: "Pilot day 23/30", joined: "21 MAY 2026",
    members: 128, stampsWk: 341, plan: "£0 · pilot", webhook: "customer.subscription.updated", webhookAt: "12 JUN 04:02" },
  { id: "m2", name: "Fade & Co Barbers", city: "Leeds", kind: "Barbers", initials: "FC",
    owner: "book@fadeandco.uk", status: "active", note: "Since Mar 2026", joined: "02 MAR 2026",
    members: 96, stampsWk: 212, plan: "£29/mo", webhook: "invoice.paid", webhookAt: "01 JUN 06:14" },
  { id: "m3", name: "Crumb Bakery", city: "York", kind: "Bakery", initials: "CB",
    owner: "hi@crumbbakery.co.uk", status: "trial", note: "Pilot day 9/30", joined: "04 JUN 2026",
    members: 54, stampsWk: 147, plan: "£0 · pilot", webhook: "checkout.session.completed", webhookAt: "04 JUN 11:36" },
  { id: "m4", name: "The Brass Tap", city: "Manchester", kind: "Pub", initials: "BT",
    owner: "cellar@brasstap.pub", status: "past_due", note: "Invoice unpaid 9 days", joined: "12 JAN 2026",
    members: 88, stampsWk: 64, plan: "£29/mo", webhook: "invoice.payment_failed", webhookAt: "09 JUN 06:02" },
  { id: "m5", name: "Marigold Nails", city: "Sheffield", kind: "Salon", initials: "MN",
    owner: "studio@marigoldnails.uk", status: "suspended", note: "Paused 11 JUN", joined: "18 APR 2026",
    members: 37, stampsWk: 0, plan: "£29/mo", webhook: "customer.subscription.paused", webhookAt: "11 JUN 09:00" },
  { id: "m6", name: "Penny Lane Records Café", city: "Liverpool", kind: "Café", initials: "PL",
    owner: "counter@pennylanerecords.uk", status: "active", note: "Since Feb 2026", joined: "09 FEB 2026",
    members: 103, stampsWk: 198, plan: "£29/mo", webhook: "invoice.paid", webhookAt: "05 JUN 06:11" },
];

const AD_FLAGS = [
  { id: "FR-0117", type: "high_stamp_velocity", venue: "Fade & Co Barbers", city: "Leeds", when: "12 JUN 10:42",
    detail: "23 stamps approved in 15 minutes from one staff PIN. Typical pace for this venue is about 4 an hour.",
    bars: [1, 1, 2, 1, 2, 3, 9, 12, 8, 2, 1, 1], window: "10:30 — 10:45 · stamps per minute" },
  { id: "FR-0102", type: "repeat_device_join", venue: "Crumb Bakery", city: "York", when: "09 JUN 16:20",
    detail: "4 join attempts from one device inside an hour. The rate limit held at 5 texts per 15 minutes — nothing got through twice.",
    bars: [1, 2, 1, 4, 3, 1, 1, 0, 1, 0, 1, 0], window: "15:20 — 16:20 · joins per 5 min",
    closed: "Dismissed · 09 JUN 17:01 · shared family tablet, confirmed with the venue" },
];

const AD_AUDIT_BASE = [
  { ts: "12 JUN 09:58", who: "ops@nabaperks.co", what: "revealed staff PIN for The Old Crown · support ticket #482" },
  { ts: "12 JUN 04:00", who: "system", what: "nightly staff PIN rotation completed · 6 venues" },
  { ts: "11 JUN 17:12", who: "ops@nabaperks.co", what: "resent magic link to hello@oldcrown.pub" },
  { ts: "11 JUN 11:02", who: "ops@nabaperks.co", what: "paused programme for Marigold Nails · billing suspended" },
  { ts: "10 JUN 14:47", who: "ops@nabaperks.co", what: "regenerated venue QR for Crumb Bakery — old code honoured for 24h" },
  { ts: "10 JUN 09:05", who: "system", what: "Stripe sync replayed 2 missed webhook events" },
  { ts: "09 JUN 17:01", who: "ops@nabaperks.co", what: "dismissed fraud flag FR-0102 (repeat_device_join) · Crumb Bakery" },
];

/* ---------- quiet building blocks ---------- */

const AD_TH = {
  fontFamily: "var(--w-mono)", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.08em",
  textTransform: "uppercase", color: "var(--w-ink-soft)", padding: "10px 14px",
};
const AD_TD = { padding: "13px 14px", display: "flex", alignItems: "center" };

function AdPanel({ title, sub, right, children, style }) {
  return (
    <section style={{ background: "var(--w-card)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", boxShadow: "var(--w-shadow-sm)", overflow: "hidden", ...style }}>
      {title && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12, padding: "16px 18px 0" }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>{title}</h2>
            {sub && <div style={{ fontSize: 13.5, color: "var(--w-ink-soft)", marginTop: 3 }}>{sub}</div>}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: title ? "14px 18px 18px" : "18px" }}>{children}</div>
    </section>
  );
}

function AdStat({ value, label, sub }) {
  return (
    <div style={{ background: "var(--w-paper-2)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", padding: "16px 16px 14px", boxShadow: "var(--w-shadow-sm)" }}>
      <div style={{ fontFamily: "var(--w-display)", fontWeight: 800, fontSize: 34, lineHeight: 1 }}>{value}</div>
      <MonoLine style={{ marginTop: 8, color: "var(--w-ink)", fontWeight: 700 }}>{label}</MonoLine>
      <MonoLine style={{ marginTop: 4, fontSize: 10 }}>{sub}</MonoLine>
    </div>
  );
}

function AdStatusTag({ status }) {
  if (status === "active") return <MonoTag tone="ink">Active</MonoTag>;
  if (status === "trial") return <MonoTag>Trial</MonoTag>;
  if (status === "past_due") return <MonoTag tone="accent">Past due</MonoTag>;
  return <MonoTag style={{ background: "var(--w-paper-2)", color: "var(--w-ink)", border: "1.5px solid var(--w-ink)" }}>Suspended</MonoTag>;
}

function AdBars({ bars, dim }) {
  const max = Math.max(...bars, 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 56, padding: "10px 12px 8px", background: "var(--w-paper-2)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", opacity: dim ? 0.45 : 1, width: "fit-content" }}>
      {bars.map((b, i) => (
        <div key={i} style={{ width: 13, height: Math.max(3, (b / max) * 38), borderRadius: 2, background: b >= 8 ? "var(--w-accent)" : "var(--w-ink)", opacity: b >= 8 ? 1 : 0.35 }}></div>
      ))}
    </div>
  );
}

function AdFact({ k, v }) {
  return (
    <div style={{ minWidth: 0 }}>
      <MonoLine style={{ fontSize: 10 }}>{k}</MonoLine>
      <div style={{ fontWeight: 700, fontSize: 14.5, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</div>
    </div>
  );
}

function AdToast({ toast, mo }) {
  if (!toast) return null;
  return (
    <div key={toast.id} style={{
      position: "fixed", left: "50%", bottom: 86, transform: "translateX(-50%)", zIndex: 70,
      background: "var(--w-ink)", color: "var(--w-paper)", borderRadius: 999, padding: "11px 20px",
      fontFamily: "var(--w-mono)", fontSize: 11.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
      whiteSpace: "nowrap", boxShadow: "0 6px 24px rgba(33,28,22,0.35)", animation: `w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`,
    }}>✓ {toast.text}</div>
  );
}

/* ---------- surface ---------- */

function AdminSurface({ t, go }) {
  const mo = t.mo;
  const [stage, setStage] = useStateAd(() => adLoad().stage || "gate");
  const [tab, setTab] = useStateAd(() => adLoad().tab || "overview");
  const [resolvedFlags, setResolvedFlags] = useStateAd(() => adLoad().resolvedFlags || {});
  const [pausedIds, setPausedIds] = useStateAd(() => adLoad().pausedIds || []);
  const [auditExtra, setAuditExtra] = useStateAd(() => adLoad().auditExtra || []);
  const [email, setEmail] = useStateAd("ops@nabaperks.co");
  const [otp, setOtp] = useStateAd("");
  const [sheetId, setSheetId] = useStateAd(null);
  const [toast, setToast] = useStateAd(null);

  useEffectAd(() => {
    localStorage.setItem(AD_LS, JSON.stringify({
      stage, tab, resolvedFlags, pausedIds,
      auditExtra: auditExtra.map(({ fresh, ...rest }) => rest),
    }));
  }, [stage, tab, resolvedFlags, pausedIds, auditExtra]);

  useEffectAd(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600 * mo);
    return () => clearTimeout(id);
  }, [toast]);

  const act = (toastText, auditText) => {
    setAuditExtra((a) => [{ ts: "12 JUN · just now", who: "ops@nabaperks.co", what: auditText, fresh: true }, ...a]);
    setToast({ id: Date.now(), text: toastText });
  };

  const resolveFlag = (f, verdict) => {
    setResolvedFlags((r) => ({ ...r, [f.id]: verdict }));
    act(`Flag ${f.id} ${verdict.toLowerCase()}`,
      `${verdict === "Dismissed" ? "dismissed" : "marked as reviewed"} fraud flag ${f.id} (${f.type}) · ${f.venue}`);
  };

  const reset = () => {
    localStorage.removeItem(AD_LS);
    setStage("gate"); setTab("overview"); setResolvedFlags({}); setPausedIds([]);
    setAuditExtra([]); setOtp(""); setEmail("ops@nabaperks.co"); setSheetId(null); setToast(null);
  };

  const openFlags = AD_FLAGS.filter((f) => !f.closed && !resolvedFlags[f.id]);
  const selected = AD_MERCHANTS.find((m) => m.id === sheetId);
  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)", border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)" }}>✱</span>
      <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>nabaperks</span>
      <MonoTag tone="ink" style={{ marginLeft: 4 }}>Internal</MonoTag>
    </div>
  );

  /* ---------- stage: gate ---------- */

  if (stage === "gate") {
    const ready = otp.length === 6 && email.includes("@");
    return (
      <div data-screen-label="Admin · Internal gate" style={{ maxWidth: 430, margin: "0 auto", padding: "26px 20px 120px", minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}>{brand}</div>
        <div style={{
          background: "var(--w-paper-2)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)",
          boxShadow: "var(--w-shadow-sm)", padding: "26px 22px",
          animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        }}>
          <MonoTag tone="ink">Internal · MFA required</MonoTag>
          <h1 style={{ fontSize: 30, fontWeight: 800, lineHeight: 1.05, margin: "14px 0 8px" }}>Internal only.</h1>
          <p style={{ fontSize: 14.5, lineHeight: "21px", color: "var(--w-ink-soft)", margin: "0 0 20px" }}>
            Support console for Nabaperks staff. Every session — and every action inside it — lands in the audit log.
          </p>
          <MonoLine style={{ marginBottom: 7 }}>Work email</MonoLine>
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@nabaperks.co"
            style={{ width: "100%", padding: "14px 16px", fontSize: 18, fontFamily: "var(--w-mono)", color: "var(--w-ink)", background: "var(--w-paper)", border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", outline: "none" }} />
          <MonoLine style={{ margin: "16px 0 9px" }}>6-digit MFA code</MonoLine>
          <OtpBoxes value={otp} onChange={setOtp} />
          <div style={{ marginTop: 20 }}>
            <InkButton full variant="dark" disabled={!ready}
              onClick={() => { setStage("console"); setToast({ id: Date.now(), text: "Signed in · session logged" }); }}>
              Unlock console
            </InkButton>
          </div>
          <div style={{ textAlign: "center", marginTop: 12 }}>
            <DemoTag onClick={() => setOtp("120626")}>Autofill MFA code</DemoTag>
          </div>
        </div>
        <MonoLine style={{ textAlign: "center", marginTop: 16, fontSize: 10 }}>
          Sessions idle out after 30 min · IP logged · ops only
        </MonoLine>
        <AdToast toast={toast} mo={mo} />
      </div>
    );
  }

  /* ---------- stage: console ---------- */

  const tabs = ["overview", "merchants", "billing", "audit", "fraud"];
  const tabLabel = (k) => (k === "fraud" && openFlags.length ? `Fraud · ${openFlags.length}` : k);
  const audit = [...auditExtra, ...AD_AUDIT_BASE];

  let body = null;

  if (tab === "overview") {
    body = (
      <div style={{ display: "grid", gap: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14 }}>
          <AdStat value="4" label="Live merchants" sub="6 onboarded · 2 flagged below" />
          <AdStat value="506" label="Members" sub="+38 this week, all venues" />
          <AdStat value="962" label="Stamps this week" sub="One per member per UK business day" />
          <AdStat value="41" label="Rewards redeemed" sub="Last 7 days · all venues" />
        </div>
        <AdPanel title="Needs attention" sub={openFlags.length ? "Two things, neither on fire." : "One thing, and Stripe is already on it."}
          right={<MonoTag tone="accent">{1 + openFlags.length} open</MonoTag>}>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              { tag: "Past due", goTab: "billing", text: "The Brass Tap · invoice unpaid 9 days — Stripe retries 14 JUN" },
              ...(openFlags.length ? [{ tag: "Fraud", goTab: "fraud", text: "high_stamp_velocity · Fade & Co Barbers — 23 stamps in 15 min" }] : []),
            ].map((n) => (
              <button key={n.goTab} onClick={() => setTab(n.goTab)} style={{
                display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left", background: "var(--w-paper-2)",
                border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", padding: "13px 15px", cursor: "pointer", fontFamily: "var(--w-display)", color: "var(--w-ink)",
              }}>
                <MonoTag tone="accent">{n.tag}</MonoTag>
                <span style={{ fontWeight: 700, fontSize: 14.5, flex: 1 }}>{n.text}</span>
                <MonoLine style={{ fontSize: 10 }}>Open {n.goTab} →</MonoLine>
              </button>
            ))}
            {!openFlags.length && (
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 15px", border: "2px dashed var(--w-line)", borderRadius: "var(--w-r)" }}>
                <MonoTag style={{ background: "var(--w-leaf)", color: "#fff", border: "1.5px solid var(--w-ink)" }}>Clear</MonoTag>
                <span style={{ fontSize: 14.5, color: "var(--w-ink-soft)" }}>Fraud queue clear — nothing waiting on you.</span>
              </div>
            )}
          </div>
        </AdPanel>
        <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
          Mirrors product_events · refreshed 2 min ago · read-only unless audited
        </MonoLine>
      </div>
    );
  }

  if (tab === "merchants") {
    const cols = "2.1fr 1.3fr 0.7fr 0.9fr 1.7fr 100px";
    body = (
      <AdPanel title="Merchants" sub="Every venue on the platform, one row each.">
        <div style={{ border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, background: "var(--w-paper-2)", borderBottom: "2px solid var(--w-ink)" }}>
            {["Venue", "Status", "Members", "Stamps 7d", "Owner", ""].map((h, i) => <div key={i} style={AD_TH}>{h}</div>)}
          </div>
          {AD_MERCHANTS.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: cols, borderTop: i ? "2px dashed var(--w-line)" : "none", background: pausedIds.includes(m.id) ? "var(--w-paper-2)" : "transparent" }}>
              <div style={{ ...AD_TD, display: "block" }}>
                <div style={{ fontWeight: 700, fontSize: 14.5 }}>{m.name}</div>
                <MonoLine style={{ fontSize: 10, marginTop: 2 }}>{m.city} · {m.kind} · {m.note}</MonoLine>
              </div>
              <div style={{ ...AD_TD, gap: 6, flexWrap: "wrap" }}>
                <AdStatusTag status={m.status} />
                {pausedIds.includes(m.id) && <MonoTag>Paused</MonoTag>}
              </div>
              <div style={{ ...AD_TD, fontFamily: "var(--w-mono)", fontSize: 13.5, fontWeight: 700 }}>{m.members}</div>
              <div style={{ ...AD_TD, fontFamily: "var(--w-mono)", fontSize: 13.5, fontWeight: 700 }}>{m.stampsWk}</div>
              <div style={{ ...AD_TD, fontFamily: "var(--w-mono)", fontSize: 11.5, color: "var(--w-ink-soft)", overflow: "hidden" }}>{m.owner}</div>
              <div style={AD_TD}>
                <InkButton variant="outline" size="sm" onClick={() => setSheetId(m.id)}>View</InkButton>
              </div>
            </div>
          ))}
        </div>
      </AdPanel>
    );
  }

  if (tab === "billing") {
    const cols = "2fr 1fr 1.1fr 2fr";
    body = (
      <AdPanel title="Stripe sync" sub="This table mirrors the last webhook per venue. Stripe stays the source of truth.">
        <div style={{ border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, background: "var(--w-paper-2)", borderBottom: "2px solid var(--w-ink)" }}>
            {["Merchant", "Plan", "Status", "Last webhook event"].map((h, i) => <div key={i} style={AD_TH}>{h}</div>)}
          </div>
          {AD_MERCHANTS.map((m, i) => (
            <div key={m.id} style={{ display: "grid", gridTemplateColumns: cols, borderTop: i ? "2px dashed var(--w-line)" : "none", background: m.status === "past_due" ? "var(--w-paper-2)" : "transparent" }}>
              <div style={{ ...AD_TD, fontWeight: 700, fontSize: 14.5 }}>{m.name}</div>
              <div style={{ ...AD_TD, fontFamily: "var(--w-mono)", fontSize: 12 }}>{m.plan}</div>
              <div style={AD_TD}><AdStatusTag status={m.status} /></div>
              <div style={{ ...AD_TD, fontFamily: "var(--w-mono)", fontSize: 11.5, color: "var(--w-ink-soft)" }}>
                {m.webhook} · {m.webhookAt}
              </div>
            </div>
          ))}
        </div>
        <div style={{
          marginTop: 14, display: "flex", gap: 14, alignItems: "flex-start", background: "var(--w-paper-2)",
          border: "2px dashed var(--w-line)", borderRadius: "var(--w-r)", padding: "15px 16px",
        }}>
          <MonoTag tone="accent" style={{ marginTop: 2 }}>Past due</MonoTag>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>The Brass Tap — two card retries failed.</div>
            <p style={{ fontSize: 13.5, lineHeight: "20px", color: "var(--w-ink-soft)", margin: "5px 0 12px" }}>
              Stripe retries again on 14 JUN. The loyalty card stays visible to members; if this lapses to
              suspended, new joins and stamps pause until billing is restored. No customer ever sees a billing error.
            </p>
            <InkButton variant="outline" size="sm"
              onClick={() => act("Payment link sent to cellar@brasstap.pub", "sent a Stripe payment-update link to The Brass Tap")}>
              Send payment update link
            </InkButton>
          </div>
        </div>
        <MonoLine style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
          £29 a month · one price · one venue · 30-day pilot, no card to start
        </MonoLine>
      </AdPanel>
    );
  }

  if (tab === "audit") {
    body = (
      <AdPanel title="Audit log" sub="Every support action lands here — reveals, pauses, resends, manual fixes. Nothing is silent.">
        <div style={{ border: "2px solid var(--w-ink)", borderRadius: "var(--w-r)", overflow: "hidden" }}>
          {audit.map((e, i) => (
            <div key={i} style={{
              display: "grid", gridTemplateColumns: "128px 168px 1fr", gap: 10, padding: "12px 14px", alignItems: "baseline",
              borderTop: i ? "2px dashed var(--w-line)" : "none", background: e.fresh ? "var(--w-paper-2)" : "transparent",
            }}>
              <span style={{ fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700, color: e.fresh ? "var(--w-accent)" : "var(--w-ink)" }}>{e.ts}</span>
              <span style={{ fontFamily: "var(--w-mono)", fontSize: 11, color: "var(--w-ink-soft)", overflow: "hidden", textOverflow: "ellipsis" }}>{e.who}</span>
              <span style={{ fontSize: 13.5 }}>{e.what}</span>
            </div>
          ))}
        </div>
        <MonoLine style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
          Append-only · kept 24 months · readable by every admin
        </MonoLine>
      </AdPanel>
    );
  }

  if (tab === "fraud") {
    body = (
      <div style={{ display: "grid", gap: 16 }}>
        {AD_FLAGS.map((f) => {
          const resolution = f.closed || (resolvedFlags[f.id] ? `${resolvedFlags[f.id]} · just now · by ops@nabaperks.co` : null);
          return (
            <AdPanel key={f.id} title={f.type} sub={`${f.venue} · ${f.city} · raised ${f.when}`}
              right={resolution
                ? <MonoTag style={{ background: "var(--w-leaf)", color: "#fff", border: "1.5px solid var(--w-ink)" }}>Resolved</MonoTag>
                : <MonoTag tone="accent">Open · {f.id}</MonoTag>}
              style={resolution ? { opacity: 0.78 } : null}>
              <p style={{ fontSize: 14, lineHeight: "21px", margin: "0 0 14px", maxWidth: "62ch" }}>{f.detail}</p>
              <AdBars bars={f.bars} dim={!!resolution} />
              <MonoLine style={{ marginTop: 8, fontSize: 10 }}>{f.window}</MonoLine>
              <ReceiptRule />
              {resolution ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <span style={{ fontFamily: "var(--w-mono)", fontSize: 11.5, fontWeight: 700, color: "var(--w-leaf)" }}>✓ {resolution}</span>
                  {!f.closed && (
                    <GhostLink style={{ fontSize: 13.5, padding: "4px 6px", minHeight: 0 }}
                      onClick={() => {
                        setResolvedFlags((r) => { const n = { ...r }; delete n[f.id]; return n; });
                        act(`Flag ${f.id} reopened`, `reopened fraud flag ${f.id} (${f.type}) · ${f.venue}`);
                      }}>Reopen</GhostLink>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <InkButton variant="dark" size="md" onClick={() => resolveFlag(f, "Reviewed")}>Mark reviewed</InkButton>
                  <InkButton variant="outline" size="md" onClick={() => resolveFlag(f, "Dismissed")}>Dismiss</InkButton>
                  <MonoLine style={{ fontSize: 10 }}>Venue sees nothing until you act</MonoLine>
                </div>
              )}
            </AdPanel>
          );
        })}
        <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
          Signals, not verdicts · rate limits already held the line
        </MonoLine>
      </div>
    );
  }

  return (
    <div data-screen-label={`Admin · ${tab}`} style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 24px 120px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {brand}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MonoLine style={{ fontSize: 10 }}>ops@nabaperks.co</MonoLine>
          <GhostLink style={{ fontSize: 13.5 }} onClick={() => { setStage("gate"); setOtp(""); }}>Sign out</GhostLink>
          <DemoTag onClick={reset}>Restart flow</DemoTag>
        </div>
      </div>

      <div style={{ display: "inline-flex", gap: 3, flexWrap: "wrap", background: "var(--w-paper-2)", border: "2px solid var(--w-ink)", borderRadius: 999, padding: 4, marginBottom: 22 }}>
        {tabs.map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            background: tab === k ? "var(--w-ink)" : "transparent", color: tab === k ? "var(--w-paper)" : "var(--w-ink-soft)",
          }}>{tabLabel(k)}</button>
        ))}
      </div>

      <div key={tab} style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
        {body}
      </div>

      <Sheet open={!!selected} onClose={() => setSheetId(null)} mo={mo}>
        {selected && (
          <div data-screen-label="Admin · merchant detail">
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 14 }}>
              <VenueMark size={58} initials={selected.initials} caption={selected.city.toUpperCase()} angle={-6} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.1 }}>{selected.name}</div>
                <MonoLine style={{ fontSize: 10, marginTop: 3 }}>{selected.kind} · {selected.note}</MonoLine>
              </div>
              <div style={{ marginLeft: "auto" }}><AdStatusTag status={selected.status} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 14px" }}>
              <AdFact k="Owner" v={selected.owner} />
              <AdFact k="Joined" v={selected.joined} />
              <AdFact k="Members" v={selected.members} />
              <AdFact k="Stamps · 7d" v={selected.stampsWk} />
            </div>
            <ReceiptRule />
            <MonoLine style={{ marginBottom: 10 }}>Support actions · every one is audited</MonoLine>
            <div style={{ display: "grid", gap: 8 }}>
              {[
                ["Resend magic link", () => act(`Magic link sent to ${selected.owner}`, `resent magic link to ${selected.owner} (${selected.name})`)],
                ["Regenerate QR", () => act(`New venue QR issued for ${selected.name}`, `regenerated venue QR for ${selected.name} — old code honoured for 24h`)],
                [pausedIds.includes(selected.id) ? "Resume programme" : "Pause programme", () => {
                  const paused = pausedIds.includes(selected.id);
                  setPausedIds((p) => paused ? p.filter((x) => x !== selected.id) : [...p, selected.id]);
                  act(`${selected.name} programme ${paused ? "resumed" : "paused"}`,
                    paused ? `resumed programme for ${selected.name}` : `paused programme for ${selected.name} — stamps and joins held`);
                }],
              ].map(([label, fn]) => (
                <InkButton key={label} variant="outline" size="md" full onClick={fn}>{label}</InkButton>
              ))}
            </div>
            {selected.id === "m1" && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <GhostLink style={{ fontSize: 13.5 }} onClick={() => go("Merchant", "today")}>
                  Open their merchant dashboard →
                </GhostLink>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <AdToast toast={toast} mo={mo} />
    </div>
  );
}

/* ---------- exports ---------- */

window.AdminEntry = {
  lsKey: AD_LS,
  presets: {
    gate: { stage: "gate", tab: "overview" },
    overview: { stage: "console", tab: "overview" },
    merchants: { stage: "console", tab: "merchants" },
    billing: { stage: "console", tab: "billing" },
    audit: { stage: "console", tab: "audit" },
    fraud: { stage: "console", tab: "fraud" },
  },
};

Object.assign(window, { AdminSurface });
