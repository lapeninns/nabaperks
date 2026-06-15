// Structured, provider-agnostic logger. Emits one JSON line per event so Vercel
// log drains (and any downstream collector such as PostHog or an OTel pipeline)
// can parse level, message, and contextual fields — including the request id —
// without bespoke regexes. Kept dependency-free so it runs in any runtime.

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = Record<string, unknown>

const CONSOLE: Record<LogLevel, (line: string) => void> = {
  debug: (line) => console.debug(line),
  info: (line) => console.info(line),
  warn: (line) => console.warn(line),
  error: (line) => console.error(line),
}

function serializeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack }
  }
  return value
}

function buildRecord(
  level: LogLevel,
  message: string,
  base: LogContext,
  context: LogContext
): Record<string, unknown> {
  const record: Record<string, unknown> = {
    level,
    time: new Date().toISOString(),
    message,
  }
  for (const [key, value] of Object.entries({ ...base, ...context })) {
    record[key] = serializeValue(value)
  }
  return record
}

export type Logger = {
  readonly context: LogContext
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
  child(context: LogContext): Logger
}

/** Creates a logger whose `base` context is merged into every record it emits. */
export function createLogger(base: LogContext = {}): Logger {
  function emit(level: LogLevel, message: string, context: LogContext = {}) {
    CONSOLE[level](JSON.stringify(buildRecord(level, message, base, context)))
  }

  return {
    context: base,
    debug: (message, context) => emit("debug", message, context),
    info: (message, context) => emit("info", message, context),
    warn: (message, context) => emit("warn", message, context),
    error: (message, context) => emit("error", message, context),
    child: (context) => createLogger({ ...base, ...context }),
  }
}

/** Default application logger; prefer `logger.child({ requestId })` per request. */
export const logger = createLogger({ service: "nabaperks" })
