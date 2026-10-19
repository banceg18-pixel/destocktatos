<?php
/**
 * Import du contenu répliqué (export généré par `npm run wp:export`) dans WordPress.
 */

if (!defined('ABSPATH')) {
    exit;
}

class Tatos_CLI
{
    /**
     * Importe catégories, produits, pages, FAQ, réglages et menus.
     *
     * ## OPTIONS
     *
     * <file>
     * : Fichier JSON produit par `npm run wp:export`.
     *
     * [--limit=<n>]
     * : Nombre maximum de produits à importer (tests).
     *
     * ## EXAMPLES
     *
     *     wp tatos import ../export/wordpress-import.json
     */
    public function import($args, $assoc)
    {
        [$file] = $args;
        if (!is_readable($file)) {
            WP_CLI::error("Fichier introuvable : $file");
        }
        $data = json_decode(file_get_contents($file), true);
        if (!is_array($data)) {
            WP_CLI::error('JSON invalide');
        }
        $limit = isset($assoc['limit']) ? (int) $assoc['limit'] : PHP_INT_MAX;
        tatos_import($data, fn($m) => WP_CLI::log($m), $limit);
        tatos_notify_frontend('sync.full');
        WP_CLI::success('Import terminé');
    }
}
