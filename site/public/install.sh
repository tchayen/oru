#!/bin/sh
# oru install script
# Usage: curl -fsSL https://oru.dev/install | bash
#
# Environment variables:
#   ORU_VERSION          - install a specific version (default: latest)
#   ORU_INSTALL_DIR      - installation directory (default: ~/.oru)
#   ORU_NO_MODIFY_PATH   - set to 1 to skip PATH modification

set -e

# --- Color helpers ---
RED=""
GREEN=""
YELLOW=""
BOLD=""
RESET=""

if [ -t 1 ]; then
  RED="\033[0;31m"
  GREEN="\033[0;32m"
  YELLOW="\033[0;33m"
  BOLD="\033[1m"
  RESET="\033[0m"
fi

info() {
  printf "${GREEN}info${RESET}: %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${RESET}: %s\n" "$1"
}

error() {
  printf "${RED}error${RESET}: %s\n" "$1" >&2
  exit 1
}

# --- Detect OS + arch ---
detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Darwin) PLATFORM_OS="darwin" ;;
    Linux)  PLATFORM_OS="linux" ;;
    *)      error "Unsupported OS: $OS. oru supports macOS and Linux." ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  PLATFORM_ARCH="x64" ;;
    arm64|aarch64) PLATFORM_ARCH="arm64" ;;
    *)             error "Unsupported architecture: $ARCH. oru supports x64 and arm64." ;;
  esac

  PLATFORM="${PLATFORM_OS}-${PLATFORM_ARCH}"
}

# --- Check Node.js ---
check_node() {
  if ! command -v node >/dev/null 2>&1; then
    error "Node.js is required but not found. Install Node.js 22+ from:
  - fnm:        curl -fsSL https://fnm.vercel.app/install | bash && fnm install 22
  - brew:       brew install node@22
  - nodejs.org: https://nodejs.org"
  fi

  NODE_VERSION="$(node -v | sed 's/^v//')"
  NODE_MAJOR="$(echo "$NODE_VERSION" | cut -d. -f1)"

  if [ "$NODE_MAJOR" -lt 22 ]; then
    error "Node.js 22+ is required (found v${NODE_VERSION}). Upgrade with:
  - fnm:        fnm install 22
  - brew:       brew upgrade node
  - nodejs.org: https://nodejs.org"
  fi

  info "Found Node.js v${NODE_VERSION}"
}

# --- Resolve version ---
resolve_version() {
  if [ -n "$ORU_VERSION" ]; then
    VERSION="$ORU_VERSION"
    info "Using specified version: v${VERSION}"
    return
  fi

  info "Fetching latest version..."

  if command -v curl >/dev/null 2>&1; then
    VERSION="$(curl -fsSL https://registry.npmjs.org/@tchayen/oru/latest | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
  elif command -v wget >/dev/null 2>&1; then
    VERSION="$(wget -qO- https://registry.npmjs.org/@tchayen/oru/latest | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
  else
    error "curl or wget is required"
  fi

  if [ -z "$VERSION" ]; then
    error "Failed to fetch latest version from npm registry"
  fi

  info "Latest version: v${VERSION}"
}

# --- Download + extract ---
download_and_extract() {
  INSTALL_DIR="${ORU_INSTALL_DIR:-$HOME/.oru}"
  BIN_DIR="${INSTALL_DIR}/bin"
  URL="https://github.com/tchayen/oru/releases/download/v${VERSION}/oru-v${VERSION}-${PLATFORM}.tar.gz"

  info "Downloading oru v${VERSION} for ${PLATFORM}..."

  TMP_DIR="$(mktemp -d)"
  TAR_PATH="${TMP_DIR}/oru.tar.gz"

  if command -v curl >/dev/null 2>&1; then
    HTTP_CODE="$(curl -fsSL -o "$TAR_PATH" -w "%{http_code}" "$URL" 2>/dev/null)" || true
    if [ ! -f "$TAR_PATH" ] || [ "$(wc -c < "$TAR_PATH" | tr -d ' ')" -lt 100 ]; then
      rm -rf "$TMP_DIR"
      error "Download failed (HTTP ${HTTP_CODE}). Check that the release exists:
  ${URL}"
    fi
  elif command -v wget >/dev/null 2>&1; then
    wget -qO "$TAR_PATH" "$URL" || {
      rm -rf "$TMP_DIR"
      error "Download failed. Check that the release exists:
  ${URL}"
    }
  fi

  info "Extracting to ${BIN_DIR}..."

  # Remove old bin directory but preserve data files (oru.db, config.toml)
  if [ -d "$BIN_DIR" ]; then
    rm -rf "$BIN_DIR"
  fi

  mkdir -p "$BIN_DIR"
  tar -xzf "$TAR_PATH" -C "$BIN_DIR"
  rm -rf "$TMP_DIR"

  # Make entry point executable
  chmod +x "${BIN_DIR}/oru"

  info "Installed oru v${VERSION} to ${BIN_DIR}"
}

# --- Write install metadata ---
write_metadata() {
  INSTALL_DIR="${ORU_INSTALL_DIR:-$HOME/.oru}"
  cat > "${INSTALL_DIR}/.install-meta" <<EOF
install_method=script
version=${VERSION}
platform=${PLATFORM}
installed_at=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
EOF
}

# --- Setup PATH ---
setup_path() {
  INSTALL_DIR="${ORU_INSTALL_DIR:-$HOME/.oru}"
  BIN_DIR="${INSTALL_DIR}/bin"

  if [ "${ORU_NO_MODIFY_PATH:-0}" = "1" ]; then
    warn "Skipping PATH modification (ORU_NO_MODIFY_PATH=1)"
    warn "Add ${BIN_DIR} to your PATH manually"
    return
  fi

  # Check if already on PATH
  case ":${PATH}:" in
    *":${BIN_DIR}:"*) return ;;
  esac

  SHELL_NAME="$(basename "${SHELL:-/bin/sh}")"
  RC_FILE=""
  PATH_LINE="export PATH=\"${BIN_DIR}:\$PATH\""

  case "$SHELL_NAME" in
    bash)
      if [ -f "$HOME/.bashrc" ]; then
        RC_FILE="$HOME/.bashrc"
      elif [ -f "$HOME/.bash_profile" ]; then
        RC_FILE="$HOME/.bash_profile"
      else
        RC_FILE="$HOME/.bashrc"
      fi
      ;;
    zsh)
      RC_FILE="${ZDOTDIR:-$HOME}/.zshrc"
      ;;
    fish)
      RC_FILE="${XDG_CONFIG_HOME:-$HOME/.config}/fish/config.fish"
      PATH_LINE="fish_add_path ${BIN_DIR}"
      ;;
    *)
      warn "Unknown shell: ${SHELL_NAME}. Add ${BIN_DIR} to your PATH manually."
      return
      ;;
  esac

  if [ -n "$RC_FILE" ]; then
    # Check if already added
    if [ -f "$RC_FILE" ] && grep -qF "$BIN_DIR" "$RC_FILE" 2>/dev/null; then
      return
    fi

    printf "\n# oru\n%s\n" "$PATH_LINE" >> "$RC_FILE"
    info "Added ${BIN_DIR} to PATH in ${RC_FILE}"
    info "Run ${BOLD}source ${RC_FILE}${RESET} or start a new terminal to use oru"
  fi
}

# --- Main ---
main() {
  printf "\n${BOLD}oru installer${RESET}\n\n"

  detect_platform
  check_node
  resolve_version
  download_and_extract
  write_metadata
  setup_path

  printf "\n${GREEN}${BOLD}oru v${VERSION} installed successfully!${RESET}\n"
  printf "Run ${BOLD}oru --help${RESET} to get started.\n\n"
}

main
