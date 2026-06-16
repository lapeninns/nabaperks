import {
  CUSTOMER_FLOW_DEMO,
  isCustomerFlowCommand,
  normalizeDemoPhone,
  type CustomerFlowCommandInput,
  type CustomerFlowCommandResult,
} from "./customer-flow-demo-types.ts"
import { runCustomerFlowCommand } from "./customer-flow-demo-db.ts"
import { CustomerFlowDemoError } from "./customer-flow-demo-error.ts"

type ParsedCustomerFlowArgs =
  | (CustomerFlowCommandInput & { readonly json?: true })
  | {
      readonly command: "advance"
      readonly phone: string
      readonly stamps: number
      readonly json?: true
    }

export function parseCustomerFlowArgs(
  argv: readonly string[]
): ParsedCustomerFlowArgs {
  const command = argv[0] ?? "status"

  if (!isCustomerFlowCommand(command)) {
    throw new CustomerFlowDemoError(
      usage(`Unknown customer-flow command: ${command}`)
    )
  }

  const phone = normalizeDemoPhone(
    readOption(argv, "--phone") ?? CUSTOMER_FLOW_DEMO.phone
  )
  const withJson = argv.includes("--json") ? { json: true as const } : {}

  if (command !== "advance") return { command, phone, ...withJson }

  const stamps = Number(readOption(argv, "--stamps") ?? "")
  if (!Number.isInteger(stamps) || stamps < 0 || stamps > 2) {
    throw new CustomerFlowDemoError(
      "Advance stamp count must be between 0 and 2."
    )
  }

  return { command, phone, stamps, ...withJson }
}

export async function main(argv: readonly string[]): Promise<void> {
  const args = parseCustomerFlowArgs(argv)
  const result = await runCustomerFlowCommand(args)
  writeResult(args, result)
}

function writeResult(
  args: ParsedCustomerFlowArgs,
  result: CustomerFlowCommandResult
): void {
  if (args.json) {
    console.log(JSON.stringify(result, null, 2))
    return
  }

  console.log(
    "message" in result
      ? result.message
      : `Customer flow ${args.command} complete.`
  )
  console.log(JSON.stringify(result, null, 2))
}

function readOption(argv: readonly string[], name: string): string | null {
  const index = argv.indexOf(name)
  if (index === -1) return null

  return argv[index + 1] ?? null
}

function usage(message: string): string {
  return `${message}
Usage:
  pnpm customer-flow:reset --phone 07467586751
  pnpm customer-flow:status --phone 07467586751 [--json]
  pnpm customer-flow:advance --phone 07467586751 --stamps 1
  pnpm customer-flow:remove-stamp --phone 07467586751
  pnpm customer-flow:make-redeemable --phone 07467586751`
}
