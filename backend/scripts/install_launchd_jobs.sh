#!/usr/bin/env bash
# ============================================================================
# install_launchd_jobs.sh — render the .plist.template files and load them.
#
# Renders the three launchd plists (finetune cron, model server, cloudflared
# tunnel) with this machine's absolute paths, copies them to
# ~/Library/LaunchAgents/, and loads them with launchctl.
#
# Idempotent: unloads any existing version of the same Label first.
#
# USAGE
#   bash backend/scripts/install_launchd_jobs.sh                  # install all 3
#   bash backend/scripts/install_launchd_jobs.sh --skip-tunnel    # skip cloudflared
#   bash backend/scripts/install_launchd_jobs.sh --uninstall      # remove all 3
#
# WHAT GETS INSTALLED
#   ~/Library/LaunchAgents/com.goalplanning.finetune.plist
#   ~/Library/LaunchAgents/com.goalplanning.modelserver.plist
#   ~/Library/LaunchAgents/com.goalplanning.cloudflared.plist  (unless --skip-tunnel)
#
# AFTER INSTALL
#   The model server starts immediately and survives reboots.
#   The cron job fires weekly (Sunday 03:00 local).
#   The tunnel starts immediately (requires setup_cloudflare_tunnel.sh first).
#
# CHECK STATUS
#   launchctl list | grep goalplanning
#   tail -f ~/Library/Logs/goal-planning-finetune.log
#   tail -f ~/Library/Logs/goal-planning-modelserver.log
#   tail -f ~/Library/Logs/goal-planning-cloudflared.log
#
# FORCE A FINETUNE RUN NOW (for testing)
#   launchctl kickstart -k gui/$UID/com.goalplanning.finetune
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TEMPLATE_DIR="$REPO_ROOT/backend/scripts/launchd"
PLIST_DIR="$HOME/Library/LaunchAgents"
LOG_DIR="$HOME/Library/Logs"

ALL_LABELS=(
  "com.goalplanning.finetune"
  "com.goalplanning.modelserver"
  "com.goalplanning.cloudflared"
)

SKIP_TUNNEL=false
UNINSTALL=false
for arg in "$@"; do
  case "$arg" in
    --skip-tunnel) SKIP_TUNNEL=true ;;
    --uninstall)   UNINSTALL=true ;;
    --help|-h)
      sed -n '2,30p' "$0"
      exit 0
      ;;
    *)
      echo "✗ Unknown arg: $arg (use --help)" >&2
      exit 1
      ;;
  esac
done

# ---- Uninstall path -------------------------------------------------------
if [[ "$UNINSTALL" == "true" ]]; then
  echo "Uninstalling all goal-planning launchd jobs..."
  for label in "${ALL_LABELS[@]}"; do
    plist="$PLIST_DIR/$label.plist"
    if [[ -f "$plist" ]]; then
      launchctl bootout "gui/$UID/$label" 2>/dev/null || \
        launchctl unload "$plist" 2>/dev/null || true
      rm -f "$plist"
      echo "  ✓ removed $plist"
    else
      echo "  ⊘ $label (not installed)"
    fi
  done
  exit 0
fi

# ---- Install path ---------------------------------------------------------
mkdir -p "$PLIST_DIR"
mkdir -p "$LOG_DIR"

# Decide which templates to install.
TEMPLATES=(
  "com.goalplanning.finetune.plist.template"
  "com.goalplanning.modelserver.plist.template"
)
if [[ "$SKIP_TUNNEL" != "true" ]]; then
  TEMPLATES+=("com.goalplanning.cloudflared.plist.template")
fi

# Sanity: venv must exist (modelserver references .venv/bin/python).
if [[ ! -d "$REPO_ROOT/.venv" ]]; then
  echo "✗ $REPO_ROOT/.venv not found." >&2
  echo "  Create one first:  python3 -m venv .venv && source .venv/bin/activate" >&2
  exit 1
fi

# Sanity: cloudflared must exist if we're installing the tunnel plist.
if [[ "$SKIP_TUNNEL" != "true" ]]; then
  if ! command -v cloudflared >/dev/null 2>&1; then
    echo "⚠️  cloudflared not found in PATH."
    echo "    Run:  bash backend/scripts/setup_cloudflare_tunnel.sh"
    echo "    (or rerun with --skip-tunnel)"
    exit 1
  fi
fi

echo "Workspace : $REPO_ROOT"
echo "Plist dir : $PLIST_DIR"
echo "Logs dir  : $LOG_DIR"
echo ""

for template_name in "${TEMPLATES[@]}"; do
  template="$TEMPLATE_DIR/$template_name"
  if [[ ! -f "$template" ]]; then
    echo "✗ Missing template: $template" >&2
    exit 1
  fi

  label="${template_name%.plist.template}"
  dest="$PLIST_DIR/$label.plist"

  echo "→ $label"

  # Render the template. Use # as the sed delimiter so paths with /
  # don't need escaping. The placeholders __WORKSPACE__ / __HOME__
  # are chosen to never collide with anything macOS or Python emits.
  sed \
    -e "s#__WORKSPACE__#$REPO_ROOT#g" \
    -e "s#__HOME__#$HOME#g" \
    "$template" > "$dest"
  chmod 644 "$dest"

  # Unload any previous version (idempotent — ignore "not loaded" errors).
  launchctl bootout "gui/$UID/$label" 2>/dev/null || \
    launchctl unload "$dest" 2>/dev/null || true

  # Load fresh. Prefer modern `bootstrap` API; fall back to legacy `load`.
  if ! launchctl bootstrap "gui/$UID" "$dest" 2>/dev/null; then
    launchctl load -w "$dest"
  fi

  echo "  ✓ $dest"
done

echo ""
echo "Installed. Verify:"
echo "  launchctl list | grep goalplanning"
echo ""
echo "Logs:"
echo "  tail -f $LOG_DIR/goal-planning-finetune.log"
echo "  tail -f $LOG_DIR/goal-planning-modelserver.log"
if [[ "$SKIP_TUNNEL" != "true" ]]; then
  echo "  tail -f $LOG_DIR/goal-planning-cloudflared.log"
fi
echo ""
echo "Force a finetune run now (test):"
echo "  launchctl kickstart -k gui/$UID/com.goalplanning.finetune"
