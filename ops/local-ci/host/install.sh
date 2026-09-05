#!/bin/bash
#
# install.sh - provision the Nabaperks local CI agent on this Mac.
#
# Idempotent: running it twice in a row is a no-op apart from re-registering
# the launchd job. Safe to re-run after every agent change on main.
#
# What it does, in order:
#   1. Refuses to run as root, on a non-macOS host, or on a non-ARM64 Mac.
#   2. Proves this checkout is a reviewed main commit: correct remote, clean
#      working tree, HEAD an ancestor of origin/main. The agent is NEVER
#      installed from pull-request code.
#   3. Proves the credential directory is a safe place for a private key:
#      inside $HOME, not inside the repository, not inside the install root,
#      not on a mounted volume, not under a world-writable ancestor, and not
#      reachable from the Lima VM (which is asserted to have zero mounts).
#   4. Places the GitHub App private key and the UptimeRobot heartbeat URL at
#      mode 0600 in that directory.
#   5. Extracts the verified commit into /opt/nabaperks-local-ci/releases/<sha>
#      and repoints /opt/nabaperks-local-ci/current at it atomically.
#   6. Creates the log directory and its newsyslog rotation policy.
#   7. Installs and bootstraps the launchd agent.
#
# Usage:
#   ops/local-ci/host/install.sh [options]
#
#   --github-app-key PATH       Copy this PEM in as the GitHub App private key.
#   --heartbeat-url-file PATH   Copy this file in as the UptimeRobot heartbeat
#                               URL. A file, never a --flag value: an argument
#                               is visible to every process on the machine via
#                               `ps` and is recorded in shell history.
#   --skip-vm-check             Skip the Lima instance assertions (use only
#                               when provisioning the agent before the VM).
#   -h, --help                  Show this help.

set -euo pipefail

LABEL="com.nabaperks.local-ci"
VM_NAME="nabaperks-ci"
INSTALL_ROOT="/opt/nabaperks-local-ci"
EXPECTED_REMOTE="https://github.com/lapeninns/nabaperks.git"
AGENT_RELATIVE_PATH="ops/local-ci/agent/main.mjs"
KEY_FILE="github-app-private-key.pem"
HEARTBEAT_FILE="uptimerobot-heartbeat-url"
RELEASES_TO_KEEP=5

github_app_key_src=""
heartbeat_url_file_src=""
skip_vm_check="no"

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
  sed -n '3,35p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
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

# ------------------------------------------------------- 2. verified checkout
step "Verifying this checkout is a reviewed main commit"

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

agent_source="${repo_root}/${AGENT_RELATIVE_PATH}"
[ -f "${agent_source}" ] \
  || die "${AGENT_RELATIVE_PATH} does not exist in this commit, but the launchd plist executes it. The plist and the agent entrypoint filename are a fixed interface; see ops/local-ci/host/README.md."

committed_plist="${repo_root}/ops/local-ci/host/${LABEL}.plist"
[ -f "${committed_plist}" ] || die "missing ${committed_plist}"

# The plist and AGENT_RELATIVE_PATH are one interface described in two files, so
# assert they still agree. Without this, a rename on one side installs a
# LaunchAgent whose program does not exist: launchd reports only a spawn
# failure, and KeepAlive retries it forever.
grep -q "${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}" "${committed_plist}" \
  || die "the plist does not execute ${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}. The plist ProgramArguments and install.sh AGENT_RELATIVE_PATH are a fixed interface; see ops/local-ci/host/README.md."

# --watch is what selects the poll loop. Without it main.mjs parses the run as a
# one-shot, exits 2 for the missing --profile/--sha, and KeepAlive restarts it
# in a tight loop.
grep -q -- "--watch" "${committed_plist}" \
  || die "the plist does not pass --watch, so the agent would exit 2 on every launch and crash-loop under KeepAlive."

lima_template="${repo_root}/ops/local-ci/host/lima-nabaperks-ci.yaml"
[ -f "${lima_template}" ] || die "missing ${lima_template}"

# ----------------------------------------------- 3. credential location gate
step "Validating the credential directory"

secret_dir="${NABAPERKS_LOCAL_CI_HOME:-${HOME}/.nabaperks-local-ci}"
case "${secret_dir}" in
  /*) ;;
  *) die "the credential directory must be an absolute path, got '${secret_dir}'" ;;
esac

# Resolve without requiring the directory to exist yet.
secret_parent="$(cd "$(dirname "${secret_dir}")" && pwd -P)"
secret_dir_real="${secret_parent}/$(basename "${secret_dir}")"
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
  || die "${lima_template} no longer declares 'mounts: []'. A mounted host directory would put ${secret_dir_real} within reach of a job container."

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
  source_real="$(cd "$(dirname "${source_path}")" && pwd -P)/$(basename "${source_path}")"
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

for required_secret in "${KEY_FILE}" "${HEARTBEAT_FILE}"; do
  path="${secret_dir_real}/${required_secret}"
  if [ ! -f "${path}" ]; then
    die "missing ${path}. Create the GitHub App private key and the UptimeRobot heartbeat URL first, then re-run with --github-app-key / --heartbeat-url-file. The procedure is in ops/local-ci/host/README.md."
  fi
  chmod 0600 "${path}"
  mode="$(stat -f '%OLp' "${path}")"
  [ "${mode}" = "600" ] || die "${path} is mode ${mode}, expected 600"
  owner="$(stat -f '%Su' "${path}")"
  [ "${owner}" = "$(id -un)" ] || die "${path} is owned by ${owner}, expected $(id -un)"
  note "${path} is 0600 and owned by ${owner}"
done

# --------------------------------------------------------- 5. install release
step "Installing the reviewed commit under ${INSTALL_ROOT}"

sudo -v || die "sudo authentication failed"

release_dir="${INSTALL_ROOT}/releases/${head_sha}"
sudo install -d -m 0755 -o root -g wheel "${INSTALL_ROOT}" "${INSTALL_ROOT}/releases"

if [ -d "${release_dir}" ]; then
  note "release ${head_sha} is already installed"
else
  staging="$(mktemp -d "${TMPDIR:-/tmp}/nabaperks-local-ci.XXXXXX")"
  # git archive emits exactly the tracked bytes of the verified commit: no
  # build output, no editor droppings, no ignored files, nothing untracked.
  git -C "${repo_root}" archive --format=tar "${head_sha}" | tar -x -C "${staging}"
  sudo rm -rf "${release_dir}.partial"
  sudo mkdir -p "${release_dir}.partial"
  sudo cp -R "${staging}/." "${release_dir}.partial/"
  rm -rf "${staging}"
  sudo chown -R root:wheel "${release_dir}.partial"
  sudo chmod -R go-w "${release_dir}.partial"
  sudo chmod 0755 "${release_dir}.partial/${AGENT_RELATIVE_PATH}"
  sudo mv "${release_dir}.partial" "${release_dir}"
  note "extracted ${head_sha}"
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
  if [ "${kept}" -gt "${RELEASES_TO_KEEP}" ] && [ "${existing}" != "${head_sha}" ]; then
    sudo rm -rf "${INSTALL_ROOT}/releases/${existing:?}"
    note "pruned old release ${existing}"
  fi
done

# ------------------------------------------------------------- 6. logging
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

# ------------------------------------------------------- 7. launchd agent
step "Registering the launchd agent"

launch_agents_dir="${HOME}/Library/LaunchAgents"
installed_plist="${launch_agents_dir}/${LABEL}.plist"
uid="$(id -u)"

mkdir -p "${launch_agents_dir}"
launchctl bootout "gui/${uid}/${LABEL}" >/dev/null 2>&1 || true
install -m 0644 "${committed_plist}" "${installed_plist}"

# The committed plist carries only absolute, operator-independent paths, so the
# installed copy must be byte-identical to the reviewed one.
cmp -s "${committed_plist}" "${installed_plist}" \
  || die "the installed plist differs from the committed one"

plutil -lint "${installed_plist}" >/dev/null || die "${installed_plist} is not a valid property list"

launchctl bootstrap "gui/${uid}" "${installed_plist}"
launchctl enable "gui/${uid}/${LABEL}"
launchctl kickstart -k "gui/${uid}/${LABEL}"
note "bootstrapped gui/${uid}/${LABEL}"

# ------------------------------------------------------- 8. VM assertions
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
      || die "instance ${VM_NAME} declares host mounts. Recreate it from ops/local-ci/host/lima-nabaperks-ci.yaml; a mounted host directory would expose ${secret_dir_real} to job containers."
    grep -Eq '^ *forwardAgent: false$' "${instance_config}" \
      || die "instance ${VM_NAME} forwards an SSH agent. Recreate it from ops/local-ci/host/lima-nabaperks-ci.yaml."
    grep -Eq '^cpus: 12$' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare 12 vCPUs"
    grep -Eq '^memory: .?40GiB' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare 40GiB of memory"
    grep -Eq '^disk: .?150GiB' "${instance_config}" \
      || die "instance ${VM_NAME} does not declare a 150GiB disk"
    note "instance ${VM_NAME}: 12 vCPU, 40GiB, 150GiB, no mounts, no agent forwarding"
  fi
fi

# --------------------------------------------------------------- 9. summary
step "Installed"
note "agent      ${INSTALL_ROOT}/current/${AGENT_RELATIVE_PATH}"
note "release    ${head_sha}"
note "plist      ${installed_plist}"
note "logs       ${INSTALL_ROOT}/logs/agent.{out,err}.log"
note "creds      ${secret_dir_real} (0700, files 0600, host-only)"
printf '\nFollow the agent with:\n  tail -f %s/logs/agent.err.log\n' "${INSTALL_ROOT}"
printf 'Check the job-scoped power assertion while a job runs with:\n  pgrep -fl caffeinate\n\n'
