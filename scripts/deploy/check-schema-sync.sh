#!/usr/bin/env bash
# check-schema-sync.sh — Check schema consistency between Prisma schema
#                          and a target database (staging or production).
#
# Uses `prisma migrate diff --from-schema --to-config-datasource --exit-code`
# to compare the Prisma schema file against the actual database schema.
# Any difference blocks deployment.
#
# Run from your local Mac:
#   bash scripts/deploy/check-schema-sync.sh --env production
#   bash scripts/deploy/check-schema-sync.sh --env staging
#   bash scripts/deploy/check-schema-sync.sh --dry-run
#   bash scripts/deploy/check-schema-sync.sh --verbose --env production
#
# Exit codes:
#   0 = schemas are in sync (no diff)
#   2 = schema drift detected (differences exist)
#   1 = error occurred (SSH, Docker, etc.)

set -euo pipefail

# ── Resolve project directory ─────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.deploy.local}"

# ── Parse flags ───────────────────────────────────────────────────────────────

TARGET_ENV="production"
DRY_RUN=false
VERBOSE=false

while [ $# -gt 0 ]; do
  case "$1" in
    --env)         TARGET_ENV="$2"; shift 2 ;;
    --dry-run)     DRY_RUN=true; shift ;;
    --verbose|-v)  VERBOSE=true; shift ;;
    --help|-h)
      echo "Usage: $0 [--env staging|production] [--dry-run] [--verbose]"
      echo ""
      echo "Check schema consistency between code migrations and target database."
      echo "  --env        Target environment (default: production)"
      echo "  --dry-run    Show what would be executed without running"
      echo "  --verbose    Show full diff output on mismatch"
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$1" >&2
      exit 1
      ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────────────────────

log()    { printf '[check-schema-sync] %s\n' "$*"; }
warn()   { printf '[check-schema-sync] WARNING: %s\n' "$*" >&2; }
die()    { printf '[check-schema-sync] ERROR: %s\n' "$*" >&2; exit 1; }

# ── Load deploy config ────────────────────────────────────────────────────────

if [ ! -f "$ENV_FILE" ]; then
  die "Config file not found: $ENV_FILE\n  Copy from template: cp .env.deploy.example .env.deploy.local"
fi

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# ── Configure target based on environment ─────────────────────────────────────

case "$TARGET_ENV" in
  production)
    SSH_TARGET="${SERVER_USER:-root}@${SERVER_HOST:-47.119.182.210}"
    SSH_PORT="${SERVER_PORT:-22}"
    SSH_KEY="${SERVER_SSH_KEY_PATH:+-i $SERVER_SSH_KEY_PATH}"
    COMPOSE_FILE="docker-compose.prod.yml"
    ENV_ON_SERVER=".env.production"
    DEPLOY_DIR="${SERVER_DEPLOY_DIR:-/opt/shenlun-material-hub}"
    ;;
  staging)
    # Staging runs on carry-pc via Tailscale
    STAGING_HOST="${STAGING_HOST:-100.117.96.1}"
    STAGING_USER="${STAGING_USER:-carry}"
    SSH_TARGET="${STAGING_USER}@${STAGING_HOST}"
    SSH_PORT="22"
    SSH_KEY=""
    COMPOSE_FILE="docker-compose.staging.yml"
    ENV_ON_SERVER=".env.staging"
    DEPLOY_DIR="${STAGING_DEPLOY_DIR:-/home/carry/shenlun-material-hub-staging}"
    ;;
  *)
    die "Unknown environment: $TARGET_ENV (use 'staging' or 'production')"
    ;;
esac

SSH_OPTS="${SSH_KEY:+-i $SSH_KEY} -p $SSH_PORT -o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"

# ── Display check plan ─────────────────────────────────────────────────────────

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  Schema Consistency Check                                   ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Target:  ${TARGET_ENV} (${SSH_TARGET})"
echo "║  Method:  prisma migrate diff --from-schema --to-config-datasource"
echo "║  Mode:    BLOCKING (any diff stops deployment)"
if [ "$DRY_RUN" = true ]; then
echo "║  *** DRY RUN — no checks will be executed ***"
fi
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# ── Dry run exit ───────────────────────────────────────────────────────────────

if [ "$DRY_RUN" = true ]; then
  log "DRY RUN — would execute:"
  log "  ssh $SSH_OPTS $SSH_TARGET \\"
  log "    \"cd ${DEPLOY_DIR} && set -a && source ${ENV_ON_SERVER} && set +a && \\"
  log "     docker compose -f ${COMPOSE_FILE} --env-file ${ENV_ON_SERVER} run --rm --no-deps app \\"
  log "       npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code\""
  exit 0
fi

# ── Run schema diff check ─────────────────────────────────────────────────────

log "Checking schema consistency against ${TARGET_ENV} database..."

# Build the remote command
# --exit-code: 0 = no diff, 1 = error, 2 = diff exists
DIFF_CMD="npx prisma migrate diff --from-schema prisma/schema.prisma --to-config-datasource --exit-code"

if [ "$VERBOSE" = true ]; then
  # Verbose mode: capture and display the full diff output
  DIFF_OUTPUT=$(ssh $SSH_OPTS "$SSH_TARGET" \
    "cd ${DEPLOY_DIR} && set -a && source ${ENV_ON_SERVER} && set +a && \
     docker compose -f ${COMPOSE_FILE} --env-file ${ENV_ON_SERVER} run --rm --no-deps app \
     ${DIFF_CMD}" 2>&1) || DIFF_EXIT=$?

  DIFF_EXIT="${DIFF_EXIT:-0}"

  if [ "$DIFF_EXIT" -ne 0 ]; then
    echo ""
    echo "── Schema diff output ──────────────────────────────────────"
    echo "$DIFF_OUTPUT"
    echo "────────────────────────────────────────────────────────────"
    echo ""
  fi
else
  # Normal mode: just check the exit code
  ssh $SSH_OPTS "$SSH_TARGET" \
    "cd ${DEPLOY_DIR} && set -a && source ${ENV_ON_SERVER} && set +a && \
     docker compose -f ${COMPOSE_FILE} --env-file ${ENV_ON_SERVER} run --rm --no-deps app \
     ${DIFF_CMD}" >/dev/null 2>&1 || DIFF_EXIT=$?

  DIFF_EXIT="${DIFF_EXIT:-0}"
fi

# ── Interpret result ──────────────────────────────────────────────────────────

case "$DIFF_EXIT" in
  0)
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ✅  SCHEMA IN SYNC                                         ║"
    echo "║  Code migrations match ${TARGET_ENV} database schema"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    exit 0
    ;;
  2)
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║  ❌  SCHEMA DRIFT DETECTED                                  ║"
    echo "║  Code migrations do NOT match ${TARGET_ENV} database"
    echo "║  Deployment is BLOCKED                                      ║"
    echo "╠══════════════════════════════════════════════════════════════╣"
    echo "║  Run with --verbose to see the full diff:                  ║"
    echo "║  bash $0 --env ${TARGET_ENV} --verbose"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    exit 2
    ;;
  *)
    die "Schema check failed with exit code ${DIFF_EXIT}. This may be an SSH or Docker error. Check connectivity to ${SSH_TARGET}."
    ;;
esac
