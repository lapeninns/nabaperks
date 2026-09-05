#!/bin/bash
#
# install.sh - provision the Nabaperks local CI agent on this Mac.
#
# Idempotent: running it twice in a row is a no-op apart from re-registering
# the launchd job. Safe to re-run after every agent change on main.
#
# What it does, in order:
#   1. Refuses to run as root, on a non-macOS host, or on a non-ARM64 Mac.
#   2. Proves the revision it is about to install is a reviewed main commit:
#      correct remote, clean working tree, HEAD an ancestor of origin/main, and
#      the installed revision an ancestor of origin/main too. The agent is
#      NEVER installed from pull-request code.
#   3. Proves the credential directory is a safe place for a private key:
#      inside $HOME, not inside the repository, not inside the install root,
#      not on a mounted volume, not under a world-writable ancestor, and not
#      reachable from the Lima VM (which is asserted to have zero mounts).
#      Symlinks are resolved first, so the checks see the real target.
#   4. Places the GitHub App private key and the optional monitoring heartbeat URL at
#      mode 0600 in that directory.
#   5. Asserts the Lima instance's isolation properties.
#   6. Pins the job image tag the agent will run, and proves the image exists
#      inside the VM. Without this the launchd job starts, fails to resolve
#      LOCAL_CI_JOB_IMAGE and is restarted by KeepAlive forever.
#   7. Extracts the verified revision into /opt/nabaperks-local-ci/releases/<sha>
#      and repoints /opt/nabaperks-local-ci/current at it atomically.
#   8. Creates the log directory and its newsyslog rotation policy.
#   9. Installs and bootstraps the launchd agent.
#
# Usage:
#   ops/local-ci/host/install.sh [options]
#
#   --revision REV              Install this revision instead of HEAD. It must
#                               still be an ancestor of origin/main. This is
#                               how a rollback works: name the previous sha.
#   --job-image TAG             Pin the job image the agent runs, e.g.
#                               nabaperks-ci-job:<commit sha>. Kept across
#                               re-runs, so it is needed once.
#   --github-app-key PATH       Copy this PEM in as the GitHub App private key.
#   --heartbeat-url-file PATH   Copy this file in as the optional monitoring heartbeat
#                               URL. A file, never a --flag value: an argument
#                               is visible to every process on the machine via
#                               `ps` and is recorded in shell history.
#   --skip-vm-check             Skip the Lima instance assertions (use only
#                               when provisioning the agent before the VM).
#                               --job-image then has to be given by hand.
#   -h, --help                  Show this help.

set -euo pipefail

LABEL="com.nabaperks.local-ci"
VM_NAME="nabaperks-ci"
INSTALL_ROOT="/opt/nabaperks-local-ci"
EXPECTED_REMOTE="https://github.com/lapeninns/nabaperks.git"
AGENT_RELATIVE_PATH="ops/local-ci/agent/main.mjs"
LIMA_RELATIVE_PATH="ops/local-ci/host/lima-nabaperks-ci.yaml"
KEY_FILE="github-app-private-key.pem"
HEARTBEAT_FILE="uptimerobot-heartbeat-url"
JOB_IMAGE_FILE="${INSTALL_ROOT}/job-image"
JOB_IMAGE_REPOSITORY="nabaperks-ci-job"
RELEASES_TO_KEEP=5

github_app_key_src=""
heartbeat_url_file_src=""
revision_arg=""
job_image_arg=""
skip_vm_check="no"
scratch=""

die() {
  printf 'install.sh: %s\n' "$1" >&2
  exit 1
}

note() {
  printf '  %s\n' "$1"
}

step() {
  printf '\n==> %s\n' "$1"
}

usage() {
  # Everything from the third line up to the first line that is not a comment,
  # so the help text cannot drift out of sync with the header above it.
  awk 'NR > 2 { if ($0 !~ /^#/) exit; sub(/^# ?/, ""); print }' "$0"
}

cleanup() {
  [ -z "${scratch}" ] || rm -rf "${scratch}"
}
trap cleanup EXIT

# Resolve a path to its physical location, following symlinks in every
# component *including the last*.
#
# Resolving only `dirname` and re-appending `basename` - which this script used
# to do - inspects the apparent path. If ~/.nabaperks-local-ci is itself a
# symlink into the repository, onto a mounted volume or anywhere else the
# checks below refuse, every one of those checks passes and the App private key
# is written to the forbidden location anyway. macOS ships no `readlink -f`, so
# the trailing link is walked by hand.
#
# A path that does not exist yet resolves through its parent, because the
# credential directory is normally created by this script a few steps later.
physical_path() {
  candidate="$1"
  hops=0
  while [ -L "${candidate}" ]; do
    hops=$((hops + 1))
    [ "${hops}" -le 32 ] || die "too many symlinks while resolving '$1'"
    target="$(readlink "${candidate}")"
    case "${target}" in
      /*) candidate="${target}" ;;
      *) candidate="$(dirname "${candidate}")/${target}" ;;
    esac
  done
  if [ -d "${candidate}" ]; then
    (cd "${candidate}" && pwd -P)
    return 0
  fi
  parent="$(cd "$(dirname "${candidate}")" 2>/dev/null && pwd -P)" \
    || die "cannot resolve the parent directory of '$1'"
  printf '%s/%s\n' "${parent}" "$(basename "${candidate}")"
}

# An image reference reaches `docker run` as an argv word, so a value carrying
# whitespace, a leading dash or shell punctuation is not a typo to tolerate.
# `latest` is refused for the same reason the agent refuses it: a floating tag
# lets a rebuild change what executes without changing anything reviewable.
validate_job_image() {
  case "$1" in
    "") die "the job image tag is empty" ;;
    -*) die "the job image tag may not begin with '-': '$1'" ;;
    *[!A-Za-z0-9._/:@-]*) die "the job image tag contains characters that are not allowed in an image reference: '$1'" ;;
  esac
  case "$1" in
    *:latest | latest) die "refusing the floating tag 'latest'. Pin the image to the commit it was built from, e.g. ${JOB_IMAGE_REPOSITORY}:\$(git rev-parse HEAD)." ;;
  esac
  case "$1" in
    *:* | *@*) ;;
    *) die "the job image must be pinned to an explicit tag or digest, got '$1'" ;;
  esac
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --revision)
      [ "$#" -ge 2 ] || die "--revision needs a git revision"
      revision_arg="$2"
      shift 2
      ;;
    --job-image)
      [ "$#" -ge 2 ] || die "--job-image needs an image tag"
      job_image_arg="$2"
      shift 2
      ;;
    --github-app-key)
      [ "$#" -ge 2 ] || die "--github-app-key needs a path"
      github_app_key_src="$2"
      shift 2
      ;;
    --heartbeat-url-file)
      [ "$#" -ge 2 ] || die "--heartbeat-url-file needs a path"
      heartbeat_url_file_src="$2"
      shift 2
      ;;
    --heartbeat-url)
      die "refusing --heartbeat-url: a URL passed as an argument is visible in \`ps\` and shell history. Write it to a file and pass --heartbeat-url-file."
      ;;
    --skip-vm-check)
      skip_vm_check="yes"
      shift
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

# --------------------------------------------------------------- 1. host gate
step "Checking the host"

[ "$(id -u)" -ne 0 ] || die "refusing to run as root. Run as the operator who will own the launchd agent; the few privileged steps escalate with sudo individually."
[ "${SUDO_USER:-}" = "" ] || die "refusing to run under sudo. Run as yourself: ops/local-ci/host/install.sh"
[ "$(uname -s)" = "Darwin" ] || die "this installer targets macOS; the Linux side is provisioned by the Lima template."
[ "$(uname -m)" = "arm64" ] || die "this installer targets Apple silicon. The Lima template builds an ARM64 guest."
command -v git >/dev/null 2>&1 || die "git is not on PATH"
command -v sudo >/dev/null 2>&1 || die "sudo is not on PATH"

note "macOS $(sw_vers -productVersion) on $(uname -m), running as $(id -un)"

# ------------------------------------------------------- 2. verified revision
step "Verifying the revision to install is a reviewed main commit"

script_dir="$(cd "$(dirname "$0")" && pwd -P)"
repo_root="$(cd "${script_dir}/../../.." && pwd -P)"
[ -d "${repo_root}/.git" ] || die "${repo_root} is not a git working tree"

actual_remote="$(git -C "${repo_root}" remote get-url origin 2>/dev/null || echo "")"
[ "${actual_remote}" = "${EXPECTED_REMOTE}" ] \
  || die "origin is '${actual_remote}', expected '${EXPECTED_REMOTE}'. Refusing to install an agent from an unknown remote."

# Tracked modifications, staged changes and untracked files all count as dirty.
# A dirty tree means the bytes about to be installed were never reviewed.
if [ -n "$(git -C "${repo_root}" status --porcelain --untracked-files=normal)" ]; then
  git -C "${repo_root}" status --short >&2
  die "the working tree is dirty. The agent is only ever installed from a clean, reviewed checkout."
fi

git -C "${repo_root}" fetch --quiet origin main \
  || die "could not fetch origin/main. The ancestry proof below needs an up-to-date remote ref."

head_sha="$(git -C "${repo_root}" rev-parse HEAD)"
main_sha="$(git -C "${repo_root}" rev-parse origin/main)"

# The whole point: pull-request code must never become the agent. An ancestor
# of origin/main is a commit that has already been merged and reviewed.
git -C "${repo_root}" merge-base --is-ancestor "${head_sha}" "${main_sha}" \
  || die "HEAD (${head_sha}) is not an ancestor of origin/main (${main_sha}). Check out a merged commit before installing: git checkout main && git pull --ff-only"

note "HEAD ${head_sha} is an ancestor of origin/main ${main_sha}"

# --revision is what makes a rollback a single command instead of a detached
# checkout: the bytes come from `git archive <rev>`, so the operator's working
# tree is never moved. It buys nothing in trust - the same ancestry proof is
# demanded of it - and the refusals above still apply to the checkout itself.
if [ -n "${revision_arg}" ]; then
  release_sha="$(git -C "${repo_root}" rev-parse --verify --quiet "${revision_arg}^{commit}" || echo "")"
  [ -n "${release_sha}" ] \
    || die "--revision '${revision_arg}' is not a commit in this repository. Fetch it first, or name a sha on origin/main."
  git -C "${repo_root}" merge-base --is-ancestor "${release_sha}" "${main_sha}" \
    || die "--revision ${release_sha} is not an ancestor of origin/main (${main_sha}). Pull-request code never becomes the agent."
  note "installing revision ${release_sha} (HEAD is ${head_sha})"
else
  release_sha="${head_sha}"
fi

git -C "${repo_root}" cat-file -e "${release_sha}:${AGENT_RELATIVE_PATH}" 2>/dev/null \
  || die "${AGENT_RELATIVE_PATH} does not exist in ${release_sha}, but the launchd plist executes it. The plist and the agent entrypoint filename are a fixed interface; see ops/local-ci/host/README.md."

scratch="$(mktemp -d "${TMPDIR:-/tmp}/nabaperks-local-ci.XXXXXX")"
revision_plist="${scratch}/${LABEL}.plist"
git -C "${repo_root}" show "${release_sha}:ops/local-ci/host/${LABEL}.plist" >"${revision_plist}" 2>/dev/null \
  || die "revision ${release_sha} carries no ops/local-ci/host/${LABEL}.plist"

lima_template="${scratch}/lima.yaml"
git -C "${repo_root}" show "${release_sha}:${LIMA_RELATIVE_PATH}" >"${lima_template}" 2>/dev/null \
  || die "revision ${release_sha} carries no ${LIMA_RELATIVE_PATH}"

# The plist and this script describe one interface in two files, so assert they
# still agree. Without this, a rename on one side installs a LaunchAgent whose
# program does not exist: launchd reports only a spawn failure, and KeepAlive
# retries it forever.
grep -q "${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}" "${revision_plist}" \
  || die "the plist does not execute ${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}. The plist ProgramArguments and install.sh AGENT_RELATIVE_PATH are a fixed interface; see ops/local-ci/host/README.md."

# --watch is what selects the poll loop. Without it main.mjs parses the run as a
# one-shot, exits 2 for the missing --profile/--sha, and KeepAlive restarts it
# in a tight loop.
grep -q -- "--watch" "${revision_plist}" \
  || die "the plist does not pass --watch, so the agent would exit 2 on every launch and crash-loop under KeepAlive."

# The job image tag is per-host, so it cannot be a literal in a plist that is
# installed byte-identically. The plist carries the path and this script writes
# the value there. Both halves are asserted, because a plist that named a
# different path would leave the agent with no image and crash-looping on
# MISSING_JOB_IMAGE - which is what "supported install" used to mean.
grep -q "LOCAL_CI_JOB_IMAGE_FILE" "${revision_plist}" \
  || die "the plist does not set LOCAL_CI_JOB_IMAGE_FILE, so the installed agent would have no pinned job image and would crash-loop on MISSING_JOB_IMAGE."
grep -q "<string>${JOB_IMAGE_FILE}</string>" "${revision_plist}" \
  || die "the plist's LOCAL_CI_JOB_IMAGE_FILE does not point at ${JOB_IMAGE_FILE}, which is where this script writes the pinned tag. The two are a fixed interface; see ops/local-ci/host/README.md."

# ----------------------------------------------- 3. credential location gate
step "Validating the credential directory"

secret_dir="${NABAPERKS_LOCAL_CI_HOME:-${HOME}/.nabaperks-local-ci}"
case "${secret_dir}" in
  /*) ;;
  *) die "the credential directory must be an absolute path, got '${secret_dir}'" ;;
esac

secret_dir_real="$(physical_path "${secret_dir}")"
if [ -e "${secret_dir_real}" ] && [ ! -d "${secret_dir_real}" ]; then
  die "${secret_dir_real} exists and is not a directory"
fi
home_real="$(cd "${HOME}" && pwd -P)"

case "${secret_dir_real}/" in
  "${home_real}"/*) ;;
  *) die "the credential directory must live under your home directory (${home_real}), got ${secret_dir_real}" ;;
esac

# The repository is shared with agents, editors and, one day, a `git add -A`.
case "${secret_dir_real}/" in
  "${repo_root}"/*) die "refusing to keep credentials inside the repository working tree (${repo_root})" ;;
esac

# The install root is world-readable by design: it holds reviewed source.
case "${secret_dir_real}/" in
  "${INSTALL_ROOT}"/*) die "refusing to keep credentials inside the world-readable install root (${INSTALL_ROOT})" ;;
esac

# Shared, temporary and removable locations.
for forbidden in /tmp /private/tmp /var/tmp /private/var/tmp /Volumes /Users/Shared /Library /System; do
  case "${secret_dir_real}/" in
    "${forbidden}"/*) die "refusing to keep credentials under ${forbidden}" ;;
  esac
done

# Any mount point other than the boot volume means a removable disk, a disk
# image or a network share: media that can be detached, shared or re-mounted
# with different permissions.
while IFS= read -r mount_point; do
  case "${mount_point}" in
    / | /System/Volumes/Data | "") continue ;;
  esac
  case "${secret_dir_real}/" in
    "${mount_point}"/*)
      die "refusing to keep credentials on the mounted volume ${mount_point}"
      ;;
  esac
done <<MOUNTS
$(/sbin/mount | sed -E 's/^.* on (.*) \([^)]*\)$/\1/')
MOUNTS

# A world-writable ancestor lets any local process replace the directory.
probe="${secret_dir_real}"
while [ "${probe}" != "/" ]; do
  if [ -e "${probe}" ]; then
    mode="$(stat -f '%OLp' "${probe}")"
    other_digit="$(printf '%s' "${mode}" | tail -c 1)"
    case "${other_digit}" in
      2 | 3 | 6 | 7)
        if [ ! -k "${probe}" ]; then
          die "ancestor ${probe} is world-writable (mode ${mode}); refusing to place credentials beneath it"
        fi
        ;;
    esac
  fi
  probe="$(dirname "${probe}")"
done

# The Lima VM is the only thing that runs job containers, and it can only reach
# host files through mounts. Zero mounts means the credential directory is
# unreachable from every container by construction, not by policy.
grep -Eq '^mounts: \[\]$' "${lima_template}" \
  || die "${LIMA_RELATIVE_PATH} in ${release_sha} no longer declares 'mounts: []'. A mounted host directory would put ${secret_dir_real} within reach of a job container."

note "credential directory ${secret_dir_real} is under \$HOME, off the repository, off the install root, on the boot volume, and unreachable from the VM"

# ------------------------------------------------------- 4. place credentials
step "Placing credentials"

umask 077
mkdir -p "${secret_dir_real}"
chmod 0700 "${secret_dir_real}"

copy_secret() {
  source_path="$1"
  destination_name="$2"
  [ -f "${source_path}" ] || die "no such file: ${source_path}"
  source_real="$(physical_path "${source_path}")"
  case "${source_real}/" in
    "${repo_root}"/*) die "refusing to read a credential out of the repository working tree: ${source_real}" ;;
    "${INSTALL_ROOT}"/*) die "refusing to read a credential out of the install root: ${source_real}" ;;
  esac
  install -m 0600 "${source_real}" "${secret_dir_real}/${destination_name}"
  note "installed ${secret_dir_real}/${destination_name} (0600)"
  note "now remove the original yourself: ${source_real}"
}

if [ -n "${github_app_key_src}" ]; then
  copy_secret "${github_app_key_src}" "${KEY_FILE}"
fi
if [ -n "${heartbeat_url_file_src}" ]; then
  copy_secret "${heartbeat_url_file_src}" "${HEARTBEAT_FILE}"
fi

# Read the selected merged revision, never the working tree, for rollback parity.
revision_contract="${scratch}/contract.json"
git -C "${repo_root}" show "${release_sha}:config/local-ci-contract.json" >"${revision_contract}" \
  || die "revision has no local CI contract"
heartbeat_provider="$(node -e 'const fs = require("node:fs"); const c = JSON.parse(fs.readFileSync(process.argv[1], "utf8")); process.stdout.write(c.agentLiveness?.provider ?? "https")' "${revision_contract}")"
required_secrets=("${KEY_FILE}")
case "${heartbeat_provider}" in
  github-check) note "GitHub App heartbeat selected; no external ping URL required" ;;
  https) required_secrets+=("${HEARTBEAT_FILE}") ;;
  *) die "unknown heartbeat provider: ${heartbeat_provider}" ;;
esac

for required_secret in "${required_secrets[@]}"; do
  path="${secret_dir_real}/${required_secret}"
  if [ ! -f "${path}" ]; then
    die "missing ${path}. Supply the required file with --github-app-key or, for the legacy HTTPS provider, --heartbeat-url-file. See ops/local-ci/host/README.md."
  fi
  chmod 0600 "${path}"
  mode="$(stat -f '%OLp' "${path}")"
  [ "${mode}" = "600" ] || die "${path} is mode ${mode}, expected 600"
  owner="$(stat -f '%Su' "${path}")"
  [ "${owner}" = "$(id -un)" ] || die "${path} is owned by ${owner}, expected $(id -un)"
  note "${path} is 0600 and owned by ${owner}"
done

# ------------------------------------------------------- 5. VM assertions
vm_reachable="no"
if [ "${skip_vm_check}" = "yes" ]; then
  step "Skipping the Lima instance assertions (--skip-vm-check)"
else
  step "Checking the Lima instance"
  instance_config="${HOME}/.lima/${VM_NAME}/lima.yaml"
  if ! command -v limactl >/dev/null 2>&1; then
    note "limactl is not installed yet; create the VM with the command in ops/local-ci/host/README.md"
  elif [ ! -f "${instance_config}" ]; then
    note "instance '${VM_NAME}' does not exist yet; create it with the command in ops/local-ci/host/README.md"
  else
    grep -Eq '^mounts: \[\]$' "${instance_config}" \
      || die "instance ${VM_NAME} declares host mounts. Recreate it from ${LIMA_RELATIVE_PATH}; a mounted host directory would expose ${secret_dir_real} to job containers."
    grep -Eq '^ *forwardAgent: false$' "${instance_config}" \
      || die "instance ${VM_NAME} forwards an SSH agent. Recreate it from ${LIMA_RELATIVE_PATH}."
    grep -Eq '^cpus: 12$' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare 12 vCPUs"
    grep -Eq '^memory: .?40GiB' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare 40GiB of memory"
    grep -Eq '^disk: .?150GiB' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare a 150GiB disk"
    note "instance ${VM_NAME}: 12 vCPU, 40GiB, 150GiB, no mounts, no agent forwarding"
    # These assertions read the instance's declaration. The agent re-asserts
    # the live guest - mounts, SSH_AUTH_SOCK, Rosetta - before every dispatch,
    # which is the check that survives a VM mutated after installation.
    if limactl shell "${VM_NAME}" -- true >/dev/null 2>&1; then
      vm_reachable="yes"
    else
      note "instance ${VM_NAME} is not running; start it with: limactl start ${VM_NAME}"
    fi
  fi
fi

# --------------------------------------------------------- 6. pin the image
step "Pinning the job image"

sudo -v || die "sudo authentication failed"
sudo install -d -m 0755 -o root -g wheel "${INSTALL_ROOT}"

existing_job_image=""
if [ -f "${JOB_IMAGE_FILE}" ]; then
  existing_job_image="$(tr -d '[:space:]' <"${JOB_IMAGE_FILE}")"
fi

if [ -n "${job_image_arg}" ]; then
  job_image="${job_image_arg}"
  note "pinning the job image given on the command line"
elif [ -n "${existing_job_image}" ]; then
  job_image="${existing_job_image}"
  note "keeping the job image pinned by an earlier run"
elif [ "${vm_reachable}" = "yes" ]; then
  # Derive it rather than making the operator repeat a tag this script can see
  # for itself. The revision being installed wins when an image was built from
  # it; otherwise a single candidate is unambiguous and anything else is not.
  available="$(limactl shell "${VM_NAME}" -- docker image ls --format '{{.Repository}}:{{.Tag}}' "${JOB_IMAGE_REPOSITORY}" 2>/dev/null | sort -u || true)"
  if printf '%s\n' "${available}" | grep -qx "${JOB_IMAGE_REPOSITORY}:${release_sha}"; then
    job_image="${JOB_IMAGE_REPOSITORY}:${release_sha}"
    note "derived the job image from the revision being installed"
  else
    candidates="$(printf '%s\n' "${available}" | grep '[^[:space:]]' || true)"
    if [ "$(printf '%s\n' "${candidates}" | grep -c '[^[:space:]]' || true)" = "1" ]; then
      job_image="${candidates}"
      note "derived the job image from the only ${JOB_IMAGE_REPOSITORY} image in the VM"
    else
      die "cannot derive the job image: the VM holds $(printf '%s\n' "${candidates}" | grep -c '[^[:space:]]' || true) ${JOB_IMAGE_REPOSITORY} images. Build one (ops/local-ci/host/README.md §3) or name it with --job-image."
    fi
  fi
else
  die "no job image is pinned and the VM was not checked, so one cannot be derived. Pass --job-image ${JOB_IMAGE_REPOSITORY}:<commit sha>. The agent refuses to start without it, and a launchd job that cannot start is a crash loop, not a poller."
fi

validate_job_image "${job_image}"

if [ "${vm_reachable}" = "yes" ]; then
  limactl shell "${VM_NAME}" -- docker image inspect "${job_image}" >/dev/null 2>&1 \
    || die "image '${job_image}' does not exist inside ${VM_NAME}. Build it from a verified main commit (ops/local-ci/host/README.md §3); the agent would otherwise fail every lane on the first run."
  note "image ${job_image} exists inside ${VM_NAME}"
else
  note "not verified against the VM: ${job_image} (the instance was not reachable)"
fi

printf '%s\n' "${job_image}" | sudo tee "${JOB_IMAGE_FILE}" >/dev/null
sudo chown root:wheel "${JOB_IMAGE_FILE}"
sudo chmod 0644 "${JOB_IMAGE_FILE}"
note "pinned ${JOB_IMAGE_FILE} -> ${job_image}"

# --------------------------------------------------------- 7. install release
step "Installing revision ${release_sha} under ${INSTALL_ROOT}"

release_dir="${INSTALL_ROOT}/releases/${release_sha}"
sudo install -d -m 0755 -o root -g wheel "${INSTALL_ROOT}/releases"

if [ -d "${release_dir}" ]; then
  note "release ${release_sha} is already installed"
else
  staging="${scratch}/release"
  mkdir -p "${staging}"
  # git archive emits exactly the tracked bytes of the verified commit: no
  # build output, no editor droppings, no ignored files, nothing untracked.
  git -C "${repo_root}" archive --format=tar "${release_sha}" | tar -x -C "${staging}"
  sudo rm -rf "${release_dir}.partial"
  sudo mkdir -p "${release_dir}.partial"
  sudo cp -R "${staging}/." "${release_dir}.partial/"
  rm -rf "${staging}"
  sudo chown -R root:wheel "${release_dir}.partial"
  sudo chmod -R go-w "${release_dir}.partial"
  sudo chmod 0755 "${release_dir}.partial/${AGENT_RELATIVE_PATH}"
  sudo mv "${release_dir}.partial" "${release_dir}"
  note "extracted ${release_sha}"
fi

# Atomic repoint: create the new link beside the old one, then rename over it.
# `mv -h` replaces the symlink itself instead of following it into its target.
sudo ln -sfn "${release_dir}" "${INSTALL_ROOT}/.current.staged"
sudo mv -fh "${INSTALL_ROOT}/.current.staged" "${INSTALL_ROOT}/current"
note "${INSTALL_ROOT}/current -> $(readlink "${INSTALL_ROOT}/current")"

# Keep the last few releases so a rollback is a symlink swap, and no more.
kept=0
for existing in $(sudo ls -1t "${INSTALL_ROOT}/releases"); do
  kept=$((kept + 1))
  if [ "${kept}" -gt "${RELEASES_TO_KEEP}" ] && [ "${existing}" != "${release_sha}" ]; then
    sudo rm -rf "${INSTALL_ROOT}/releases/${existing:?}"
    note "pruned old release ${existing}"
  fi
done

# ------------------------------------------------------------- 8. logging
step "Preparing the log directory and rotation policy"

sudo install -d -m 0750 -o "$(id -un)" -g staff "${INSTALL_ROOT}/logs"
for log in agent.out.log agent.err.log; do
  if [ ! -f "${INSTALL_ROOT}/logs/${log}" ]; then
    sudo install -m 0640 -o "$(id -un)" -g staff /dev/null "${INSTALL_ROOT}/logs/${log}"
  fi
done

newsyslog_conf="/etc/newsyslog.d/${LABEL}.conf"
sudo tee "${newsyslog_conf}" >/dev/null <<NEWSYSLOG
# logfilename                                   [owner:group]    mode count size when  flags
${INSTALL_ROOT}/logs/agent.out.log               $(id -un):staff  640  7     10240 *     J
${INSTALL_ROOT}/logs/agent.err.log               $(id -un):staff  640  7     10240 *     J
NEWSYSLOG
sudo chmod 0644 "${newsyslog_conf}"
note "logs at ${INSTALL_ROOT}/logs, rotated by ${newsyslog_conf}"

# ------------------------------------------------------- 9. launchd agent
step "Registering the launchd agent"

launch_agents_dir="${HOME}/Library/LaunchAgents"
installed_plist="${launch_agents_dir}/${LABEL}.plist"
uid="$(id -u)"

mkdir -p "${launch_agents_dir}"
launchctl bootout "gui/${uid}/${LABEL}" >/dev/null 2>&1 || true
install -m 0644 "${revision_plist}" "${installed_plist}"

# The committed plist carries only absolute, operator-independent paths, so the
# installed copy must be byte-identical to the reviewed one.
cmp -s "${revision_plist}" "${installed_plist}" \
  || die "the installed plist differs from the one in ${release_sha}"

plutil -lint "${installed_plist}" >/dev/null || die "${installed_plist} is not a valid property list"

launchctl bootstrap "gui/${uid}" "${installed_plist}"
launchctl enable "gui/${uid}/${LABEL}"
launchctl kickstart -k "gui/${uid}/${LABEL}"
note "bootstrapped gui/${uid}/${LABEL}"

# --------------------------------------------------------------- 10. summary
step "Installed"
note "agent      ${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}"
note "release    ${release_sha}"
note "job image  ${job_image} (${JOB_IMAGE_FILE})"
note "plist      ${installed_plist}"
note "logs       ${INSTALL_ROOT}/logs/agent.{out,err}.log"
note "creds      ${secret_dir_real} (0700, files 0600, host-only)"
printf '\nFollow the agent with:\n  tail -f %s/logs/agent.err.log\n' "${INSTALL_ROOT}"
printf 'The agent re-asserts the VM before every dispatch and publishes the\n'
printf 'nightly proof on a %s-hour cadence by itself; no separate timer is needed.\n' "24"
printf 'Check the job-scoped power assertion while a job runs with:\n  pgrep -fl caffeinate\n\n'
