import { createHash } from "node:crypto"
import manifest from "../../../config/local-ci-image-manifest.json" with { type: "json" }
import { LocalCiError } from "./contract.mjs"

export const IMAGE_CACHE_MANIFEST = manifest
export const IMAGE_CACHE_MANIFEST_SHA256 = createHash("sha256")
  .update(JSON.stringify(manifest))
  .digest("hex")
export const IMAGE_CACHE_ROOT = "/var/lib/nabaperks-ci-images"
export const IMAGE_CACHE_LOAD_TIMEOUT_MS = 600_000

/** A host pin, never a value read from a job checkout or job output. */
export function parseImageCachePin(value) {
  if (value === null || value === undefined) return null
  let pin
  try {
    pin = typeof value === "string" ? JSON.parse(value) : value
  } catch {
    throw new LocalCiError(
      "INVALID_IMAGE_CACHE",
      "image archive pin is not JSON"
    )
  }
  if (
    !pin ||
    typeof pin.archiveSha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(pin.archiveSha256 ?? "") ||
    pin.manifestSha256 !== IMAGE_CACHE_MANIFEST_SHA256
  ) {
    throw new LocalCiError(
      "INVALID_IMAGE_CACHE",
      "image archive pin is invalid or belongs to a different reviewed Supabase image manifest; prepare the current manifest before installing its pin"
    )
  }
  return Object.freeze({
    archiveSha256: pin.archiveSha256,
    manifestSha256: pin.manifestSha256,
  })
}

// The entire stream stays inside the VM. No archive, daemon socket, or cache
// directory is mounted into either container. Verify before parsing the tar;
// verify the loaded tag identities before any repository command can execute.
const LOAD_SCRIPT = `set -eu
docker_command=$1
daemon_name=$2
archive_file=$3
archive_sha=$4
shift 4
test ! -L "$archive_file"
test -f "$archive_file"
actual_sha=$(sha256sum "$archive_file")
test "\${actual_sha%% *}" = "$archive_sha"
"$docker_command" exec -i "$daemon_name" docker image load < "$archive_file"
while [ "$#" -gt 0 ]; do
  image_tag=$1
  image_id=$2
  shift 2
  actual_id=$("$docker_command" exec "$daemon_name" docker image inspect --format '{{.Id}}' "$image_tag")
  test "$actual_id" = "$image_id"
done
`

export function buildImageCacheLoadArgv({
  pin,
  vm,
  daemonName,
  docker = "docker",
  limactl = "limactl",
}) {
  const checked = parseImageCachePin(pin)
  if (!checked || typeof vm !== "string" || !vm.trim()) {
    throw new LocalCiError(
      "INVALID_IMAGE_CACHE",
      "image preloading requires a pin and an isolated VM"
    )
  }
  if (
    !/^nabaperks-ci-dind-[a-f0-9]{12}-[a-z0-9-]+-[1-9][0-9]*$/.test(daemonName)
  ) {
    throw new LocalCiError(
      "INVALID_IMAGE_CACHE",
      "image preloading requires an owned sidecar name"
    )
  }
  return [
    limactl,
    "shell",
    vm,
    "--",
    "/bin/sh",
    "-c",
    LOAD_SCRIPT,
    "image-cache-load",
    docker,
    daemonName,
    `${IMAGE_CACHE_ROOT}/${checked.archiveSha256}.tar`,
    checked.archiveSha256,
    ...manifest.images.flatMap(({ tag, configDigest }) => [tag, configDigest]),
  ]
}
