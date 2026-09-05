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
The signing-key download was blocked by Chrome and is awaiting operator
recovery. No installation token has been minted or tested, and no App credential
has entered the VM. App registration is not proof of agent authentication.

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

## Remaining proof

After the provisioning fix merges, recreate the VM from the committed template
and repeat the complete isolation checks. Then build the job image for the
first time, verify the signing key and installation token, install the reviewed
agent, and run real jobs. Keep `LOCAL_CI_MODE` unset until those prerequisites
are met. Dual-run comparison and per-lane routing still need the additive
implementation described by the cutover specification before shadow
qualification can establish three consecutive equivalent SHAs.

The Dockerfile has not been built, the agent has not polled GitHub, and no
end-to-end local CI or recovery rehearsal has passed. No hosted lane or merge
dependency was changed by this provisioning fix.
