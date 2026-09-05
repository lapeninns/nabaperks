# Local CI provisioning evidence — 2026-09-05

This records the first hardware provisioning attempt after PR #238 merged as
`292db876c8b83d344a66ddaca6d7142bf3741b98`. It is not shadow qualification.

## Verified before provisioning

- PR #238 received an explicitly authorised AI-assisted approval under
  `amanshresthaa` and merged through the normal repository rules.
- The late-proof rerun discussion was resolved as an accepted step-1 deferral,
  not as remediation. Runbook section 5.3 still describes the missing call site.
- Hosted PR checks finished with 173 successes and one skip. A preceding
  Lighthouse home run failed LCP at 4,232 ms against 4,000 ms; the single retry
  passed without a code or budget change. This does not prove repeatability.
- The step-1 workflow change was exactly 80 insertions and zero deletions.
  `Release gate` still required exactly `fast` and `build`. Both deliberate
  interlock mutations failed, with an unmodified control passing.
- Baseline local checks passed: 684 contracts, 1,284 unit tests, typecheck,
  scoped ESLint, debt, agent docs, dead code, duplication and generated docs.

## GitHub App installation

The GitHub settings and installation pages showed:

| Property                | Observed value                                                      |
| ----------------------- | ------------------------------------------------------------------- |
| Owner                   | `lapeninns`                                                         |
| Name / slug             | `Nabaperks Local CI` / `nabaperks-local-ci`                         |
| App ID                  | `4839346`                                                           |
| Installation ID         | `159244911`                                                         |
| Repository / ID         | `lapeninns/nabaperks` / `1268458916`                                |
| Repository selection    | Selected repositories, exactly one                                  |
| Permissions             | Actions and Checks write; Contents, Pull requests and Metadata read |
| Webhook                 | Inactive                                                            |
| Installation visibility | Only on the owner's account                                         |

These non-secret identifiers are pinned in `config/local-ci-contract.json`.
The initial signing-key download was blocked by Chrome. The operator then
downloaded the key; it was restricted to mode `0600` on the Mac. The real
client minted an installation token, verified App ID `4839346` and slug
`nabaperks-local-ci`, and read `heads/main` from `lapeninns/nabaperks`.
The key and token were not printed, and no App credential entered the VM.

## First VM attempt

The Apple silicon host reported 18 CPU cores, 64 GiB RAM and approximately
495 GiB free disk. Homebrew installed Lima 2.2.0. The committed template created
`nabaperks-ci` with 12 vCPU, 40 GiB RAM and a 150 GiB disk, using VZ and the
Ubuntu 24.04 ARM64 cloud image.

Read-only guest inspection found no host filesystem mounts, no `/Users`, no
Rosetta mount and no forwarded SSH agent. Docker Engine 27.5.1 and the
`DOCKER-USER` inbound DROP rule were installed. **The VM failed qualification:**

1. The firewall provisioning script failed its package installation. A real
   `apt-get --simulate install` reported that `ufw` breaks both
   `iptables-persistent` and `netfilter-persistent`. UFW remained inactive.
2. The initial SSH session lacked Docker group membership even after
   `usermod` had added the user to the group; `getent group docker` and `id`
   showed the difference. Docker access from that session was denied.
3. `ufw status` from the guest user failed because root privileges are required.
   The readiness probe used that unprivileged command.

The failed VM was stopped without running repository workloads. The fix removes
the conflicting persistence packages, uses non-interactive sudo for readiness,
checks the actual inbound rule, and documents restarting once after first boot
to refresh the SSH session's supplementary groups. The revised package set
resolved in the real guest's apt simulation. Fresh-instance validation remains
pending; source contracts alone cannot prove the fix works at boot.

## Source verification of the provisioning change

Lima template validation, 685 contract tests, 1,285 unit tests, typecheck,
scoped ESLint, debt, agent docs, dead code, duplication and generated-doc checks
passed. Unit fixtures now model the unprovisioned state explicitly; bridge and
repository-routing fixtures use the configured identifiers. A regression test
accepts the configured App ID and rejects a different ID with the same slug.
None of these offline checks establishes fresh-boot or credential readiness.

## Fresh VM validation after PR #239

PR #239 merged as `9fb41d6cbc8f198b0a7d3102b91483ef54f55d11`. Its latest hosted
checks finished with 173 successes and one skip. Lighthouse home initially
failed at 4,230 ms against 4,000 ms; one retry passed on the same commit without
changing code or budgets. The merge commit's Release gate also passed.

The failed VM was deleted and recreated from that merged template. First boot
completed with cloud-init exit code 0 and every Lima readiness check satisfied.
After the documented stop/start, live inspection verified:

- UFW active, default incoming and routed traffic denied, outgoing allowed.
- SSH admitted only from the Lima gateway; loopback traffic admitted.
- The external-interface `DOCKER-USER` rule drops NEW inbound connections.
- The guard's systemd service is active and enabled.
- Unprivileged Docker access works; Engine 27.5.1 reports `aarch64`.
- No `/Users`, Rosetta, forwarded SSH agent, virtiofs or 9p host mounts.

A credential-free clone inside the VM matched the merged SHA. The first image
build then failed because five apt version pins were unavailable. The host
README records the archive candidates used in the diagnostic rebuild. That
build uses the merged Dockerfile with explicit version arguments; it does not
install unmerged agent code. A diagnostic image is not the installed job image.

## Image runtime validation

The apt refresh produced a complete diagnostic image. Its smoke check verified
UID 501 / GID 1000 workspace ownership, writable pnpm stores, no daemon socket,
and Python imports from the print-kit virtualenv. It also exposed an unexpected
pnpm 11.25.0 selection outside a project, despite the declared 10.28.0 pin.
Inspection found Corepack's per-user last-known-good version was 11.25.0 after
the build removed root's cache.

The candidate Dockerfile retains Corepack in `/opt/corepack`, disables implicit
latest-version selection, and asserts pnpm's version as the unprivileged user.
A diagnostic build of that candidate completed inside the isolated VM using
only the merged dependency manifests as its build context. Its smoke checks
passed with networking disabled: pnpm resolved to 10.28.0 both outside a project
and in the merged repository, the workspace identity remained 501:1000, the
cache was writable, and the Python virtualenv imports succeeded. No candidate
image or unmerged agent was installed as the execution plane.

## Remaining proof

Complete the job-image build, merge any image fixes through normal review,
rebuild from the merged commit, install the reviewed agent with its heartbeat
monitor, and run real jobs. Keep `LOCAL_CI_MODE` unset until those prerequisites
are met. Dual-run comparison and per-lane routing still need the additive
implementation described by the cutover specification before shadow
qualification can establish three consecutive equivalent SHAs.

The candidate image build and offline smoke checks passed, but the agent has
not polled GitHub and no
end-to-end local CI or recovery rehearsal has passed. No hosted lane or merge
dependency was changed by this provisioning fix.
