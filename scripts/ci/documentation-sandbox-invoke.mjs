import assert from "node:assert/strict"

// This file is mounted read-only from the reviewed verifier checkout, after
// dependency preparation. Candidate code cannot replace it or its interpreter.
// This external module exists inside the container, not in the host checkout.
const checker = new URL(
  "scripts/ci/documentation-checks.mjs",
  "file:///candidate/"
)
const { runDocumentation } = await import(checker.href)
const paths = JSON.parse(process.argv[2])
assert.ok(Array.isArray(paths) && paths.length > 0 && paths.length <= 200)
for (const path of paths)
  assert.ok(
    typeof path === "string" &&
      !path.startsWith("/") &&
      !path.split("/").includes("..")
  )
runDocumentation(
  {
    profile: "public-pages",
    required: ["documentation"],
    changes: paths.map((path) => ({ path, status: "M" })),
  },
  { cwd: "/candidate" }
)
