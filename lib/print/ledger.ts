import type { BoxMm } from "./box"
import type { Ledger, Mark } from "./ledger-types"

export type LedgerBuilder = {
  defineContainer(name: string, box: BoxMm): void
  add(mark: Mark): void
  snapshot(): Ledger
}

export function createLedger(): LedgerBuilder {
  const marks: Mark[] = []
  const containers = new Map<string, BoxMm>()

  return {
    defineContainer(name, box) {
      if (containers.has(name)) {
        throw new Error(`Container ${name} is already defined`)
      }
      containers.set(name, box)
    },
    add(mark) {
      if (!containers.has(mark.container)) {
        throw new Error(
          `Mark ${mark.label} names unknown container ${mark.container}`
        )
      }
      marks.push(mark)
    },
    snapshot() {
      return { marks: [...marks], containers: new Map(containers) }
    },
  }
}
