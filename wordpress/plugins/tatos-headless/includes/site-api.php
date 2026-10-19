<?php
/**
 * Liaison WordPress → site (Next.js) : appels serveur à serveur vers /api/admin/*, authentifiés par
 * la clé d'administration partagée (réglage « Clé d'administration » = ADMIN_API_SECRET du site).
 */

if (!defined('ABSPATH')) {
    exit;
}

/** Adresse publique du site (frontend), sans barre finale. */
function tatos_site_url(): string
{
    $s = tatos_settings();
    $url = trim((string) ($s['siteUrl'] ?? ''));
    if ($url === '' && !empty($s['webhookUrl'])) {
        $url = preg_replace('#/api/webhooks/wordpress/?$#', '', (string) $s['webhookUrl']);
    }
    return untrailingslashit($url);
}

/** Capacité requise pour l'espace « Boutique » (administrateurs et gestionnaires de boutique). */
function tatos_shop_cap(): string
{
    return (string) apply_filters('tatos_shop_capability', 'tatos_manage_shop');
}

/**
 * Rôle « Gestionnaire de boutique » (commandes, clients, stock, promotions, messages, contenus,
 * menus) ; les administrateurs ont aussi la capacité. Créé ou mis à jour une fois par version.
 */
add_action('init', function () {
    if (get_option('tatos_roles_version') === TATOS_HEADLESS_VERSION) {
        return;
    }
    $editor = get_role('editor');
    remove_role('tatos_shop_manager');
    add_role('tatos_shop_manager', 'Gestionnaire de boutique', array_merge($editor ? $editor->capabilities : ['read' => true], ['tatos_manage_shop' => true, 'edit_theme_options' => true, 'list_users' => true]));
    get_role('administrator')?->add_cap('tatos_manage_shop');
    update_option('tatos_roles_version', TATOS_HEADLESS_VERSION);
});

/**
 * Appel de l'API d'administration du site. Renvoie ['ok' => bool, 'status' => int, 'data' => mixed,
 * 'error' => string, 'body' => string brut, 'headers' => array].
 */
function tatos_site_request(string $method, string $path, ?array $body = null, int $timeout = 20): array
{
    $base = tatos_site_url();
    $key = (string) (tatos_settings()['adminApiSecret'] ?? '');
    if ($base === '' || $key === '') {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => "Liaison avec le site non configurée : renseignez l'adresse du site et la clé d'administration dans Réglages → Site et magasin.", 'body' => '', 'headers' => []];
    }
    $args = [
        'method' => $method,
        'timeout' => $timeout,
        'headers' => ['Authorization' => 'Bearer ' . $key, 'Accept' => 'application/json'],
    ];
    if ($body !== null) {
        $args['headers']['Content-Type'] = 'application/json';
        $args['body'] = wp_json_encode($body);
    }
    $res = wp_remote_request($base . '/api/admin/' . ltrim($path, '/'), $args);
    if (is_wp_error($res)) {
        return ['ok' => false, 'status' => 0, 'data' => null, 'error' => 'Le site ne répond pas (' . $res->get_error_message() . '). Vérifiez qu\'il est démarré et que son adresse est correcte.', 'body' => '', 'headers' => []];
    }
    $status = (int) wp_remote_retrieve_response_code($res);
    $raw = (string) wp_remote_retrieve_body($res);
    $data = json_decode($raw, true);
    $ok = $status >= 200 && $status < 300;
    $error = $ok ? '' : (is_array($data) && !empty($data['error']) ? (string) $data['error'] : 'Erreur ' . $status . ' du site.');
    return ['ok' => $ok, 'status' => $status, 'data' => $data, 'error' => $error, 'body' => $raw, 'headers' => wp_remote_retrieve_headers($res)];
}

/** Formats d'affichage partagés par les écrans d'administration. */
function tatos_eur($cents): string
{
    return number_format(((int) $cents) / 100, 2, ',', ' ') . ' €';
}

function tatos_date($iso, bool $time = true): string
{
    if (!$iso) {
        return '—';
    }
    $ts = strtotime((string) $iso);
    return $ts ? wp_date($time ? 'j M Y, H:i' : 'j M Y', $ts) : '—';
}

/** Lien public d'un contenu sur le site (aperçu « Voir sur le site »). */
function tatos_public_path(WP_Post $post): ?string
{
    switch ($post->post_type) {
        case 'produit':
            return '/boutique/' . tatos_product_slug($post);
        case 'post':
            return '/conseils/' . $post->post_name;
        case 'page':
            if ($post->post_name === 'accueil') {
                return '/';
            }
            return in_array($post->post_name, ['categorie'], true) ? null : '/' . $post->post_name;
        default:
            return null;
    }
}
