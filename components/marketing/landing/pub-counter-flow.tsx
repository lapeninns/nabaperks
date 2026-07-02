import { ContrastBand } from "@/components/layout"

export const pubCounterFlowSteps = [
  {
    step: "Step 01",
    title: "Scan",
    body: "A regular scans the permanent QR on the bar — the loyalty card opens in their phone browser.",
  },
  {
    step: "Step 02",
    title: "Save",
    body: "Saved in one tap, in the browser. No app, no Apple or Google Wallet pass, no plastic card to lose.",
  },
  {
    step: "Step 03",
    title: "Stamp",
    body: "They tap to claim. The counter-verified stamp checks your QR, their card and the one-stamp-per-day rule before it counts.",
  },
  {
    step: "Step 04",
    title: "Reward",
    body: "A full card unlocks a clear reward, redeemed at the bar. Your weekly digest shows who is coming back.",
  },
] as const

export function PubCounterFlow() {
  return (
    <ContrastBand id="how-it-fits">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[24ch]">
          <p className="mono-meta tracking-[0.1em] text-seal">
            How it works
          </p>
          <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.125rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
            Scan, save, stamp, reward — behind the bar.
          </h2>
        </div>
        <p className="max-w-[42ch] text-[0.95rem] leading-relaxed text-pretty text-paper/70 sm:text-base">
          Your team keeps pouring while regulars stamp on their own phones.
          Nothing to install, nothing new to learn on a busy shift.
        </p>
      </div>

      <ol className="mt-8 grid grid-cols-2 gap-x-5 gap-y-6 lg:grid-cols-4">
        {pubCounterFlowSteps.map((item) => (
          <li
            key={item.step}
            className="border-t-2 border-dashed border-paper/30 pt-4"
          >
            <p className="mono-meta tracking-[0.1em] text-seal">
              {item.step}
            </p>
            <h3 className="mt-2 text-2xl font-extrabold">{item.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-paper/65">
              {item.body}
            </p>
          </li>
        ))}
      </ol>
    </ContrastBand>
  )
}
