# syntax=docker/dockerfile:1.7
#
# Nabaperks local CI - the disposable job container.
#
# Build context is the REPOSITORY ROOT (this file reads .nvmrc from it), and
# the build runs INSIDE the Lima VM against a verified main checkout:
#
#   docker build -f ops/local-ci/image/Dockerfile -t nabaperks-ci-job:<sha> \
#     --build-arg K6_VERSION=<version> \
#     --build-arg K6_SHA256=<digest> \
#     --build-arg SUPABASE_CLI_SHA256=<digest> \
#     .
#
# Two properties this image must keep, both of which are load-bearing:
#
#   1. IT CONTAINS NO CREDENTIAL. Nothing is COPYed from the host except
#      .nvmrc, no secret is passed as a build argument, and the final layer
#      fails the build if a credential-shaped file made it in. The GitHub App
#      private key and the UptimeRobot heartbeat URL live on the macOS host in
#      ~/.nabaperks-local-ci, which the Lima VM cannot see at all (mounts: []),
#      so they cannot reach this image or a container started from it.
#
#   2. IT NEVER TOUCHES A HOST DOCKER SOCKET. Jobs that need Docker (the
#      Supabase database tier) talk to a sibling docker:dind container over TCP.
#      DOCKER_HOST is therefore pinned to the dind alias below; the daemon
#      socket path is never named in this file and the agent never passes -v
#      for it. Bind-mounting the daemon socket into a job container is
#      equivalent to giving the job root on the VM.
#
# Every system dependency below is version-pinned. When apt reports
# "Version '<x>' for '<pkg>' was not found", the pin is stale rather than
# wrong: refresh it with `apt-cache madison <pkg>` inside an ubuntu:24.04
# container and update both the ARG here and the pin ledger in
# ops/local-ci/host/README.md.

FROM ubuntu:24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# ---------------------------------------------------------------- version pins
# Node major comes from .nvmrc and is verified against it below.
ARG NODE_MAJOR=24
ARG NODE_PKG_VERSION=24.11.0-1nodesource1
# pnpm matches package.json "packageManager".
ARG PNPM_VERSION=10.28.0
# Playwright matches the @playwright/test version resolved in pnpm-lock.yaml.
ARG PLAYWRIGHT_VERSION=1.62.1
# Supabase CLI matches the version ci.yml pins on supabase/setup-cli.
ARG SUPABASE_CLI_VERSION=2.106.0
# Docker CLI matches the engine pinned in ops/local-ci/host/lima-nabaperks-ci.yaml.
ARG DOCKER_CLI_VERSION=5:27.5.1-1~ubuntu.24.04~noble

# Ubuntu 24.04 (noble) archive pins.
ARG APT_CA_CERTIFICATES=20240203
ARG APT_CURL=8.5.0-2ubuntu10.6
ARG APT_GIT=1:2.43.0-1ubuntu7.2
ARG APT_GNUPG=2.4.4-2ubuntu17
ARG APT_JQ=1.7.1-3build1
ARG APT_UNZIP=6.0-28ubuntu4.1
ARG APT_XZ_UTILS=5.6.1+really5.4.5-1build0.1
ARG APT_POPPLER_UTILS=24.02.0-1ubuntu9.3
ARG APT_IMAGEMAGICK=8:6.9.12.98+dfsg1-5.2build2
ARG APT_PYTHON3_VENV=3.12.3-0ubuntu2

# Python wheels for the print-kit geometry proof.
ARG PIP_OPENCV_PYTHON_HEADLESS=4.10.0.84
ARG PIP_PYMUPDF=1.24.10

# k6 has no repository pin to inherit: nightly.yml uses grafana/setup-k6-action
# without a `version` input, so it floats to the action's latest. The version
# and its tarball digest are therefore supplied at build time and recorded in
# the ledger in ops/local-ci/host/README.md. There is no default on purpose:
# an unverified download must fail the build, not silently succeed.
ARG K6_VERSION
ARG K6_SHA256
# Digest of the Supabase CLI .deb for the pinned version, likewise recorded in
# the ledger rather than guessed.
ARG SUPABASE_CLI_SHA256

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    CI=1 \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    PLAYWRIGHT_BROWSERS_PATH=/opt/ms-playwright \
    NABAPERKS_PRINT_KIT_VENV=/opt/print-kit-venv

# ------------------------------------------------------------- base packages
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    apt-get update \
 && apt-get install -y --no-install-recommends \
      "ca-certificates=${APT_CA_CERTIFICATES}" \
      "curl=${APT_CURL}" \
      "git=${APT_GIT}" \
      "gnupg=${APT_GNUPG}" \
      "jq=${APT_JQ}" \
      "unzip=${APT_UNZIP}" \
      "xz-utils=${APT_XZ_UTILS}" \
      "poppler-utils=${APT_POPPLER_UTILS}" \
      "imagemagick=${APT_IMAGEMAGICK}" \
      "python3-venv=${APT_PYTHON3_VENV}" \
 && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------------ node.js
# .nvmrc is the single source of truth for the Node major. Copying it in and
# comparing makes a drifted image a build failure rather than a silent
# difference between the hosted and the local plane.
COPY .nvmrc /tmp/nvmrc
RUN nvmrc_major="$(tr -d '[:space:]' < /tmp/nvmrc | cut -d. -f1 | tr -d 'v')" \
 && if [ "${nvmrc_major}" != "${NODE_MAJOR}" ]; then \
      echo "NODE_MAJOR=${NODE_MAJOR} does not match .nvmrc (${nvmrc_major})" >&2; exit 1; \
    fi \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
      | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
 && chmod 0644 /etc/apt/keyrings/nodesource.gpg \
 && echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_${NODE_MAJOR}.x nodistro main" \
      > /etc/apt/sources.list.d/nodesource.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends "nodejs=${NODE_PKG_VERSION}" \
 && rm -rf /var/lib/apt/lists/* /tmp/nvmrc \
 && test "$(node -p 'process.versions.node.split(".")[0]')" = "${NODE_MAJOR}"

# -------------------------------------------------------------------- pnpm
RUN if ! command -v corepack >/dev/null 2>&1; then npm install -g corepack; fi \
 && corepack enable \
 && corepack prepare "pnpm@${PNPM_VERSION}" --activate \
 && test "$(pnpm --version)" = "${PNPM_VERSION}"

# ------------------------------------------------------- playwright + browsers
# `install --with-deps` installs the browser system libraries that the hosted
# .github/actions/playwright composite installs, for the exact Playwright
# version resolved in pnpm-lock.yaml. Browsers land in PLAYWRIGHT_BROWSERS_PATH
# so the unprivileged runner user can read them.
RUN npx --yes "playwright@${PLAYWRIGHT_VERSION}" install --with-deps chromium firefox webkit \
 && chmod -R a+rX "${PLAYWRIGHT_BROWSERS_PATH}" \
 && rm -rf /root/.npm /var/lib/apt/lists/*

# --------------------------------------------------------- print-kit python
# Ubuntu 24.04 marks the system interpreter EXTERNALLY-MANAGED (PEP 668), so
# the `python3 -m pip install opencv-python-headless pymupdf` that ci.yml runs
# on the hosted runner fails outright here with
# "error: externally-managed-environment". A virtualenv is the supported fix;
# --break-system-packages is not, because it lets a wheel overwrite
# apt-managed site-packages. The venv is put first on PATH so the print-kit
# scripts resolve `python3` to it without any call-site change.
RUN python3 -m venv "${NABAPERKS_PRINT_KIT_VENV}" \
 && "${NABAPERKS_PRINT_KIT_VENV}/bin/pip" install --no-cache-dir --only-binary=:all: \
      "opencv-python-headless==${PIP_OPENCV_PYTHON_HEADLESS}" \
      "pymupdf==${PIP_PYMUPDF}" \
 && "${NABAPERKS_PRINT_KIT_VENV}/bin/python" -c "import cv2, fitz; print(cv2.__version__, fitz.__doc__)" \
 && chmod -R a+rX "${NABAPERKS_PRINT_KIT_VENV}"
ENV PATH="/opt/print-kit-venv/bin:${PATH}"

# ------------------------------------------------------------- supabase cli
RUN if [ -z "${SUPABASE_CLI_SHA256}" ]; then \
      echo "SUPABASE_CLI_SHA256 build-arg is required; take it from the pin ledger in ops/local-ci/host/README.md" >&2; exit 1; \
    fi \
 && curl -fsSL -o /tmp/supabase.deb \
      "https://github.com/supabase/cli/releases/download/v${SUPABASE_CLI_VERSION}/supabase_${SUPABASE_CLI_VERSION}_linux_arm64.deb" \
 && echo "${SUPABASE_CLI_SHA256}  /tmp/supabase.deb" | sha256sum -c - \
 && dpkg -i /tmp/supabase.deb \
 && rm -f /tmp/supabase.deb \
 && test "$(supabase --version)" = "${SUPABASE_CLI_VERSION}"

# ---------------------------------------------------------------------- k6
RUN if [ -z "${K6_VERSION}" ] || [ -z "${K6_SHA256}" ]; then \
      echo "K6_VERSION and K6_SHA256 build-args are required; take them from the pin ledger in ops/local-ci/host/README.md" >&2; exit 1; \
    fi \
 && curl -fsSL -o /tmp/k6.tar.gz \
      "https://github.com/grafana/k6/releases/download/v${K6_VERSION}/k6-v${K6_VERSION}-linux-arm64.tar.gz" \
 && echo "${K6_SHA256}  /tmp/k6.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/k6.tar.gz -C /tmp \
 && install -m 0755 "/tmp/k6-v${K6_VERSION}-linux-arm64/k6" /usr/local/bin/k6 \
 && rm -rf /tmp/k6.tar.gz "/tmp/k6-v${K6_VERSION}-linux-arm64" \
 && k6 version

# --------------------------------------------------------------- docker cli
# CLI only - no daemon, no socket. The database tier reaches a sibling
# docker:dind container over TCP on the job's private container network.
RUN install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
      | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
 && chmod 0644 /etc/apt/keyrings/docker.gpg \
 && echo "deb [arch=arm64 signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu noble stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends \
      "docker-ce-cli=${DOCKER_CLI_VERSION}" \
      "docker-compose-plugin" \
 && rm -rf /var/lib/apt/lists/*

ENV DOCKER_HOST=tcp://docker:2375

# ----------------------------------------------------------- unprivileged user
RUN groupadd --gid 1001 runner \
 && useradd --uid 1001 --gid 1001 --create-home --shell /bin/bash runner \
 && install -d -m 0755 -o runner -g runner /home/runner/work

# ------------------------------------------------- credential-absence assertion
# A failed build here is the intended outcome: it means something added a
# credential to the image.
RUN set -euo pipefail; \
    found=""; \
    for candidate in /root/.npmrc /root/.docker/config.json /root/.netrc \
                     /home/runner/.npmrc /home/runner/.docker/config.json \
                     /home/runner/.netrc /home/runner/work/.env; do \
      if [ -e "${candidate}" ]; then found="${found} ${candidate}"; fi; \
    done; \
    key_shaped="$(find /root /home /tmp /var/tmp \
         \( -name '*.pem' -o -name '*.p12' -o -name '*.key' \
            -o -name 'id_rsa' -o -name 'id_ed25519' \) \
         -print -quit 2>/dev/null || true)"; \
    if [ -n "${key_shaped}" ]; then found="${found} ${key_shaped}"; fi; \
    if [ -n "${found}" ]; then \
      echo "credential-shaped files present in the job image:${found}" >&2; exit 1; \
    fi; \
    echo "no credential-shaped file is present in the job image"

USER runner
WORKDIR /home/runner/work

# Print the whole toolchain so a job log records exactly what it ran on.
RUN node --version \
 && pnpm --version \
 && supabase --version \
 && k6 version \
 && docker --version \
 && python3 -c "import cv2, fitz; print('opencv', cv2.__version__)" \
 && { pdftoppm -v 2>&1 || true; } | head -n 1 \
 && { identify -version 2>&1 || true; } | head -n 1

CMD ["/bin/bash"]
