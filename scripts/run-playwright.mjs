#!/usr/bin/env node
import { spawnSync } from "node:child_process"

const playwrightArgs = process.argv.slice(2).filter((arg) => arg !== "--")

const result = spawnSync("playwright", ["test", ...playwrightArgs], {
  env: process.env,
  stdio: "inherit",
})

if (result.error) {
  console.error(result.error.message)
  process.exit(1)
}

process.exit(result.status ?? 1)
