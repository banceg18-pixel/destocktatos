<?php
/**
 * Plugin Name: TATOS Headless
 * Description: Espace d'administration complet du site TATOS (Next.js) : produits, catégories, pages, articles, FAQ, menus, réglages, et gestion de la boutique (commandes, clients, codes promo, avis, messages, newsletter, stock).
 * Version: 2.3.0
 * Requires PHP: 8.1
 * License: GPL-2.0-or-later
 * Text Domain: tatos-headless
 */

if (!defined('ABSPATH')) {
    exit;
}

define('TATOS_HEADLESS_VERSION', '2.3.0');

/* -------------------------------------------------------------------------
 * Types de contenu et taxonomies
 * ---------------------------------------------------------------------- */
add_action('init', function () {
    register_post_type('produit', [
        'label' => 'Produits',
        'labels' => ['singular_name' => 'Produit', 'add_new_item' => 'Ajouter un produit', 'edit_item' => 'Modifier le produit'],
        'public' => true,
        'show_in_rest' => true,
        'rest_base' => 'produits',
        'menu_icon' => 'dashicons-cart',
        'supports' => ['title', 'editor', 'thumbnail', 'custom-fields', 'excerpt'],
        'has_archive' => false,
        'rewrite' => ['slug' => 'boutique'],
    ]);

    register_taxonomy('categorie_produit', ['produit'], [
        'label' => 'Catégories produit',
        'hierarchical' => true,
        'show_in_rest' => true,
        'rest_base' => 'categories-produit',
        'rewrite' => ['slug' => 'categorie'],
    ]);

    register_post_type('faq', [
        'label' => 'FAQ',
        'labels' => ['singular_name' => 'Question'],
        'public' => false,
        'show_ui' => true,
        'show_in_rest' => true,
        'menu_icon' => 'dashicons-editor-help',
        'supports' => ['title', 'editor', 'page-attributes'],
    ]);
    register_taxonomy('faq_categorie', ['faq'], [
        'label' => 'Catégories FAQ',
        'hierarchical' => true,
        'show_ui' => true,
        'show_in_rest' => true,
    ]);

    // Champs produit (exposés dans l'API REST, modifiables dans l'éditeur).
    $product_meta = [
        'tatos_id' => 'string',
        'marque' => 'string',
        'modele' => 'string',
        'prix' => 'number',
        'promotion_prix' => 'number',
        'stock' => 'integer',
        'caracteristiques' => 'string', // JSON {profondeur, largeur, hauteur, poids}
        'garantie' => 'string', // JSON {duree, descriptif}
        'pose' => 'string',
        'couleurs' => 'string', // JSON ["#fff"]
        'sous_categories' => 'string', // JSON ["hublot"]
        'connecter' => 'boolean',
        'vedette' => 'boolean',
        'magasin' => 'boolean',
        'sonore' => 'integer',
        'image_principale' => 'string',
        'images' => 'string', // JSON ["url", ...]
        'etiquette_energie' => 'string',
        'meta_title' => 'string',
        'meta_description' => 'string',
    ];
    foreach ($product_meta as $key => $type) {
        register_post_meta('produit', $key, [
            'type' => $type,
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => fn() => current_user_can('edit_posts'),
        ]);
    }

    foreach (['ordre' => 'integer', 'image' => 'string', 'description_courte' => 'string'] as $key => $type) {
        register_term_meta('categorie_produit', $key, ['type' => $type, 'single' => true, 'show_in_rest' => true]);
    }

    // Données structurées des pages (héros, cartes…) : JSON identique aux fichiers data/content/pages/*.json.
    foreach (['tatos_data', 'tatos_meta_title', 'tatos_meta_description'] as $key) {
        register_post_meta('page', $key, [
            'type' => 'string',
            'single' => true,
            'show_in_rest' => true,
            'auth_callback' => fn() => current_user_can('edit_pages'),
        ]);
    }

    register_nav_menus(['header' => 'Menu principal (en-tête)', 'footer-legal' => 'Liens légaux (pied de page)']);
});

/* -------------------------------------------------------------------------
 * Réglages du site (coordonnées, horaires, webhook)
 * ---------------------------------------------------------------------- */
const TATOS_SETTINGS_FIELDS = [
    'siteName' => 'Nom du site',
    'description' => 'Description',
    'email' => 'Email de contact',
    'phone' => 'Téléphone',
    'phoneIntl' => 'Téléphone (format international)',
    'addressLine' => 'Adresse',
    'postalCode' => 'Code postal',
    'city' => 'Ville',
    'country' => 'Pays',
    'hours' => 'Horaires (pied de page)',
    'storeHours' => 'Horaires du magasin',
    'mapQuery' => 'Adresse pour la carte',
    'bannerMessage1' => 'Message 1',
    'bannerMessage2' => 'Message 2 (alterne avec le 1, facultatif)',
    'bankHolder' => 'Titulaire du compte',
    'bankName' => 'Banque',
    'bankIban' => 'IBAN',
    'bankBic' => 'BIC',
    'siteUrl' => 'Adresse publique du site, commençant par https://',
    'adminApiSecret' => "Clé d'administration (ADMIN_API_SECRET du site)",
    'webhookUrl' => 'URL du webhook (facultatif : adresse du site + /api/webhooks/wordpress par défaut)',
    'webhookSecret' => 'Secret du webhook (facultatif : clé d\'administration par défaut)',
];

/** Réglages techniques (liaison avec le site), regroupés à part sur la page de réglages. */
const TATOS_TECHNICAL_FIELDS = ['siteUrl', 'adminApiSecret', 'webhookUrl', 'webhookSecret'];
const TATOS_SECRET_FIELDS = ['adminApiSecret', 'webhookSecret'];
/** Bandeau rouge fixé tout en haut du site (laisser vide pour le masquer). */
const TATOS_BANNER_FIELDS = ['bannerMessage1', 'bannerMessage2'];
/** Coordonnées bancaires du virement : imprimées sur la facture et envoyées au client à la commande. */
const TATOS_BANK_FIELDS = ['bankHolder', 'bankName', 'bankIban', 'bankBic'];

function tatos_settings(): array
{
    $defaults = [
        'siteName' => 'Destocktatos',
        'description' => 'Électroménager de qualité au meilleur prix',
        'country' => 'France',
    ];
    return array_merge($defaults, (array) get_option('tatos_settings', []));
}

add_action('admin_menu', function () {
    add_options_page('Site et magasin', 'Site et magasin', 'manage_options', 'tatos-headless', function () {
        $s = tatos_settings();
        echo '<div class="wrap"><h1>Réglages du site</h1>';
        if (isset($_GET['tatos_check'])) {
            $ping = tatos_site_request('GET', 'ping', null, 10);
            echo $ping['ok']
                ? '<div class="notice notice-success"><p>Liaison réussie avec ' . esc_html($ping['data']['site'] ?? tatos_site_url()) . '. Emails : ' . (!empty($ping['data']['smtp']) ? 'envoi actif' : 'pas encore envoyés (serveur d\'envoi SMTP à configurer sur le site, voir le guide d\'utilisation)') . '.</p></div>'
                : '<div class="notice notice-error"><p>' . esc_html($ping['error']) . '</p></div>';
            // Mise à jour instantanée : le site reçoit-il les modifications faites ici ?
            $hook = tatos_send_webhook('ping', [], true);
            $code = is_wp_error($hook) ? 0 : (int) wp_remote_retrieve_response_code($hook);
            echo $code === 200
                ? '<div class="notice notice-success"><p>Mise à jour instantanée active : chaque modification enregistrée ici apparaît sur le site en quelques secondes.</p></div>'
                : '<div class="notice notice-error"><p>Mise à jour instantanée en échec ('
                    . esc_html(is_wp_error($hook) ? $hook->get_error_message() : ($code === 401 ? 'clé refusée par le site : vérifiez la clé d\'administration ou le secret du webhook' : 'réponse HTTP ' . $code))
                    . '). Les modifications n\'arriveront pas sur le site tant que ce point n\'est pas corrigé.</p></div>';
        }
        echo '<form method="post" action="options.php">';
        settings_fields('tatos_settings');
        $groups = [
            'Coordonnées affichées sur le site' => array_diff(array_keys(TATOS_SETTINGS_FIELDS), TATOS_TECHNICAL_FIELDS, TATOS_BANNER_FIELDS, TATOS_BANK_FIELDS),
            'Bandeau du haut de page (laisser vide pour le masquer)' => TATOS_BANNER_FIELDS,
            'Paiement par virement (coordonnées imprimées sur la facture envoyée au client)' => TATOS_BANK_FIELDS,
            'Liaison avec le site (technique)' => TATOS_TECHNICAL_FIELDS,
        ];
        foreach ($groups as $title => $keys) {
            echo '<h2>' . esc_html($title) . '</h2><table class="form-table">';
            foreach ($keys as $key) {
                $type = in_array($key, TATOS_SECRET_FIELDS, true) ? 'password' : 'text';
                printf(
                    '<tr><th><label for="%1$s">%2$s</label></th><td><input class="%5$s" type="%4$s" id="%1$s" name="tatos_settings[%1$s]" value="%3$s" autocomplete="off"></td></tr>',
                    esc_attr($key),
                    esc_html(TATOS_SETTINGS_FIELDS[$key]),
                    esc_attr($s[$key] ?? ''),
                    $type,
                    in_array($key, TATOS_BANNER_FIELDS, true) ? 'large-text' : 'regular-text'
                );
            }
            echo '</table>';
        }
        submit_button('Enregistrer les réglages');
        echo '</form>';
        printf('<p><a class="button" href="%s">Vérifier la liaison avec le site</a></p>', esc_url(add_query_arg('tatos_check', '1')));
        echo '<h2>Contenus du site</h2><p class="description" style="max-width:720px">Remplit WordPress avec les contenus actuels du site : coordonnées, pages, articles, FAQ, menus, catégories et produits. À faire une fois, après avoir enregistré la liaison ci-dessus. Relancer l\'import met à jour les contenus sans créer de doublons (vos modifications faites dans WordPress sur ces mêmes contenus seraient remplacées).</p>';
        printf('<p><button type="button" class="button button-primary" id="tatos-import" data-nonce="%s">Importer les contenus du site</button></p><div id="tatos-import-log" class="tatos-import-log" aria-live="polite"></div></div>', esc_attr(wp_create_nonce('tatos_import')));
    });
});

add_action('admin_init', function () {
    register_setting('tatos_settings', 'tatos_settings', [
        'type' => 'array',
        'sanitize_callback' => function ($input) {
            $out = [];
            foreach (array_keys(TATOS_SETTINGS_FIELDS) as $key) {
                $out[$key] = isset($input[$key]) ? sanitize_text_field($input[$key]) : '';
            }
            return $out;
        },
    ]);
});

/* -------------------------------------------------------------------------
 * Endpoints REST /tatos/v1
 * ---------------------------------------------------------------------- */
function tatos_json_meta($post_id, string $key, $fallback)
{
    $raw = get_post_meta($post_id, $key, true);
    if ($raw === '' || $raw === null) {
        return $fallback;
    }
    $decoded = json_decode((string) $raw, true);
    return $decoded === null ? $fallback : $decoded;
}

/**
 * Texte brut d'un contenu WordPress : commentaires de blocs et vraies balises retirés, entités
 * décodées. Un « < » isolé (« < 30 min ») est conservé, contrairement à wp_strip_all_tags().
 */
function tatos_plain_text(string $html): string
{
    $text = preg_replace('/<!--.*?-->/s', '', $html);
    $text = preg_replace('/<\/?[a-zA-Z][^>]*>/', '', $text);
    return html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
}

/** Slug public : WordPress limite post_name à 200 caractères, le slug d'origine complet est conservé en méta. */
function tatos_product_slug(WP_Post $p): string
{
    $full = (string) get_post_meta($p->ID, 'tatos_slug', true);
    return $full !== '' && str_starts_with($full, $p->post_name) ? $full : $p->post_name;
}

/** Identifiant commercial du produit (identique à la base du frontend), 24 caractères. */
function tatos_product_id(int $post_id): string
{
    return get_post_meta($post_id, 'tatos_id', true) ?: 'wp' . str_pad((string) $post_id, 22, '0', STR_PAD_LEFT);
}

function tatos_product_to_array(WP_Post $p): array
{
    $terms = wp_get_post_terms($p->ID, 'categorie_produit');
    $cat = $terms && !is_wp_error($terms) ? $terms[0] : null;
    $promo = get_post_meta($p->ID, 'promotion_prix', true);
    $sonore = get_post_meta($p->ID, 'sonore', true);
    $thumb = get_the_post_thumbnail_url($p, 'full');
    return [
        'id' => tatos_product_id($p->ID),
        'wpId' => $p->ID,
        'slug' => tatos_product_slug($p),
        // post_title brut : get_the_title() appliquerait wptexturize (guillemets typographiques).
        'titre' => $p->post_title,
        'marque' => (string) get_post_meta($p->ID, 'marque', true),
        'modele' => (string) get_post_meta($p->ID, 'modele', true),
        'prix' => (float) get_post_meta($p->ID, 'prix', true),
        'promotionPrix' => $promo === '' ? null : (float) $promo,
        'stock' => (int) get_post_meta($p->ID, 'stock', true),
        'categorie' => $cat ? $cat->name : 'autres',
        'categorieSlug' => $cat ? $cat->slug : 'autres',
        'sousCategorie' => tatos_json_meta($p->ID, 'sous_categories', []),
        'description' => tatos_plain_text($p->post_content),
        'caracteristiques' => tatos_json_meta($p->ID, 'caracteristiques', new stdClass()),
        'garantie' => tatos_json_meta($p->ID, 'garantie', null),
        'pose' => get_post_meta($p->ID, 'pose', true) ?: null,
        'couleur' => tatos_json_meta($p->ID, 'couleurs', []),
        'connecter' => (bool) get_post_meta($p->ID, 'connecter', true),
        'vedette' => (bool) get_post_meta($p->ID, 'vedette', true),
        'magasin' => (bool) get_post_meta($p->ID, 'magasin', true),
        'sonore' => $sonore === '' ? null : (int) $sonore,
        'imagePrincipale' => $thumb ?: (get_post_meta($p->ID, 'image_principale', true) ?: null),
        'images' => tatos_json_meta($p->ID, 'images', []),
        'etiquetteEnergie' => get_post_meta($p->ID, 'etiquette_energie', true) ?: null,
        'metaTitle' => get_post_meta($p->ID, 'meta_title', true) ?: null,
        'metaDescription' => get_post_meta($p->ID, 'meta_description', true) ?: null,
        'createdAt' => get_post_time('c', true, $p),
        'updatedAt' => get_post_modified_time('c', true, $p),
    ];
}

function tatos_menu_items(string $location): array
{
    $locations = get_nav_menu_locations();
    if (empty($locations[$location])) {
        return [];
    }
    $items = wp_get_nav_menu_items($locations[$location]) ?: [];
    $home = untrailingslashit(home_url());
    return array_map(function ($item) use ($home) {
        $url = $item->url;
        if (str_starts_with($url, $home)) {
            $url = substr($url, strlen($home)) ?: '/';
        }
        $out = ['label' => html_entity_decode($item->title, ENT_QUOTES), 'href' => $url];
        $dataCy = get_post_meta($item->ID, '_tatos_data_cy', true);
        if ($dataCy) {
            $out['dataCy'] = $dataCy; // attribut data-cy d'origine (tests E2E)
        }
        return $out;
    }, $items);
}

/**
 * Réponses de l'API REST jamais mises en cache devant WordPress (LiteSpeed Cache, CDN de l'hébergeur) :
 * le site garde sa propre copie des contenus et la renouvelle dès qu'ils changent (webhook). Une réponse
 * gardée en cache lui renverrait l'ancienne version pendant des heures.
 */
add_filter('rest_post_dispatch', function ($response) {
    if ($response instanceof WP_HTTP_Response) {
        $response->header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0');
        $response->header('X-LiteSpeed-Cache-Control', 'no-cache');
    }
    do_action('litespeed_control_set_nocache', 'API REST lue par le site');
    return $response;
});

add_action('rest_api_init', function () {
    $public = '__return_true';

    register_rest_route('tatos/v1', '/settings', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => function () {
            $s = tatos_settings();
            unset($s['webhookUrl'], $s['webhookSecret'], $s['adminApiSecret'], $s['siteUrl']);
            return rest_ensure_response($s);
        },
    ]);

    register_rest_route('tatos/v1', '/menus', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => fn() => rest_ensure_response([
            'header' => tatos_menu_items('header'),
            'footerLegal' => tatos_menu_items('footer-legal'),
        ]),
    ]);

    register_rest_route('tatos/v1', '/faq', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => function () {
            $out = [];
            $cats = get_terms(['taxonomy' => 'faq_categorie', 'hide_empty' => true]);
            usort($cats, fn($a, $b) => (int) get_term_meta($a->term_id, 'ordre', true) <=> (int) get_term_meta($b->term_id, 'ordre', true));
            foreach ($cats as $cat) {
                $posts = get_posts(['post_type' => 'faq', 'numberposts' => -1, 'orderby' => 'menu_order', 'order' => 'ASC', 'tax_query' => [['taxonomy' => 'faq_categorie', 'terms' => $cat->term_id]]]);
                $out[] = [
                    'title' => $cat->name,
                    'items' => array_map(fn($p) => ['question' => $p->post_title, 'answer' => tatos_plain_text($p->post_content)], $posts),
                ];
            }
            return rest_ensure_response($out);
        },
    ]);

    // Page brute (contenu non filtré par the_content : pas de wpautop ni de wptexturize),
    // découpée en sections <h2> par le frontend.
    register_rest_route('tatos/v1', '/pages/(?P<slug>[a-z0-9-]+)', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => function (WP_REST_Request $req) {
            $page = get_page_by_path($req['slug'], OBJECT, 'page');
            if (!$page || $page->post_status !== 'publish') {
                return new WP_Error('tatos_not_found', 'Page introuvable', ['status' => 404]);
            }
            $data = json_decode((string) get_post_meta($page->ID, 'tatos_data', true), true);
            return rest_ensure_response([
                'slug' => $page->post_name,
                'title' => $page->post_title,
                'content' => $page->post_content,
                'metaTitle' => get_post_meta($page->ID, 'tatos_meta_title', true) ?: null,
                'metaDescription' => get_post_meta($page->ID, 'tatos_meta_description', true) ?: null,
                'data' => $data,
                'modified' => get_post_modified_time('c', true, $page),
            ]);
        },
    ]);

    register_rest_route('tatos/v1', '/categories', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => function () {
            $terms = get_terms(['taxonomy' => 'categorie_produit', 'hide_empty' => false]);
            $out = array_map(fn($t) => [
                'slug' => $t->slug,
                'nom' => $t->name,
                'ordre' => (int) get_term_meta($t->term_id, 'ordre', true),
                'image' => get_term_meta($t->term_id, 'image', true) ?: null,
                'description' => get_term_meta($t->term_id, 'description_courte', true) ?: null,
            ], $terms);
            usort($out, fn($a, $b) => $a['ordre'] <=> $b['ordre']);
            return rest_ensure_response($out);
        },
    ]);

    register_rest_route('tatos/v1', '/products', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'args' => ['page' => ['default' => 1, 'sanitize_callback' => 'absint'], 'per_page' => ['default' => 100, 'sanitize_callback' => 'absint']],
        'callback' => function (WP_REST_Request $req) {
            $per = max(1, min(200, (int) $req['per_page']));
            $q = new WP_Query(['post_type' => 'produit', 'post_status' => 'publish', 'posts_per_page' => $per, 'paged' => max(1, (int) $req['page']), 'orderby' => 'date', 'order' => 'DESC']);
            $res = rest_ensure_response(array_map('tatos_product_to_array', $q->posts));
            $res->header('X-WP-Total', (string) $q->found_posts);
            $res->header('X-WP-TotalPages', (string) $q->max_num_pages);
            return $res;
        },
    ]);

    // Un produit publié, par identifiant commercial (synchronisation unitaire déclenchée par le webhook).
    register_rest_route('tatos/v1', '/products/(?P<id>[A-Za-z0-9]{1,64})', [
        'methods' => 'GET',
        'permission_callback' => $public,
        'callback' => function (WP_REST_Request $req) {
            $id = (string) $req['id'];
            $found = get_posts(['post_type' => 'produit', 'post_status' => 'publish', 'numberposts' => 1, 'meta_key' => 'tatos_id', 'meta_value' => $id]);
            if (!$found && preg_match('/^wp0*(\d+)$/', $id, $m)) {
                $post = get_post((int) $m[1]);
                $found = $post && $post->post_type === 'produit' && $post->post_status === 'publish' && !get_post_meta($post->ID, 'tatos_id', true) ? [$post] : [];
            }
            if (!$found) {
                return new WP_Error('tatos_not_found', 'Produit introuvable', ['status' => 404]);
            }
            return rest_ensure_response(tatos_product_to_array($found[0]));
        },
    ]);
});

/* -------------------------------------------------------------------------
 * Webhook : prévient le frontend à chaque modification de contenu
 * ---------------------------------------------------------------------- */
/**
 * Adresse et secret du webhook : réglages dédiés, ou à défaut l'adresse publique du site et la clé
 * d'administration (déjà saisies pour la liaison). Ainsi chaque modification est transmise au site,
 * même si les champs du webhook sont restés vides.
 */
function tatos_webhook_target(): ?array
{
    $s = tatos_settings();
    $url = trim((string) ($s['webhookUrl'] ?? ''));
    if ($url === '' && tatos_site_url() !== '') {
        $url = tatos_site_url() . '/api/webhooks/wordpress';
    }
    $secret = trim((string) ($s['webhookSecret'] ?? '')) ?: trim((string) ($s['adminApiSecret'] ?? ''));
    return $url !== '' && $secret !== '' ? ['url' => $url, 'secret' => $secret] : null;
}

/** Envoie l'événement au site ; `$wait` attend sa réponse (test de la liaison). */
function tatos_send_webhook(string $event, array $payload = [], bool $wait = false)
{
    $target = tatos_webhook_target();
    if (!$target) {
        return new WP_Error('tatos_webhook', 'Adresse publique du site ou clé d\'administration manquante (Réglages → Site et magasin).');
    }
    return wp_remote_post($target['url'], [
        'timeout' => $wait ? 20 : 5,
        'blocking' => $wait,
        'headers' => ['Content-Type' => 'application/json', 'X-Tatos-Secret' => $target['secret'], 'Cache-Control' => 'no-cache'],
        'body' => wp_json_encode(['event' => $event] + $payload),
    ]);
}

function tatos_notify_frontend(string $event, array $payload = []): void
{
    // Suspendu pendant les imports en masse (un seul événement « sync.full » est envoyé à la fin).
    if (!empty($GLOBALS['tatos_suspend_webhooks'])) {
        return;
    }
    tatos_send_webhook($event, $payload);
}

// wp_after_insert_post (et non save_post) : déclenché une fois l'article, ses termes ET ses
// métadonnées enregistrés, y compris quand l'éditeur de blocs sauvegarde les méta via REST.
add_action('wp_after_insert_post', function ($post_id, $post) {
    if (wp_is_post_revision($post_id) || wp_is_post_autosave($post_id) || in_array($post->post_status, ['auto-draft', 'inherit'], true)) {
        return;
    }
    if ($post->post_type === 'nav_menu_item') {
        return; // couvert par l'événement menu.updated
    }
    $payload = ['type' => $post->post_type, 'slug' => $post->post_name, 'status' => $post->post_status];
    if ($post->post_type === 'produit') {
        $payload['id'] = tatos_product_id($post_id);
    }
    tatos_notify_frontend($post->post_type === 'produit' ? 'product.updated' : 'content.updated', $payload);
}, 10, 2);
// before_delete_post : les métadonnées (identifiant commercial) sont encore lisibles.
add_action('before_delete_post', function ($post_id, $post) {
    if ($post->post_type === 'produit') {
        tatos_notify_frontend('product.deleted', ['type' => 'produit', 'id' => tatos_product_id($post_id)]);
    } elseif ($post->post_type !== 'revision' && $post->post_type !== 'nav_menu_item') {
        tatos_notify_frontend('content.deleted', ['type' => $post->post_type, 'slug' => $post->post_name]);
    }
}, 10, 2);
add_action('wp_update_nav_menu', fn() => tatos_notify_frontend('menu.updated'));
add_action('update_option_tatos_settings', fn() => tatos_notify_frontend('settings.updated'));

/* -------------------------------------------------------------------------
 * WP-CLI : wp tatos import <fichier.json>
 * ---------------------------------------------------------------------- */
require_once __DIR__ . '/includes/site-api.php';
require_once __DIR__ . '/includes/editors.php';
require_once __DIR__ . '/includes/admin-shop.php';
require_once __DIR__ . '/includes/admin-help.php';
require_once __DIR__ . '/includes/importer.php';

if (defined('WP_CLI') && WP_CLI) {
    require_once __DIR__ . '/includes/class-tatos-cli.php';
    WP_CLI::add_command('tatos', 'Tatos_CLI');
}
