#!/usr/bin/env bash
# Installe un WordPress local de développement (SQLite, sans MySQL ni Docker) avec le plugin
# « TATOS Headless », puis importe le contenu répliqué.
#
#   bash wordpress/setup-local.sh          # installation + import
#   bash wordpress/setup-local.sh serve    # démarre le serveur PHP sur http://localhost:8080
#
# Prérequis : PHP >= 8.1 avec pdo_sqlite, curl, unzip (ou python3), Node (pour l'export).
set -euo pipefail
# Git Bash (Windows) convertit sinon les arguments commençant par « / » en chemins Windows.
export MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL="*"
ROOT="$(cd "$(dirname "$0")/.." && (pwd -W 2>/dev/null || pwd))" # pwd -W : chemin Windows sous Git Bash
LOCAL="$ROOT/wordpress/.local"
WP_DIR="$LOCAL/wp"
PORT="${WP_PORT:-8080}"
WP="php $LOCAL/wp-cli.phar --path=$WP_DIR"

unzip_to() { # $1 = zip, $2 = destination
  if command -v unzip >/dev/null 2>&1; then unzip -q -o "$1" -d "$2"; else python3 -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$1" "$2" || python -c "import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])" "$1" "$2"; fi
}

if [ "${1:-}" = "serve" ]; then
  echo "WordPress : http://localhost:$PORT  (API : http://localhost:$PORT/wp-json)"
  exec php -S "localhost:$PORT" -t "$WP_DIR" "$WP_DIR/router.php"
fi

mkdir -p "$LOCAL/downloads"
cd "$LOCAL/downloads"
[ -f wordpress.zip ] || curl -fsSL -o wordpress.zip https://wordpress.org/latest.zip
[ -f sqlite.zip ] || curl -fsSL -o sqlite.zip https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
[ -f "$LOCAL/wp-cli.phar" ] || curl -fsSL -o "$LOCAL/wp-cli.phar" https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar

if [ ! -f "$WP_DIR/wp-load.php" ]; then
  rm -rf "$LOCAL/extract" && mkdir -p "$LOCAL/extract"
  unzip_to wordpress.zip "$LOCAL/extract"
  mv "$LOCAL/extract/wordpress" "$WP_DIR"
  unzip_to sqlite.zip "$WP_DIR/wp-content/plugins"
  cp "$WP_DIR/wp-content/plugins/sqlite-database-integration/db.copy" "$WP_DIR/wp-content/db.php"
  sed -i "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$WP_DIR/wp-content/plugins/sqlite-database-integration#; s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" "$WP_DIR/wp-content/db.php"
fi

# Routeur pour le serveur PHP intégré (permaliens « jolis » et /wp-json).
cat > "$WP_DIR/router.php" <<'PHP'
<?php
// Routeur du serveur PHP intégré : fichiers servis tels quels, index.php des dossiers (ex. /wp-admin/),
// tout le reste vers WordPress.
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$target = __DIR__ . $path;
if ($path !== '/' && is_dir($target) && is_file(rtrim($target, '/') . '/index.php')) {
    $script = rtrim($path, '/') . '/index.php';
    $_SERVER['SCRIPT_NAME'] = $_SERVER['PHP_SELF'] = $script;
    $_SERVER['SCRIPT_FILENAME'] = __DIR__ . $script;
    chdir(dirname(__DIR__ . $script));
    require __DIR__ . $script;
    return;
}
if ($path !== '/' && file_exists($target) && !is_dir($target)) { return false; }
require __DIR__ . '/index.php';
PHP

# Plugin TATOS Headless (copie : les liens symboliques ne sont pas fiables sous Windows).
rm -rf "$WP_DIR/wp-content/plugins/tatos-headless"
cp -r "$ROOT/wordpress/plugins/tatos-headless" "$WP_DIR/wp-content/plugins/tatos-headless"

if [ ! -f "$WP_DIR/wp-config.php" ]; then
  $WP config create --dbname=wordpress --dbuser=unused --dbpass=unused --skip-check --extra-php <<'PHP'
define('DB_DIR', __DIR__ . '/wp-content/database/');
define('DB_FILE', 'tatos.sqlite');
define('WP_ENVIRONMENT_TYPE', 'local');
PHP
fi

if ! $WP core is-installed 2>/dev/null; then
  PASS="$(php -r 'echo bin2hex(random_bytes(12));')"
  $WP core install --url="http://localhost:$PORT" --title="TATOS CMS" --admin_user=admin --admin_password="$PASS" --admin_email=admin@tatos.test --skip-email
  printf 'URL : http://localhost:%s/wp-admin\nIdentifiant : admin\nMot de passe : %s\n' "$PORT" "$PASS" > "$LOCAL/admin-credentials.txt"
  echo "Identifiants admin locaux enregistrés dans wordpress/.local/admin-credentials.txt"
fi

$WP option update home "http://localhost:$PORT" >/dev/null
$WP option update siteurl "http://localhost:$PORT" >/dev/null
$WP rewrite structure '/%postname%/' >/dev/null
$WP rewrite flush >/dev/null
$WP plugin activate sqlite-database-integration tatos-headless

(cd "$ROOT" && npm run --silent wp:export)
$WP tatos import "$ROOT/wordpress/export/wordpress-import.json" ${WP_IMPORT_LIMIT:+--limit=$WP_IMPORT_LIMIT}
# Liaison avec le site (adresse, clé d'administration, webhook) lue dans le .env du projet.
$WP eval-file "$ROOT/wordpress/configure-link.php"
echo "Terminé. Démarrez WordPress avec : bash wordpress/setup-local.sh serve"
