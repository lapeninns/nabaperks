#!/bin/bash
#
# uninstall.sh - remove the Nabaperks local CI agent from this Mac.
#
# Idempotent: every step tolerates the thing already being gone, so running it
# on a half-installed or already-clean machine succeeds.
#
# By default it removes only what install.sh registered with the operating
# system: the launchd job, the installed plist and the log-rotation policy. The
# install root, the Lima VM and the credentials survive unless you ask for them
# explicitly, because each is expensive or impossible to recreate.
#
# Usage:
#   ops/local-ci/host/uninstall.sh [options]
#
#   --purge                Also delete /opt/nabaperks-local-ci (all releases
#                          and logs).
#   --remove-vm            Also stop and delete the 'nabaperks-ci' Lima VM.
#                          Rebuilding it is a multi-hour download and image
#                          build, so this is opt-in.
#   --purge-credentials    Also delete the two known credential files from
#                          ~/.nabaperks-local-ci. The GitHub App private key
#                          CANNOT be re-downloaded from GitHub; you would have
#                          to generate a new one and update the App. Refuses if
#                          the directory holds anything it does not recognise.
#   -h, --help             Show this help.

set -euo pipefail

LABEL="com.nabaperks.local-ci"
VM_NAME="nabaperks-ci"
INSTALL_ROOT="/opt/nabaperks-local-ci"
KEY_FILE="github-app-private-key.pem"
HEARTBEAT_FILE="uptimerobot-heartbeat-url"

purge_install_root="no"
remove_vm="no"
purge_credentials="no"

die() {
  printf 'uninstall.sh: %s\n' "$1" >&2
  exit 1
}

note() {
  printf '  %s\n' "$1"
}

step() {
  printf '\n==> %s\n' "$1"
}

usage() {
  sed -n '3,27p' "$0" | sed 's/^# \{0,1\}//'
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --purge)
      purge_install_root="yes"
      shift
      ;;
    --remove-vm)
      remove_vm="yes"
      shift
      ;;
    --purge-credentials)
      purge_credentials="yes"
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

[ "$(id -u)" -ne 0 ] || die "refusing to run as root. Run as the operator who owns the launchd agent; privileged steps escalate with sudo individually."
[ "${SUDO_USER:-}" = "" ] || die "refusing to run under sudo. Run as yourself: ops/local-ci/host/uninstall.sh"
[ "$(uname -s)" = "Darwin" ] || die "this uninstaller targets macOS"

uid="$(id -u)"
installed_plist="${HOME}/Library/LaunchAgents/${LABEL}.plist"
secret_dir="${NABAPERKS_LOCAL_CI_HOME:-${HOME}/.nabaperks-local-ci}"

# ------------------------------------------------------------ launchd agent
step "Stopping the launchd agent"
if launchctl print "gui/${uid}/${LABEL}" >/dev/null 2>&1; then
  # bootout sends SIGTERM and waits up to the plist's ExitTimeOut, so an
  # in-flight job gets a chance to report before the agent dies. Any caffeinate
  # assertion is released automatically: it is bound to the job runner's pid
  # with `-w`, so it exits when that process does.
  launchctl bootout "gui/${uid}/${LABEL}" >/dev/null 2>&1 || true
  note "booted out gui/${uid}/${LABEL}"
else
  note "gui/${uid}/${LABEL} was not loaded"
fi

if [ -f "${installed_plist}" ]; then
  rm -f "${installed_plist}"
  note "removed ${installed_plist}"
else
  note "${installed_plist} was already absent"
fi

# ---------------------------------------------------------- rotation policy
step "Removing the log-rotation policy"
newsyslog_conf="/etc/newsyslog.d/${LABEL}.conf"
if [ -f "${newsyslog_conf}" ]; then
  sudo rm -f "${newsyslog_conf}"
  note "removed ${newsyslog_conf}"
else
  note "${newsyslog_conf} was already absent"
fi

# ------------------------------------------------------------- install root
step "Install root"
if [ "${purge_install_root}" = "yes" ]; then
  if [ -e "${INSTALL_ROOT}" ]; then
    sudo rm -rf "${INSTALL_ROOT}"
    note "removed ${INSTALL_ROOT}"
  else
    note "${INSTALL_ROOT} was already absent"
  fi
else
  if [ -e "${INSTALL_ROOT}" ]; then
    note "kept ${INSTALL_ROOT} (pass --purge to delete it)"
  else
    note "${INSTALL_ROOT} is not present"
  fi
fi

# ----------------------------------------------------------------- lima vm
step "Lima VM"
if [ "${remove_vm}" = "yes" ]; then
  if command -v limactl >/dev/null 2>&1 && limactl list --quiet 2>/dev/null | grep -qx "${VM_NAME}"; then
    limactl stop --force "${VM_NAME}" >/dev/null 2>&1 || true
    limactl delete --force "${VM_NAME}"
    note "deleted the '${VM_NAME}' instance"
  else
    note "instance '${VM_NAME}' is not present"
  fi
else
  note "kept the '${VM_NAME}' instance (pass --remove-vm to delete it)"
fi

# -------------------------------------------------------------- credentials
step "Credentials"
if [ "${purge_credentials}" = "yes" ]; then
  if [ -d "${secret_dir}" ]; then
    unexpected=""
    for entry in "${secret_dir}"/* "${secret_dir}"/.*; do
      base="$(basename "${entry}")"
      case "${base}" in
        . | .. | '*' | '.*' | "${KEY_FILE}" | "${HEARTBEAT_FILE}") continue ;;
      esac
      unexpected="${unexpected} ${base}"
    done
    if [ -n "${unexpected}" ]; then
      die "refusing to purge ${secret_dir}: it holds files this uninstaller does not recognise:${unexpected}. Remove them yourself if you meant to."
    fi
    rm -f "${secret_dir}/${KEY_FILE}" "${secret_dir}/${HEARTBEAT_FILE}"
    rmdir "${secret_dir}"
    note "removed ${secret_dir}"
    note "the GitHub App private key is gone for good: generate a new one in the App settings before reinstalling"
  else
    note "${secret_dir} was already absent"
  fi
else
  if [ -d "${secret_dir}" ]; then
    note "kept ${secret_dir} (pass --purge-credentials to delete it)"
  else
    note "${secret_dir} is not present"
  fi
fi

step "Uninstalled"
printf '\nThe GitHub App installation itself is untouched. If you are retiring the\n'
printf 'execution plane rather than reinstalling it, also uninstall the App from\n'
printf 'the repository and delete the UptimeRobot heartbeat monitor.\n\n'
