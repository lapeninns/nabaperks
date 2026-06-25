// Deterministic light Wet Ink palette so the printed asset never depends on the
// reader's theme. Fonts inherit from the root layout's CSS variables. The accent
// triplet is themed per render via inline custom properties on the root.
export const POSTER_CSS = `
  @page { size: A4; margin: 0; }
  html, body { margin: 0; padding: 0; background: #fff; }
  .qr-poster-root, .qr-poster-root * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    box-sizing: border-box;
  }
  .qr-poster-root {
    --paper: #f6f1e6;
    --card: #fbf8f1;
    --ink: #211c16;
    --ink-soft: #4f473d;
    --muted: #6b6257;
    --line: rgba(33, 28, 22, 0.18);
    --dashed: rgba(33, 28, 22, 0.22);
    --sun: #f5a623;
    --destructive: #c0301c;
    --poster-accent: #cf330a;
    --poster-accent-deep: #a62908;
    --poster-accent-soft: #f1dacc;
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    padding: 12mm;
    display: flex;
    background: var(--paper);
    color: var(--ink);
    font-family: var(--font-sans), "Bricolage Grotesque", system-ui, sans-serif;
    background-image: radial-gradient(rgba(33, 28, 22, 0.022) 1px, transparent 1px);
    background-size: 5px 5px;
  }
  .poster-card {
    position: relative;
    flex: 1;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: 6px 6px 0 var(--ink);
    overflow: hidden;
  }
  .poster-marquee {
    flex: none;
    height: 34px;
    background: var(--poster-accent-soft);
    border-bottom: 2px solid var(--ink);
    overflow: hidden;
    display: flex;
    align-items: center;
  }
  .poster-marquee span {
    white-space: nowrap;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--ink);
    padding-left: 14px;
  }
  .poster-impressions {
    position: absolute;
    inset: 34px 0 0 0;
    z-index: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .poster-impression {
    position: absolute;
    display: grid;
    place-items: center;
    border-radius: 50%;
    font-weight: 800;
  }
  .poster-impression-a {
    top: 120mm;
    left: -4mm;
    width: 120px;
    height: 120px;
    border: 3px solid var(--poster-accent);
    color: var(--poster-accent);
    font-size: 58px;
    transform: rotate(-14deg);
    opacity: 0.08;
  }
  .poster-impression-b {
    bottom: 18mm;
    right: -3mm;
    width: 104px;
    height: 104px;
    border: 3px solid var(--sun);
    color: var(--sun);
    font-size: 50px;
    transform: rotate(12deg);
    opacity: 0.12;
  }
  .poster-body {
    position: relative;
    z-index: 1;
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 9mm 13mm 0;
  }
  .poster-masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 8mm;
    border-bottom: 2px solid var(--ink);
  }
  .poster-brand { display: flex; align-items: center; gap: 9px; }
  .poster-disc {
    width: 30px;
    height: 30px;
    border-radius: 50%;
    background: var(--poster-accent);
    border: 2px solid var(--ink);
    display: inline-grid;
    place-items: center;
    color: #fff;
    font-weight: 800;
    font-size: 15px;
    transform: rotate(-6deg);
  }
  .poster-wordmark { font-weight: 800; font-size: 23px; letter-spacing: -0.02em; }
  .poster-badge {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--muted);
    border: 2px solid var(--ink);
    border-radius: 8px;
    padding: 6px 11px;
    transform: rotate(-2deg);
    background: var(--card);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .poster-headline { padding-top: 8mm; }
  .poster-eyebrow {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--poster-accent-deep);
    margin: 0 0 14px;
  }
  .poster-title {
    font-weight: 800;
    font-size: 62px;
    line-height: 0.94;
    letter-spacing: -0.03em;
    text-wrap: balance;
    margin: 0;
  }
  .poster-title-accent { color: var(--sun); }
  .poster-lede {
    margin: 16px 0 0;
    font-size: 18.5px;
    line-height: 1.45;
    max-width: 31ch;
    color: var(--ink-soft);
  }
  .poster-lede strong { color: var(--ink); font-weight: 700; }
  .poster-hero {
    margin-top: 7mm;
    display: flex;
    align-items: center;
    gap: 11mm;
  }
  .poster-hero-main {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 7mm;
  }
  .poster-headstart {
    display: inline-flex;
    align-items: center;
    gap: 12px;
    align-self: flex-start;
    background: var(--poster-accent);
    color: #fff;
    border: 2px solid var(--ink);
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 4px 4px 0 var(--ink);
  }
  .poster-headstart-mark {
    width: 34px;
    height: 34px;
    flex: none;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.18);
    display: grid;
    place-items: center;
    font-weight: 800;
    font-size: 18px;
    transform: rotate(-7deg);
  }
  .poster-headstart-text { font-size: 17px; font-weight: 700; line-height: 1.16; }
  .poster-progress-label {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--muted);
    margin: 0 0 13px;
  }
  .poster-progress-row { display: flex; align-items: center; gap: 11px; }
  .poster-stamp {
    width: 58px;
    height: 58px;
    border-radius: 50%;
    display: grid;
    place-items: center;
  }
  .poster-stamp-wrap {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .poster-stamp-free {
    background: var(--poster-accent);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    color: #fff;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 20px;
    letter-spacing: 0.02em;
    transform: rotate(-6deg);
  }
  .poster-stamp-tag {
    position: absolute;
    bottom: -19px;
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--paper);
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 9px;
    letter-spacing: 0.14em;
    padding: 3px 8px;
    border-radius: 5px;
    white-space: nowrap;
  }
  .poster-stamp-empty {
    background: var(--card);
    border: 2px dashed rgba(33, 28, 22, 0.45);
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 22px;
    color: #bcae93;
  }
  .poster-stamp-mystery {
    background: var(--sun);
    border: 2px solid var(--ink);
    box-shadow: 3px 3px 0 var(--ink);
    color: var(--ink);
    font-weight: 800;
    font-size: 30px;
    transform: rotate(-7deg);
  }
  .poster-progress-bar {
    flex: none;
    width: 22px;
    height: 3px;
    background: var(--line);
    border-radius: 2px;
  }
  .poster-steps {
    list-style: none;
    margin: 0;
    padding: 6mm 0 0;
    display: flex;
    flex-direction: column;
    gap: 11px;
    border-top: 2px dashed var(--dashed);
  }
  .poster-steps li { display: flex; align-items: flex-start; gap: 13px; }
  .poster-step-key {
    flex: none;
    width: 30px;
    height: 30px;
    border-radius: 8px;
    background: var(--ink);
    color: var(--paper);
    font-weight: 800;
    font-size: 16px;
    display: grid;
    place-items: center;
  }
  .poster-step-copy { display: flex; flex-direction: column; line-height: 1.2; }
  .poster-step-copy strong { font-weight: 700; font-size: 16px; }
  .poster-step-copy span { font-size: 13.5px; color: var(--muted); }
  .poster-accent-text { color: var(--poster-accent-deep); font-weight: 700; }
  .poster-qr {
    flex: none;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .poster-qr-title { font-weight: 800; font-size: 19px; line-height: 1.1; margin: 0 0 12px; }
  .poster-qr-stage { position: relative; }
  .poster-seal {
    position: absolute;
    z-index: 5;
    top: -10mm;
    right: -9mm;
    width: 24mm;
    height: 24mm;
    background: var(--sun);
    clip-path: polygon(50% 0%, 60% 14%, 78% 7%, 75% 26%, 93% 24%, 82% 40%, 100% 50%, 82% 60%, 93% 76%, 75% 74%, 78% 93%, 60% 86%, 50% 100%, 40% 86%, 22% 93%, 25% 74%, 7% 76%, 18% 60%, 0% 50%, 18% 40%, 7% 24%, 25% 26%, 22% 7%, 40% 14%);
    display: grid;
    place-items: center;
    filter: drop-shadow(3px 3px 0 var(--ink));
    font-family: var(--font-mono), ui-monospace, monospace;
    font-weight: 700;
    font-size: 12px;
    line-height: 1.05;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink);
  }
  .poster-qr-ribbon {
    position: absolute;
    top: -13px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 6;
    background: var(--destructive);
    color: #fff;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 6px 13px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    box-shadow: 2px 2px 0 var(--ink);
    white-space: nowrap;
  }
  .poster-qr-frame {
    position: relative;
    width: 66mm;
    height: 66mm;
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 10px;
    box-shadow: 6px 6px 0 var(--ink);
    padding: 7mm;
    display: grid;
    place-items: center;
  }
  .poster-qr-frame img { width: 100%; height: 100%; display: block; }
  .poster-qr-overlay {
    position: absolute;
    inset: 0;
    background: rgba(246, 241, 230, 0.78);
    border-radius: 10px;
    display: grid;
    place-items: center;
  }
  .poster-qr-overlay span {
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 12px;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--destructive);
    border: 2px solid var(--destructive);
    border-radius: 999px;
    padding: 7px 15px;
    background: var(--card);
    transform: rotate(-5deg);
  }
  .poster-qr-caption { margin: 14px 0 0; font-size: 14px; font-weight: 600; color: var(--ink-soft); }
  .poster-qr-fallback {
    margin: 5px 0 0;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--muted);
  }
  .poster-qr-fallback strong { color: var(--ink); font-weight: 700; }
  .poster-footer {
    flex: none;
    margin-top: auto;
    border-top: 2px dashed var(--dashed);
    padding: 11px 13mm;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-family: var(--font-mono), ui-monospace, monospace;
    font-size: 10.5px;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .poster-footer-brand { font-weight: 700; color: var(--ink); }
`

export const POSTER_MARQUEE =
  "First stamp free  ✱  No app  ✱  Everyone wins  ✱  Scanned at the counter  ✱  " +
  "First stamp free  ✱  No app  ✱  Everyone wins  ✱"
