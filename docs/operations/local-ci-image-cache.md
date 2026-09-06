# Verified Supabase image archives

The disposable database daemon starts empty. Supabase CLI 2.106.0 pulls about
2.14 GB of compressed ARM64 images for the enabled local stack. Slow or interrupted
registry downloads can consume the database lane's 25-minute budget before any
assertion runs. A prepared image archive removes those downloads from recurring
jobs while preserving a new daemon and database for each lane.

This is an optional host provisioning step. It does not promote the local CI
bridge, replace any test, change a timeout, or prove a successful database lane.

## Trust and lifetime

`config/local-ci-image-manifest.json` pins the 13 enabled service images by their
ARM64 registry manifest and image configuration digests. The tags come from the
[Supabase CLI 2.106.0 service template](https://github.com/supabase/cli/blob/bd39bcf5e613be87943f8bb8fe4ce75c8dfd84de/apps/cli-go/pkg/config/templates/Dockerfile).

The operator runs `ops/local-ci/host/prepare-image-cache.py` from a verified main
checkout. It downloads public GHCR blobs using bounded HTTP ranges, resumes
completed ranges after interruption, checks each complete blob against its
pinned digest, and checks every uncompressed layer against the image's `diff_ids`.
It writes a Docker-load archive and a separate pin containing the archive and
reviewed manifest hashes. It never extracts a layer onto the operator's filesystem
or executes image contents. Python 3.9 or newer and its standard library suffice.

The archive stays in the Lima VM at
`/var/lib/nabaperks-ci-images/<archive-sha256>.tar`. The root-owned Mac-side
`/opt/nabaperks-local-ci/image-cache.json` selects it. The agent verifies the
archive hash, streams it entirely within the VM into a fresh sidecar, and checks
all loaded tag identities before starting the job container. Neither container
mounts the archive directory or the VM's Docker socket. A job cannot update the
archive, and nothing is exported from a job daemon into it. Loading consumes the
lane's existing time budget.

An absent pin retains ordinary cold pulls. A configured but missing, corrupt, or
stale archive fails closed. A stale manifest pin must be reprovisioned rather than
silently ignored.

## Prepare and install

Pause the watcher at an idle job boundary using the procedure in
[the local CI runbook](local-ci.md). Do not build or replace this archive while a
qualification run owns the VM. Verify the checkout is clean and its revision is
on the repository's current main before running the preparer.

From that checkout:

```sh
python3 ops/local-ci/host/prepare-image-cache.py \
  --manifest config/local-ci-image-manifest.json \
  --output /tmp/nabaperks-ci-verified-images
```

The output directory contains resumable `blobs/`, `supabase-images.tar`, and
`supabase-images.json`. Re-running the command verifies existing blobs before
reusing them. Do not delete partial progress merely because a request failed.
Preparation may take substantially longer than a CI lane on a slow connection.

Transfer the archive without passing its bytes through a job container:

```sh
archive_sha=$(node -p 'require("/tmp/nabaperks-ci-verified-images/supabase-images.json").archiveSha256')
limactl copy /tmp/nabaperks-ci-verified-images/supabase-images.tar \
  nabaperks-ci:/tmp/nabaperks-ci-images.tar
limactl shell nabaperks-ci -- sudo install -d -m 0755 /var/lib/nabaperks-ci-images
limactl shell nabaperks-ci -- sudo install -m 0444 \
  /tmp/nabaperks-ci-images.tar "/var/lib/nabaperks-ci-images/${archive_sha}.tar"
```

Run the normal trusted installer with the additional pin argument:

```sh
sh ops/local-ci/host/install.sh --revision <verified-main-sha> \
  --image-cache-pin /tmp/nabaperks-ci-verified-images/supabase-images.json
```

The installer validates the pin against the target release's manifest and checks
the VM archive before recording it. Later installs preserve and revalidate the
pin. `LOCAL_CI_IMAGE_CACHE_PIN_FILE` can select an alternate operator-owned pin
for a one-shot diagnostic; never read it from a job checkout.

Verify a real database lane and its assertion counts after installation. Then
repeat the full main and nightly qualification, including mutation, load and
stress proof. Cache preparation alone is not a qualifying CI result.

## Update and remove

When the Supabase CLI version or enabled service images change, review the
manifest against the new CLI service template, resolve new ARM64 manifest and
configuration digests, rebuild the archive and install the new pin together.
The preparer's deterministic tar metadata makes identical verified inputs
reproducible; the pin still records the actual output hash on each host.

At an idle boundary, removing the root-owned Mac pin restores cold pulls. Keep
an old archive until no installed pin refers to it; remove only that exact file
when reclaiming space. No recurring job has a cache writeback or cleanup path.
