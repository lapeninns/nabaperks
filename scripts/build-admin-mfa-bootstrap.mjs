import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import { build } from "esbuild"

const APPROVED_ORIGIN = "https://mfa.nabaperks.com"

export async function buildAdminMfaBootstrap({
  outputDirectory,
  projectRef,
  supabaseAnonKey,
}) {
  if (!/^[a-z0-9]{20}$/.test(projectRef ?? "")) {
    throw new Error("A valid Supabase project reference is required.")
  }
  if (typeof supabaseAnonKey !== "string" || supabaseAnonKey.length < 20) {
    throw new Error("A Supabase browser key is required.")
  }

  const root = resolve(outputDirectory)
  const staticDirectory = resolve(root, "static")
  const pageDirectory = resolve(staticDirectory, "admin-mfa-bootstrap")
  const assetDirectory = resolve(staticDirectory, "assets")
  await Promise.all([
    mkdir(pageDirectory, { recursive: true }),
    mkdir(assetDirectory, { recursive: true }),
  ])

  const supabaseUrl = `https://${projectRef}.supabase.co`
  const configScript = `globalThis.__ADMIN_MFA_BOOTSTRAP_CONFIG__=${JSON.stringify(
    {
      supabaseUrl,
      supabaseAnonKey,
    }
  )};`
  await build({
    absWorkingDir: fileURLToPath(new URL("..", import.meta.url)),
    bundle: true,
    define: { "process.env.NODE_ENV": '"production"' },
    entryPoints: ["scripts/admin-mfa-bootstrap-entry.mjs"],
    format: "iife",
    minify: true,
    outfile: resolve(assetDirectory, "bootstrap.js"),
    platform: "browser",
    target: ["es2022"],
  })

  await writeFile(resolve(staticDirectory, "config.js"), configScript, {
    mode: 0o600,
  })
  await writeFile(resolve(pageDirectory, "index.html"), page(supabaseUrl))
  await writeFile(
    resolve(root, "config.json"),
    `${JSON.stringify({
      version: 3,
      routes: [
        {
          src: "/admin-mfa-bootstrap/?",
          dest: "/admin-mfa-bootstrap/index.html",
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
          },
        },
        { handle: "filesystem" },
      ],
    })}\n`
  )
}

function page(supabaseUrl) {
  const contentSecurityPolicy = [
    "default-src 'none'",
    "base-uri 'none'",
    `connect-src ${supabaseUrl}`,
    "form-action 'self'",
    "frame-ancestors 'none'",
    "script-src 'self'",
    "style-src 'unsafe-inline'",
  ].join("; ")
  return `<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="${contentSecurityPolicy}">
    <title>Nabaperks administrator security setup</title>
    <style>
      :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f5f1e8;color:#211f1b}
      *{box-sizing:border-box}body{margin:0;min-height:100svh;display:grid;place-items:center;padding:24px}
      main{width:min(100%,440px);background:#fffdf8;border:1px solid #d9d1c1;border-radius:20px;padding:28px;box-shadow:0 16px 48px #302a1a1a}
      p{line-height:1.55;color:#595247}label{display:grid;gap:8px;margin:20px 0;font-weight:700}
      input,button{width:100%;font:inherit;border-radius:12px;padding:12px 14px}input{border:1px solid #aaa08e;background:white}
      button{border:0;background:#173f35;color:white;font-weight:800;cursor:pointer}button:disabled{opacity:.6;cursor:wait}
      #status[data-error="true"]{color:#a02924}small{display:block;margin-top:20px;color:#6a6255}
    </style>
    <script src="/config.js"></script>
    <script type="module" src="/assets/bootstrap.js"></script>
  </head>
  <body>
    <main>
      <p>Protected administrator setup</p>
      <h1>Set up your security key</h1>
      <p>This one-time page enrols a passkey or hardware security key. It does not grant administrator authority; a separate protected activation is required.</p>
      <form>
        <label>Administrator email<input id="email" type="email" autocomplete="email" required></label>
        <label hidden>Email sign-in code<input id="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}"></label>
        <button id="primary-action" type="submit">Send sign-in code</button>
      </form>
      <p id="status" role="status" aria-live="polite"></p>
      <small>Available only on ${APPROVED_ORIGIN}.</small>
    </main>
  </body>
</html>`
}

async function main(args) {
  const outputIndex = args.indexOf("--output")
  if (outputIndex < 0 || !args[outputIndex + 1]) {
    throw new Error("--output is required")
  }
  await buildAdminMfaBootstrap({
    outputDirectory: args[outputIndex + 1],
    projectRef: process.env.SUPABASE_PROJECT_REF,
    supabaseAnonKey: process.env.ADMIN_MFA_BOOTSTRAP_ANON_KEY,
  })
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main(process.argv.slice(2))
}
