#!/usr/bin/env bash
# ============================================================================
# run_full_finetune_cycle.sh — one-shot full automation cycle.
#
# Does this end-to-end:
#   1. Pull the latest reflections from Supabase → JSONL training corpus
#   2. If too few qualifying entries, exit cleanly with no retrain
#   3. Train a fresh LoRA adapter on the new data
#   4. Fuse the adapter back into a self-contained model directory
#   5. Restart the mlx_lm.server launchd job so it serves the new weights
#
# This is the script `com.goalplanning.finetune.plist` calls weekly via
# launchd. Designed to be safe to re-run, safe to fail mid-cycle, and to
# leave the previous good model in place if any step blows up.
#
# All output goes to stdout/stderr; launchd captures both to
# ~/Library/Logs/goal-planning-finetune.log.
#
# USAGE
#   bash backend/scripts/run_full_finetune_cycle.sh
#
# ENV
#   Standard finetune env vars (BASE_MODEL, ITERS, BATCH_SIZE, etc.) are
#   forwarded to local_finetune.sh and local_fuse.sh.
#
#   MIN_ENTRIES_OVERRIDE — passed to the exporter's --min-entries flag.
#     Defaults to whatever the exporter defaults to (200).
#
#   ENV_FILE — path to a .env-style file to source first (so Supabase
#     creds are available when launchd runs us without a user shell).
#     Default: $REPO_ROOT/.env
#
# EXIT CODES
#   0   Success, or success-with-skip (too few entries → no retrain).
#   1   Pipeline failed at some step. Previous model still serving.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

# ---- 0. Stamp the log so launchd output is greppable ----------------------
echo ""
echo "============================================================"
echo "  finetune cycle starting: $(date -Iseconds)"
echo "  workspace: $REPO_ROOT"
echo "============================================================"

# ---- 1. Source env --------------------------------------------------------
ENV_FILE="${ENV_FILE:-$REPO_ROOT/.env}"
if [[ -f "$ENV_FILE" ]]; then
  echo "Sourcing $ENV_FILE"
  set -o allexport
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +o allexport
else
  echo "(no $ENV_FILE — assuming env is already populated)"
fi

# ---- 2. Activate venv -----------------------------------------------------
if [[ -d "$REPO_ROOT/.venv" ]]; then
  # shellcheck disable=SC1091
  source "$REPO_ROOT/.venv/bin/activate"
fi

# ---- 3. Export reflections → JSONL ----------------------------------------
echo ""
echo "[1/4] Exporting reflections from Supabase..."
EXPORT_ARGS=()
if [[ -n "${MIN_ENTRIES_OVERRIDE:-}" ]]; then
  EXPORT_ARGS+=("--min-entries" "$MIN_ENTRIES_OVERRIDE")
fi

set +e
python backend/scripts/export_reflections_for_lora.py "${EXPORT_ARGS[@]}"
EXPORT_EXIT=$?
set -e

# Exit code conventions for the exporter:
#   0  wrote the JSONL
#   1  not enough qualifying entries (this is fine — skip retrain)
#   2+ real error (env missing, network down, etc.) — let launchd flag it
case "$EXPORT_EXIT" in
  0)
    echo "✓ Export succeeded"
    ;;
  1)
    echo "⊘ Not enough qualifying reflections yet. Skipping retrain."
    echo "  Previous fused model (if any) continues to serve."
    exit 0
    ;;
  *)
    echo "✗ Exporter failed with exit code $EXPORT_EXIT" >&2
    exit 1
    ;;
esac

# ---- 4. Train LoRA --------------------------------------------------------
echo ""
echo "[2/4] Training LoRA adapter..."
bash backend/scripts/local_finetune.sh
echo "✓ Training complete"

# ---- 5. Fuse adapter ------------------------------------------------------
echo ""
echo "[3/4] Fusing adapter into base..."
bash backend/scripts/local_fuse.sh
echo "✓ Fuse complete"

# ---- 6. Restart the modelserver launchd job so it picks up new weights ----
echo ""
echo "[4/4] Restarting mlx_lm.server to load new weights..."
MODELSERVER_LABEL="com.goalplanning.modelserver"
if launchctl list "$MODELSERVER_LABEL" >/dev/null 2>&1; then
  launchctl kickstart -k "gui/$UID/$MODELSERVER_LABEL"
  echo "✓ launchctl kickstart -k gui/$UID/$MODELSERVER_LABEL"
else
  echo "⚠️  $MODELSERVER_LABEL not loaded — run install_launchd_jobs.sh first"
  echo "    (Skipping restart. The next time the server starts it'll pick up the new model.)"
fi

echo ""
echo "============================================================"
echo "  finetune cycle complete: $(date -Iseconds)"
echo "============================================================"
