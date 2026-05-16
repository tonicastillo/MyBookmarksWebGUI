#!/usr/bin/env bash
#
# backup-prod.sh — Descarga un backup de la base de datos y las imágenes
# desde el servidor Dokploy de MyBookmarks2026.
#
# Estrategia: SSH al host Dokploy → localiza el contenedor de la app
# → snapshot consistente de SQLite con `.backup` → `docker cp` del .db
# y de la carpeta images → tar.gz local en backups/.
#
# Configuración: crea scripts/.env.backup (gitignored) con:
#   DOKPLOY_SSH=usuario@host                 # obligatorio
#   DOKPLOY_SSH_PORT=22                      # opcional
#   DOKPLOY_SSH_KEY=~/.ssh/id_rsa            # opcional, clave privada
#   APP_CONTAINER_NAME=                      # opcional; si vacío, autodetecta por compose project
#   COMPOSE_PROJECT=mybookmarks2026          # opcional, fallback para autodetección
#   REMOTE_DATA_PATH=/app/data               # opcional, ruta dentro del contenedor
#   LOCAL_BACKUP_DIR=./backups               # opcional, destino local
#
# Uso:
#   ./scripts/backup-prod.sh                 # backup completo (db + images)
#   ./scripts/backup-prod.sh --db-only       # solo bookmarks.db
#   ./scripts/backup-prod.sh --restore-local # extrae el último backup sobre backend/data/
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$SCRIPT_DIR/.env.backup"

# ── Carga de configuración ───────────────────────────────────────────────
if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
else
  echo "⚠️  No existe $ENV_FILE. Crea uno a partir de scripts/.env.backup.example." >&2
fi

DOKPLOY_SSH="${DOKPLOY_SSH:-}"
DOKPLOY_SSH_PORT="${DOKPLOY_SSH_PORT:-22}"
DOKPLOY_SSH_KEY="${DOKPLOY_SSH_KEY:-}"
APP_CONTAINER_NAME="${APP_CONTAINER_NAME:-}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-mybookmarks2026}"
REMOTE_DATA_PATH="${REMOTE_DATA_PATH:-/app/data}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-$PROJECT_ROOT/backups}"

if [[ -z "$DOKPLOY_SSH" ]]; then
  echo "❌ Falta DOKPLOY_SSH en $ENV_FILE (formato usuario@host)." >&2
  exit 1
fi

# Tolera formato usuario@host:puerto → extrae el puerto y limpia el host.
if [[ "$DOKPLOY_SSH" == *:* ]]; then
  DOKPLOY_SSH_PORT="${DOKPLOY_SSH##*:}"
  DOKPLOY_SSH="${DOKPLOY_SSH%:*}"
fi

# ── Flags ────────────────────────────────────────────────────────────────
DB_ONLY=false
RESTORE_LOCAL=false
for arg in "$@"; do
  case "$arg" in
    --db-only) DB_ONLY=true ;;
    --restore-local) RESTORE_LOCAL=true ;;
    -h|--help)
      sed -n '2,28p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *) echo "Argumento desconocido: $arg" >&2; exit 2 ;;
  esac
done

TS="$(date +%Y%m%d-%H%M%S)"
WORK_DIR="$(mktemp -d -t mybookmarks-backup.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

# Expande `~` y valida la clave si se especifica
SSH_KEY_ARGS=()
SCP_KEY_ARGS=()
SSH_REMOTE_OPT=""
if [[ -n "$DOKPLOY_SSH_KEY" ]]; then
  DOKPLOY_SSH_KEY="${DOKPLOY_SSH_KEY/#\~/$HOME}"
  if [[ ! -f "$DOKPLOY_SSH_KEY" ]]; then
    echo "❌ No existe la clave SSH: $DOKPLOY_SSH_KEY" >&2
    exit 1
  fi
  SSH_KEY_ARGS=(-i "$DOKPLOY_SSH_KEY")
  SCP_KEY_ARGS=(-i "$DOKPLOY_SSH_KEY")
  SSH_REMOTE_OPT="-i $DOKPLOY_SSH_KEY"
fi

SSH=(ssh -p "$DOKPLOY_SSH_PORT" "${SSH_KEY_ARGS[@]}" "$DOKPLOY_SSH")

# ── Modo restore local ──────────────────────────────────────────────────
if $RESTORE_LOCAL; then
  LATEST="$(ls -1t "$LOCAL_BACKUP_DIR"/mybookmarks-*.tar.gz 2>/dev/null | head -n1 || true)"
  if [[ -z "$LATEST" ]]; then
    echo "❌ No hay backups en ${LOCAL_BACKUP_DIR}." >&2
    exit 1
  fi
  DATA_DIR="$PROJECT_ROOT/backend/data"
  mkdir -p "$DATA_DIR"

  # Si el backend local está corriendo contra esta DB, el restore dejará
  # los .db-wal/.db-shm inconsistentes → SQLITE_CORRUPT al siguiente arranque.
  # Detectamos procesos que tengan abierto el fichero y avisamos.
  if command -v lsof >/dev/null 2>&1 && [[ -f "$DATA_DIR/bookmarks.db" ]]; then
    if lsof -- "$DATA_DIR/bookmarks.db" >/dev/null 2>&1; then
      echo "⚠️  bookmarks.db está siendo usado por otro proceso. Detén el backend local antes de restaurar." >&2
      lsof -- "$DATA_DIR/bookmarks.db" >&2 || true
      exit 1
    fi
  fi

  # Backup de seguridad del estado actual antes de pisar nada.
  if [[ -f "$DATA_DIR/bookmarks.db" ]]; then
    SAFE="$DATA_DIR/bookmarks.db.pre-restore-$(date +%Y%m%d-%H%M%S)"
    cp "$DATA_DIR/bookmarks.db" "$SAFE"
    echo "💾 Snapshot previo guardado en ${SAFE}"
  fi

  # Limpiar WAL/SHM huérfanos: si quedan, SQLite los aplicará sobre la
  # nueva DB y la marcará como malformed.
  rm -f "$DATA_DIR/bookmarks.db-wal" "$DATA_DIR/bookmarks.db-shm"

  echo "↩️  Restaurando ${LATEST} sobre ${DATA_DIR}/"
  tar -xzf "$LATEST" -C "$DATA_DIR"
  echo "✅ Restaurado. Arranca el backend local."
  exit 0
fi

mkdir -p "$LOCAL_BACKUP_DIR"

# ── Autodetección de contenedor ─────────────────────────────────────────
if [[ -z "$APP_CONTAINER_NAME" ]]; then
  echo "🔎 Detectando contenedor de la app en el host…"
  APP_CONTAINER_NAME="$("${SSH[@]}" "docker ps --filter 'label=com.docker.compose.project=${COMPOSE_PROJECT}' --filter 'label=com.docker.compose.service=app' --format '{{.Names}}' | head -n1")"
  if [[ -z "$APP_CONTAINER_NAME" ]]; then
    # Fallback: buscar cualquier contenedor cuyo nombre contenga 'app' del proyecto
    APP_CONTAINER_NAME="$("${SSH[@]}" "docker ps --format '{{.Names}}' | grep -i '${COMPOSE_PROJECT}.*app\\|app.*${COMPOSE_PROJECT}' | head -n1" || true)"
  fi
  if [[ -z "$APP_CONTAINER_NAME" ]]; then
    echo "❌ No pude autodetectar el contenedor. Define APP_CONTAINER_NAME en $ENV_FILE." >&2
    "${SSH[@]}" "docker ps --format 'table {{.Names}}\t{{.Image}}'" >&2 || true
    exit 1
  fi
  echo "   → $APP_CONTAINER_NAME"
fi

# ── Snapshot consistente de SQLite ──────────────────────────────────────
REMOTE_TMP="/tmp/mybookmarks-backup-$TS"
echo "📸 Creando snapshot consistente de bookmarks.db (sqlite .backup)…"
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
docker exec "$APP_CONTAINER_NAME" mkdir -p "$REMOTE_TMP"
# sqlite3 puede no estar; usamos el binario de node con better-sqlite3 si hace falta.
# Lo más portable: VACUUM INTO, que produce un .db consistente sin depender del WAL.
docker exec "$APP_CONTAINER_NAME" node -e "
  const Database = require('better-sqlite3');
  const db = new Database('$REMOTE_DATA_PATH/bookmarks.db', { readonly: true });
  db.exec(\"VACUUM INTO '$REMOTE_TMP/bookmarks.db'\");
  db.close();
"
EOF

# ── Copia al host y descarga ────────────────────────────────────────────
echo "📦 Copiando bookmarks.db al host Dokploy…"
"${SSH[@]}" "docker cp '$APP_CONTAINER_NAME:$REMOTE_TMP/bookmarks.db' '$REMOTE_TMP-bookmarks.db'"

if ! $DB_ONLY; then
  echo "📦 Copiando carpeta images/ al host Dokploy…"
  "${SSH[@]}" "docker cp '$APP_CONTAINER_NAME:$REMOTE_DATA_PATH/images' '$REMOTE_TMP-images' || mkdir -p '$REMOTE_TMP-images'"
fi

echo "⬇️  Descargando al equipo local…"
scp -P "$DOKPLOY_SSH_PORT" "${SCP_KEY_ARGS[@]}" "$DOKPLOY_SSH:$REMOTE_TMP-bookmarks.db" "$WORK_DIR/bookmarks.db"
if ! $DB_ONLY; then
  rsync -az -e "ssh -p $DOKPLOY_SSH_PORT $SSH_REMOTE_OPT" "$DOKPLOY_SSH:$REMOTE_TMP-images/" "$WORK_DIR/images/"
fi

# ── Limpieza remota ─────────────────────────────────────────────────────
"${SSH[@]}" bash -s <<EOF
docker exec "$APP_CONTAINER_NAME" rm -rf "$REMOTE_TMP" || true
rm -rf "$REMOTE_TMP-bookmarks.db" "$REMOTE_TMP-images" || true
EOF

# ── Empaquetado local ───────────────────────────────────────────────────
SUFFIX="full"; $DB_ONLY && SUFFIX="db"
ARCHIVE="$LOCAL_BACKUP_DIR/mybookmarks-$TS-$SUFFIX.tar.gz"
echo "🗜️  Empaquetando ${ARCHIVE}…"
if $DB_ONLY; then
  tar -czf "$ARCHIVE" -C "$WORK_DIR" bookmarks.db
else
  tar -czf "$ARCHIVE" -C "$WORK_DIR" bookmarks.db images
fi

# Rotación: conserva los últimos 10
ls -1t "$LOCAL_BACKUP_DIR"/mybookmarks-*.tar.gz 2>/dev/null | tail -n +11 | xargs -r rm -v

SIZE="$(du -h "$ARCHIVE" | awk '{print $1}')"
echo "✅ Backup listo: $ARCHIVE ($SIZE)"
echo "   Restaurar en local con:  ./scripts/backup-prod.sh --restore-local"
