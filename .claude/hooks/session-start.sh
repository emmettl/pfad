#!/bin/bash
# Cloud sessions ship Node 22; this repo needs the Node in .nvmrc.
# No-op anywhere Node is already new enough (Mac minis, Louis's machines) and outside cloud sessions.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

want_major="$(tr -d 'v \n' < .nvmrc | cut -d. -f1)"
have_major="$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
node_home=/opt/node-v${want_major}

if [ "$have_major" -lt "$want_major" ]; then
  if [ ! -x "$node_home/bin/node" ]; then
    case "$(uname -m)" in
      x86_64) arch=x64 ;;
      aarch64|arm64) arch=arm64 ;;
      *) echo "session-start: unsupported arch $(uname -m)" >&2; exit 1 ;;
    esac
    tmp="$(mktemp -d)"
    base="https://nodejs.org/dist/latest-v${want_major}.x"
    curl -fsSL "$base/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt"
    file="$(grep -o "node-v[0-9.]*-linux-$arch\.tar\.xz" "$tmp/SHASUMS256.txt" | head -1)"
    curl -fsSL "$base/$file" -o "$tmp/$file"
    (cd "$tmp" && grep " $file\$" SHASUMS256.txt | sha256sum --check --status)
    mkdir -p "$node_home"
    tar -xJf "$tmp/$file" -C "$node_home" --strip-components=1
    rm -rf "$tmp"
  fi
  export PATH="$node_home/bin:$PATH"
  # Later shells of this session pick it up from the env file.
  if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
    echo "export PATH=\"$node_home/bin:\$PATH\"" >> "$CLAUDE_ENV_FILE"
  fi
fi

# Match the packageManager pin (npm 10 strips lockfile fields).
pm="$(node -p '(require("./package.json").packageManager||"").replace(/^npm@/,"")')"
if [ -n "$pm" ] && [ "$(npm -v)" != "$pm" ]; then
  npm install -g "npm@$pm" >/dev/null
fi

# Install only when something that decides the install has changed.
hashes=node_modules/.session-start.sha256
if ! sha256sum --check --status "$hashes" 2>/dev/null; then
  rm -f "$hashes"
  npm ci --no-audit --no-fund
  mkdir -p node_modules
  sha256sum .claude/hooks/session-start.sh package.json package-lock.json .nvmrc > "$hashes"
fi
