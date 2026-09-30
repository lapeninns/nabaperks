import { build } from "esbuild"

/**
 * Loads the real `lib/merchant/reward-collection.ts` with only the merchant
 * session and the Supabase client factories substituted. `state.user` and
 * `state.merchant` model the session; `state.responses[rpc]` answers RPCs.
 */
export async function loadRewardScanLoader() {
  const result = await build({
    stdin: {
      contents: `export { loadMerchantRewardScanContext } from "./lib/merchant/reward-collection.ts"; export { state } from "fixture-state";`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    logLevel: "silent",
    plugins: [
      {
        name: "reward-scan-loader-boundaries",
        setup(build) {
          build.onResolve(
            {
              filter:
                /^(fixture-state|server-only|@\/lib\/supabase\/server|@\/lib\/auth\/session)$/,
            },
            ({ path }) => ({ path, namespace: "fixture" })
          )
          build.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
            contents: {
              "fixture-state": `export const state = { user: { id: "owner-1" }, merchant: { id: "merchant-1" }, responses: {}, calls: [] };`,
              "server-only": "",
              "@/lib/auth/session": `import {state} from "fixture-state";
export async function getCurrentUser() { return state.user }
export async function getCurrentMerchant() { return state.user ? state.merchant : null }`,
              "@/lib/supabase/server": `import {state} from "fixture-state";
function client() { return { async rpc(name, args) { state.calls.push(name); return state.responses[name] ?? { data: null, error: { message: "unexpected rpc " + name } } } } }
export async function createSupabaseServerClient() { return client() }
export function createSupabaseServiceRoleClient() { return client() }`,
            }[path],
          }))
        },
      },
    ],
  })
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}#${crypto.randomUUID()}`
  )
}
