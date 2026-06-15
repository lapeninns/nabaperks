#!/usr/bin/env node
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

export {
  demoPhoneHmac,
  main,
  normalizeDemoPhone,
  parseCustomerFlowArgs,
} from "./customer-flow-demo-lib.mjs"

import { main } from "./customer-flow-demo-lib.mjs"

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
