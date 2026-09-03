import assert from "node:assert/strict"
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  checkCredentialBackups,
  forbiddenCredentialBackupNames,
} from "../../scripts/check-credential-backups.mjs"

test("credential backup policy rejects the reported files and alternate backup spellings", () => {
  assert.deepEqual(
    forbiddenCredentialBackupNames([
      ".env.local.hosted-backup",
      ".env.vercel-production",
      ".env.local.bak",
      ".env.local.backup.20260902",
      ".env.local.backup~",
      ".env.local.old",
      ".env.production.backup",
      ".env.staging-BACKUP",
      ".ENV.VERCEL-PRODUCTION",
    ]),
    [
      ".env.local.backup.20260902",
      ".env.local.backup~",
      ".env.local.bak",
      ".env.local.hosted-backup",
      ".env.local.old",
      ".env.production.backup",
      ".env.staging-BACKUP",
      ".env.vercel-production",
      ".ENV.VERCEL-PRODUCTION",
    ]
  )
})

test("credential backup policy checks nested files, symlinks, and matching directories", async () => {
  const root = await mkdtemp(
    path.join(tmpdir(), "nabaperks-credential-policy-")
  )

  try {
    await mkdir(path.join(root, "nested", "deeper"), { recursive: true })
    await mkdir(path.join(root, "nested", ".env.preview.backup"))
    await writeFile(path.join(root, "nested", "deeper", ".env.staging.old"), "")
    await writeFile(path.join(root, "safe-target"), "")
    await symlink("safe-target", path.join(root, ".env.local.backup~"))

    assert.deepEqual(await checkCredentialBackups(root), [
      ".env.local.backup~",
      path.join("nested", ".env.preview.backup"),
      path.join("nested", "deeper", ".env.staging.old"),
    ])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("credential backup policy preserves supported environment files", () => {
  assert.deepEqual(
    forbiddenCredentialBackupNames([
      ".env",
      ".env.development",
      ".env.example",
      ".env.local",
      ".env.production",
      ".env.test.local",
    ]),
    []
  )
})
