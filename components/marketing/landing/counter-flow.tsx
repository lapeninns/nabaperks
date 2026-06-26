const steps = [
  {
    step: "Step 01",
    title: "Scan",
    body: "The permanent venue QR opens the card in the phone browser.",
  },
  {
    step: "Step 02",
    title: "Save",
    body: "One quick check saves the card. No app, password, or plastic card.",
  },
  {
    step: "Step 03",
    title: "Stamp",
    body: "The customer taps to claim. The server checks the QR, UK date, billing status, and optional GPS signals.",
  },
  {
    step: "Step 04",
    title: "Reward",
    body: "Customers unlock a clear reward and collect it in-store.",
  },
] as const

/**
 * Counter flow — the four-beat "how it works", set on a full-bleed contrast band
 * (the same inverted ink/paper as the marquee, so it stays legible in either
 * theme). Mobile-first: the steps stack, pair up at `sm`, and form one row at
 * `lg`. `scroll-mt` clears the sticky header when the hero's anchor jumps here.
 */
export function CounterFlow() {
  return (
    <section
      id="how-it-works"
      className="my-14 scroll-mt-24 border-y-2 border-ink bg-ink text-paper sm:my-20"
    >
      <div className="mx-auto w-full max-w-6xl px-6 py-14 sm:py-16">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-[22ch]">
            <p className="font-mono text-[0.72rem] font-bold tracking-[0.1em] text-primary uppercase">
              How it works
            </p>
            <h2 className="mt-3 text-[clamp(2rem,4.6vw,3.125rem)] leading-[1.0] font-extrabold tracking-[-0.02em] text-balance">
              Scan, save, stamp, reward.
            </h2>
          </div>
          <p className="max-w-[42ch] text-[0.95rem] leading-relaxed text-pretty text-paper/70 sm:text-base">
            Your team keeps the queue moving while customers stamp on their own
            phones. Every loyalty action stays server-side and auditable.
          </p>
        </div>

        <ol className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((item) => (
            <li
              key={item.step}
              className="border-t-2 border-dashed border-paper/30 pt-4"
            >
              <p className="font-mono text-[0.7rem] font-bold tracking-[0.1em] text-primary uppercase">
                {item.step}
              </p>
              <h3 className="mt-2 text-2xl font-extrabold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-paper/65">
                {item.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
