// Keeps every test file order-independent under `--sequence.shuffle`.
//
// Vitest keeps `vi.doMock` registrations alive across `vi.resetModules()` — only
// `vi.doUnmock` clears them. Because the tests in a file share one module
// registry, a module mocked in one test leaks into any later test that imports
// the same module: harmless while tests run in file order, but a failure the
// moment shuffling runs the importer after the mocker (e.g. a leaked
// `@/lib/qr/assets` or `@/lib/analytics/events` mock returning the wrong shape).
//
// Rather than hand-maintain a `vi.doUnmock` list in every file (easy to forget,
// which is how the coupling crept in), we wrap `vi.doMock` so it records every
// mocked path, then unregister them all after each test. Each file is therefore
// order-independent by construction, and new tests are covered automatically.
//
// `vi.mock` is deliberately not wrapped: it is hoisted and file-scoped, so it
// cannot leak between tests the way the runtime `vi.doMock` registry does.
import { afterEach, vi } from "vitest"

const mockedPaths = new Set<string>()
const originalDoMock = vi.doMock.bind(vi)

vi.doMock = ((path: unknown, factory?: unknown) => {
  if (typeof path === "string") {
    mockedPaths.add(path)
  }

  return (originalDoMock as (p: unknown, f?: unknown) => unknown)(path, factory)
}) as typeof vi.doMock

afterEach(() => {
  for (const path of mockedPaths) {
    vi.doUnmock(path)
  }

  mockedPaths.clear()
  vi.resetModules()
})
