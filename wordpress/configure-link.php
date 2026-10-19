<?php
/**
 * Relie WordPress au site à partir du fichier .env du projet (clés partagées, adresses) :
 *   php wordpress/.local/wp-cli.phar --path=wordpress/.local/wp eval-file wordpress/configure-link.php
 * Les clés ne sont jamais affichées.
 */
$env = [];
foreach (file(dirname(__DIR__) . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $line) {
    if ($line[0] === '#' || !str_contains($line, '=')) {
        continue;
    }
    [$k, $v] = explode('=', $line, 2);
    $env[trim($k)] = trim($v, " \t\"'");
}
$site = rtrim($env['NEXT_PUBLIC_SITE_URL'] ?? $env['NEXTAUTH_URL'] ?? 'http://localhost:3000', '/');
$settings = array_merge(tatos_settings(), [
    'siteUrl' => $site,
    'adminApiSecret' => $env['ADMIN_API_SECRET'] ?? '',
    'webhookUrl' => $site . '/api/webhooks/wordpress',
    'webhookSecret' => $env['WORDPRESS_WEBHOOK_SECRET'] ?? '',
]);
update_option('tatos_settings', $settings);
delete_transient('tatos_stats');
WP_CLI::success('Liaison configurée vers ' . $site . ' (clé d\'administration ' . ($settings['adminApiSecret'] ? 'définie' : 'MANQUANTE') . ', webhook ' . ($settings['webhookSecret'] ? 'défini' : 'MANQUANT') . ').');
