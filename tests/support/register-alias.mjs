/**
 * Registers the `@/*` resolve hook for the unit-test runner. Passed to node via
 * `--import` (see the `test:unit` script) so it is active before any test module
 * is imported.
 */
import { register } from "node:module"
import { pathToFileURL } from "node:url"

register("./alias-hook.mjs", pathToFileURL(import.meta.filename))
