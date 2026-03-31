#!/data/data/com.termux/files/usr/bin/bash
set -e
GITHUB_USER="alonharazi3-web"
GITHUB_EMAIL="alonharazi3@gmail.com"
REPO_NAME="mini-genius-windows"
BRANCH="main"
REPO_DIR="$HOME/mini-genius-windows-repo"
GREEN='\033[0;32m';RED='\033[0;31m';CYAN='\033[0;36m';NC='\033[0m'
ok()   { echo -e "${GREEN}✅ $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}ℹ️  $1${NC}"; }

echo -e "\n${CYAN}══════════════════════════════════${NC}"
echo -e "${CYAN}  Mini Genius Windows v3.4 — Deploy${NC}"
echo -e "${CYAN}══════════════════════════════════${NC}\n"

command -v git   >/dev/null 2>&1 || { info "Installing git...";   pkg install -y git;   }
command -v unzip >/dev/null 2>&1 || { info "Installing unzip..."; pkg install -y unzip; }

git config --global user.name  "$GITHUB_USER"
git config --global user.email "$GITHUB_EMAIL"
git config --global init.defaultBranch "$BRANCH"
git config --global credential.helper store
git config --global http.postBuffer 52428800
git config --global http.lowSpeedLimit 1000
git config --global http.lowSpeedTime 300

CRED_FILE="$HOME/.git-credentials"
if [ ! -f "$CRED_FILE" ] || ! grep -q "github.com" "$CRED_FILE" 2>/dev/null; then
  echo "  Need GitHub token — https://github.com/settings/tokens"
  read -p "  Paste ghp_... token: " GH_TOKEN
  [ -z "$GH_TOKEN" ] && err "No token provided."
  echo "https://${GITHUB_USER}:${GH_TOKEN}@github.com" > "$CRED_FILE"
  chmod 600 "$CRED_FILE"
  ok "Token saved"
fi

GH_TOKEN=$(grep "github.com" "$CRED_FILE" | head -1 | sed 's|https://[^:]*:\([^@]*\)@.*|\1|')
REMOTE_URL="https://${GITHUB_USER}:${GH_TOKEN}@github.com/${GITHUB_USER}/${REPO_NAME}.git"

ZIP_PATH="$1"
if [ -z "$ZIP_PATH" ]; then
  ZIP_PATH=$(ls -t /sdcard/Download/mini-genius-windows*.zip 2>/dev/null | head -1)
  [ -z "$ZIP_PATH" ] && err "No mini-genius-windows zip in Downloads"
  info "Found: $ZIP_PATH"
fi
[ -f "$ZIP_PATH" ] || err "File not found: $ZIP_PATH"

VERSION=$(unzip -p "$ZIP_PATH" VERSION 2>/dev/null | head -1 || echo "unknown")
info "Version: $VERSION"

if [ -d "$REPO_DIR/.git" ]; then
  info "Repo exists, syncing..."
  cd "$REPO_DIR"
  git remote set-url origin "$REMOTE_URL" 2>/dev/null || true
  git fetch origin 2>/dev/null || true
  git checkout "$BRANCH" 2>/dev/null || true
  git pull origin "$BRANCH" --rebase 2>/dev/null || true
else
  [ -d "$REPO_DIR" ] && rm -rf "$REPO_DIR"
  info "Cloning..."
  git clone "$REMOTE_URL" "$REPO_DIR" || err "Clone failed — check repo exists + token valid"
  cd "$REPO_DIR"
fi
ok "Repo ready"

cd "$REPO_DIR"
for item in *;      do [ -e "$item" ] && rm -rf "$item"; done
for item in .[!.]*; do case "$item" in .git|.github) ;; *) [ -e "$item" ] && rm -rf "$item" ;; esac; done
[ -d ".git" ] || err ".git lost!"

unzip -o "$ZIP_PATH" -d "$REPO_DIR" > /dev/null
ok "Files extracted"

git add -A
git diff --cached --quiet 2>/dev/null && { info "No changes"; exit 0; }
COMMIT_MSG="deploy: ${VERSION} ($(date '+%Y-%m-%d %H:%M'))"
git commit -m "$COMMIT_MSG"
git push -u origin "$BRANCH"

echo -e "\n${GREEN}══════════════════════════════════${NC}"
echo -e "${GREEN}  Done! EXE building on GitHub Actions.${NC}"
echo -e "${GREEN}══════════════════════════════════${NC}"
echo "  Actions: https://github.com/${GITHUB_USER}/${REPO_NAME}/actions"
