<?php
/**
 * Écrans d'édition : fiche produit complète (prix, stock en direct, caractéristiques, images…),
 * champs des catégories, éditeur structuré des pages du site, articles, liens vers le site.
 */

if (!defined('ABSPATH')) {
    exit;
}

/* ------------------------------------------------------------------------------------------------
 * Généralités : images à la une, éditeur classique pour les fiches, commentaires masqués
 * --------------------------------------------------------------------------------------------- */
add_action('after_setup_theme', function () {
    add_theme_support('post-thumbnails', ['post', 'produit']);
}, 20);

add_action('init', function () {
    // Image d'un article importé (chemin du site) quand aucune image à la une n'est choisie.
    register_post_meta('post', 'tatos_image', ['type' => 'string', 'single' => true, 'show_in_rest' => true, 'auth_callback' => fn() => current_user_can('edit_posts')]);
    register_post_meta('post', 'tatos_image_alt', ['type' => 'string', 'single' => true, 'show_in_rest' => true, 'auth_callback' => fn() => current_user_can('edit_posts')]);
}, 11);

// Fiches produit, FAQ et pages : formulaires structurés au premier plan (éditeur classique) ;
// les articles gardent l'éditeur de blocs, plus confortable pour la rédaction.
add_filter('use_block_editor_for_post_type', fn($use, $type) => in_array($type, ['produit', 'faq', 'page'], true) ? false : $use, 10, 2);

// Site sans commentaires : menu masqué. Le thème WordPress n'affiche rien (le site public est le
// frontend) : son éditeur et ses polices sont retirés pour éviter toute confusion. Les articles
// n'utilisent pas d'étiquettes.
add_action('admin_menu', function () {
    remove_menu_page('edit-comments.php');
    remove_submenu_page('themes.php', 'site-editor.php');
    remove_submenu_page('themes.php', 'font-library.php');
    remove_submenu_page('options-general.php', 'options-discussion.php');
}, 999);
add_action('init', fn() => unregister_taxonomy_for_object_type('post_tag', 'post'), 20);
add_action('admin_init', function () {
    global $pagenow;
    if (in_array($pagenow, ['site-editor.php', 'font-library.php', 'edit-comments.php'], true)) {
        wp_safe_redirect(admin_url());
        exit;
    }
});

/* ------------------------------------------------------------------------------------------------
 * Liens de l'administration : tout lien vers le site public s'annonce (↗) et s'ouvre dans un nouvel
 * onglet, l'administration reste ouverte. Aucun lien ne mène au thème WordPress (inutilisé).
 * --------------------------------------------------------------------------------------------- */

/** Adresse publique d'un contenu sur le site, ou null (brouillon, contenu sans page publique). */
function tatos_public_url(WP_Post $post): ?string
{
    $path = $post->post_status === 'publish' ? tatos_public_path($post) : null;
    return $path !== null && tatos_site_url() !== '' ? tatos_site_url() . $path : null;
}

function tatos_site_link(string $url, string $label = 'Voir sur le site'): string
{
    return sprintf('<a href="%s" target="_blank" rel="noopener">%s ↗</a>', esc_url($url), esc_html($label));
}

// Listes de contenus : « Voir sur le site ↗ » seulement si la page publique existe ; pas d'aperçu du thème.
foreach (['post_row_actions', 'page_row_actions'] as $hook) {
    add_filter($hook, function ($actions, $post) {
        unset($actions['view'], $actions['preview']);
        $url = tatos_public_url($post);
        if ($url) {
            $actions['view'] = tatos_site_link($url);
        }
        return $actions;
    }, 20, 2);
}

// Catégories : seules les catégories de produits ont une page sur le site.
foreach (['category', 'faq_categorie', 'categorie_produit'] as $tax) {
    add_filter("{$tax}_row_actions", function ($actions, $term) use ($tax) {
        unset($actions['view']);
        if ($tax === 'categorie_produit' && tatos_site_url() !== '') {
            $actions['view'] = tatos_site_link(tatos_site_url() . '/categorie/' . $term->slug);
        }
        return $actions;
    }, 20, 2);
}
// Comptes : pas de page publique d'auteur.
add_filter('user_row_actions', function ($actions) {
    unset($actions['view']);
    return $actions;
}, 20);

// Messages « Produit mis à jour. Voir le produit » et permalien sous le titre : nouvel onglet.
add_filter('post_updated_messages', function ($messages) {
    array_walk_recursive($messages, function (&$m) {
        if (is_string($m)) {
            $m = str_replace('<a href=', '<a target="_blank" rel="noopener" href=', $m);
        }
    });
    return $messages;
}, 20);
add_filter('get_sample_permalink_html', fn($html) => str_replace('<a ', '<a target="_blank" rel="noopener" ', (string) $html), 20);

// Barre du haut : le nom du site et « Voir le site » ouvrent le site public dans un nouvel onglet ;
// accès direct au guide ; les menus WordPress.org et commentaires (sans objet) sont retirés.
add_action('admin_bar_menu', function (WP_Admin_Bar $bar) {
    $bar->remove_node('wp-logo');
    $bar->remove_node('comments');
    $site = tatos_site_url();
    if ($site !== '' && is_admin()) {
        foreach (['site-name' => null, 'view-site' => 'Voir le site ↗'] as $id => $title) {
            $node = $bar->get_node($id);
            if ($node) {
                $bar->add_node(['id' => $id, 'title' => $title ?? $node->title, 'href' => $site . '/', 'parent' => $node->parent, 'meta' => ['target' => '_blank', 'rel' => 'noopener', 'title' => 'Ouvrir le site dans un nouvel onglet']]);
            }
        }
    }
    foreach (['view', 'preview'] as $id) {
        $node = $bar->get_node($id);
        if ($node) {
            $post = get_post();
            $url = $post ? tatos_public_url($post) : null;
            if ($url) {
                $bar->add_node(['id' => $id, 'title' => 'Voir sur le site ↗', 'href' => $url, 'meta' => ['target' => '_blank', 'rel' => 'noopener']]);
            } else {
                $bar->remove_node($id);
            }
        }
    }
    if (is_admin() && current_user_can('edit_posts')) {
        $bar->add_node(['id' => 'tatos-guide', 'title' => "Guide d'utilisation", 'href' => admin_url(current_user_can(tatos_shop_cap()) ? 'admin.php?page=tatos-guide' : 'index.php?page=tatos-guide'), 'parent' => 'top-secondary']);
    }
}, 999);

// « Voir » ouvre la page publique sur le site (et non le thème WordPress, inutilisé).
foreach (['post_link', 'page_link', 'post_type_link'] as $hook) {
    add_filter($hook, function ($link, $post) {
        $post = get_post($post);
        if (!$post || $post->post_status !== 'publish' || tatos_site_url() === '') {
            return $link;
        }
        $path = tatos_public_path($post);
        return $path === null ? $link : tatos_site_url() . $path;
    }, 20, 2);
}

// Le site public est le frontend (Next.js) : toute visite de WordPress côté visiteur y est redirigée.
add_action('template_redirect', function () {
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    if (is_admin() || wp_doing_ajax() || (defined('REST_REQUEST') && REST_REQUEST) || is_preview() || is_customize_preview() || tatos_site_url() === '' || preg_match('#^/(wp-admin|wp-login|wp-json)#', $uri)) {
        return;
    }
    $post = is_singular() ? get_queried_object() : null;
    $path = $post instanceof WP_Post ? (tatos_public_path($post) ?? '/') : '/';
    wp_redirect(tatos_site_url() . $path, 302);
    exit;
});

add_action('admin_enqueue_scripts', function ($hook) {
    $screen = get_current_screen();
    $ours = str_contains((string) $hook, 'tatos') || $hook === 'index.php' || ($screen && (in_array($screen->post_type, ['produit', 'page', 'post', 'faq'], true) || in_array($screen->taxonomy, ['categorie_produit'], true)));
    if (!$ours) {
        return;
    }
    wp_enqueue_media();
    $base = plugin_dir_url(__DIR__) . 'assets/';
    wp_enqueue_style('tatos-admin', $base . 'admin.css', [], TATOS_HEADLESS_VERSION);
    wp_enqueue_script('tatos-admin', $base . 'admin.js', ['jquery'], TATOS_HEADLESS_VERSION, true);
});

/** Champ image : URL + bouton de choix dans la médiathèque + aperçu. */
function tatos_image_input(string $name, string $value, string $id): string
{
    $preview = $value !== '' ? '<img src="' . esc_url(tatos_preview_url($value)) . '" alt="">' : '';
    return '<div class="tatos-image-field"><div class="tatos-image-preview">' . $preview . '</div>'
        . '<input type="text" class="regular-text tatos-image-url" id="' . esc_attr($id) . '" name="' . esc_attr($name) . '" value="' . esc_attr($value) . '">'
        . ' <button type="button" class="button tatos-pick-image">Choisir une image</button></div>';
}

/** Les chemins du site (/assets/…) sont prévisualisés depuis le site lui-même. */
function tatos_preview_url(string $url): string
{
    return str_starts_with($url, '/') && tatos_site_url() !== '' ? tatos_site_url() . $url : $url;
}

/* ------------------------------------------------------------------------------------------------
 * Fiche produit
 * --------------------------------------------------------------------------------------------- */
const TATOS_PRODUCT_FORM = [
    'Identité' => [
        ['marque', 'Marque', 'text'],
        ['modele', 'Référence / modèle', 'text'],
    ],
    'Prix' => [
        ['prix', 'Prix conseillé fabricant (€ TTC) — affiché barré, doit être le vrai prix public du fabricant', 'money'],
        ['promotion_prix', 'Prix de déstockage (€ TTC) — prix de vente ; vide : vendu au prix conseillé', 'money'],
    ],
    'Caractéristiques' => [
        ['caracteristiques.largeur', 'Largeur (cm)', 'number'],
        ['caracteristiques.hauteur', 'Hauteur (cm)', 'number'],
        ['caracteristiques.profondeur', 'Profondeur (cm)', 'number'],
        ['caracteristiques.poids', 'Poids (kg) — transmis aux livreurs (livraison offerte)', 'number'],
        ['sonore', 'Niveau sonore (dB)', 'int'],
        ['pose', 'Pose (ex. pose libre, encastrable)', 'text'],
        ['couleurs', 'Couleurs (codes couleur, séparés par des virgules)', 'list'],
        ['sous_categories', 'Types (ex. hublot, top), séparés par des virgules', 'list'],
    ],
    'Garantie' => [
        ['garantie.duree', 'Durée (mois)', 'int'],
        ['garantie.descriptif', 'Descriptif', 'textarea'],
    ],
    'Mise en avant' => [
        ['vedette', "Produit vedette (sélection de l'accueil)", 'bool'],
        ['connecter', 'Appareil connecté', 'bool'],
        ['magasin', 'Exposé en magasin', 'bool'],
    ],
    'Images' => [
        ['image_principale', "Image principale (utilisée si aucune « image mise en avant » n'est choisie)", 'image'],
        ['images', 'Galerie (une adresse par ligne)', 'gallery'],
        ['etiquette_energie', 'Étiquette énergie', 'image'],
    ],
    'Référencement (Google)' => [
        ['meta_title', 'Titre pour les moteurs de recherche', 'text'],
        ['meta_description', 'Description pour les moteurs de recherche (160 caractères conseillés)', 'textarea'],
    ],
];

function tatos_product_value(int $post_id, string $path)
{
    if (str_contains($path, '.')) {
        [$meta, $key] = explode('.', $path, 2);
        $obj = tatos_json_meta($post_id, $meta, []);
        return is_array($obj) ? ($obj[$key] ?? '') : '';
    }
    return get_post_meta($post_id, $path, true);
}

add_action('add_meta_boxes_produit', function (WP_Post $post) {
    add_meta_box('tatos-stock-box', 'Stock et disponibilité', 'tatos_stock_box', 'produit', 'side', 'high');
    add_meta_box('tatos-product', 'Fiche produit', 'tatos_product_box', 'produit', 'normal', 'high');
});

function tatos_stock_box(WP_Post $post): void
{
    $id = tatos_product_id($post->ID);
    $meta_stock = (int) get_post_meta($post->ID, 'stock', true);
    $live = $post->post_status === 'auto-draft' ? null : tatos_site_request('GET', 'products/' . rawurlencode($id), null, 6);
    echo '<p><label for="tatos-stock"><strong>Quantité en stock</strong></label></p>';
    if ($live && $live['ok']) {
        $stock = (int) $live['data']['stock'];
        printf('<input type="number" min="0" step="1" id="tatos-stock" name="tatos_stock" value="%d" class="small-text"> <input type="hidden" name="tatos_stock_site" value="%d">', $stock, $stock);
        echo '<p class="description">Stock réel du site, mis à jour à chaque vente.';
        if (!empty($live['data']['reserved'])) {
            printf(' %d exemplaire(s) réservé(s) par des commandes en attente de paiement (libérés après 30 min).', (int) $live['data']['reserved']);
        }
        echo '</p>';
        printf('<p><a href="%s" target="_blank" rel="noopener">Voir la fiche sur le site ↗</a></p>', esc_url($live['data']['url']));
    } else {
        printf('<input type="number" min="0" step="1" id="tatos-stock" name="tatos_stock" value="%d" class="small-text">', $meta_stock);
        echo '<p class="description">' . ($live === null || $live['status'] === 404 ? 'Nouveau produit : ce stock sera repris à sa première publication sur le site.' : 'Stock du site indisponible pour le moment (' . esc_html($live['error']) . ') : la valeur saisie ne remplacera le stock du site que pour un nouveau produit.') . '</p>';
    }
    wp_nonce_field('tatos_product_save', 'tatos_product_nonce');
}

function tatos_product_box(WP_Post $post): void
{
    echo '<div class="tatos-form">';
    echo '<p class="description">Le titre ci-dessus est le nom du produit ; le texte principal est sa description. La catégorie se choisit dans le panneau « Catégories produit ».</p>';
    foreach (TATOS_PRODUCT_FORM as $group => $fields) {
        echo '<fieldset class="tatos-group"><legend>' . esc_html($group) . '</legend>';
        foreach ($fields as [$path, $label, $type]) {
            $name = 'tatos_product[' . $path . ']';
            $fid = 'tatos-' . str_replace('.', '-', $path);
            $value = tatos_product_value($post->ID, $path);
            echo '<div class="tatos-field tatos-field-' . esc_attr($type) . '">';
            if ($type === 'bool') {
                printf('<label><input type="hidden" name="%1$s" value="0"><input type="checkbox" name="%1$s" value="1" %2$s> %3$s</label>', esc_attr($name), checked((bool) $value, true, false), esc_html($label));
            } else {
                printf('<label for="%s">%s</label>', esc_attr($fid), esc_html($label));
                if ($type === 'textarea') {
                    printf('<textarea id="%s" name="%s" rows="3" class="large-text">%s</textarea>', esc_attr($fid), esc_attr($name), esc_textarea((string) $value));
                } elseif ($type === 'image') {
                    echo tatos_image_input($name, (string) $value, $fid);
                } elseif ($type === 'gallery') {
                    $urls = tatos_json_meta($post->ID, 'images', []);
                    printf('<textarea id="%s" name="%s" rows="4" class="large-text tatos-gallery">%s</textarea> <button type="button" class="button tatos-pick-gallery" data-target="%s">Ajouter des images</button>', esc_attr($fid), esc_attr($name), esc_textarea(implode("\n", is_array($urls) ? $urls : [])), esc_attr($fid));
                } elseif ($type === 'list') {
                    $items = tatos_json_meta($post->ID, $path, []);
                    printf('<input type="text" id="%s" name="%s" value="%s" class="regular-text">', esc_attr($fid), esc_attr($name), esc_attr(implode(', ', is_array($items) ? $items : [])));
                } else {
                    $input = in_array($type, ['money', 'number'], true) ? 'type="text" inputmode="decimal"' : ($type === 'int' ? 'type="number" step="1"' : 'type="text"');
                    $shown = $type === 'money' && $value !== '' ? number_format((float) $value, 2, ',', '') : (string) $value;
                    printf('<input %s id="%s" name="%s" value="%s" class="%s">', $input, esc_attr($fid), esc_attr($name), esc_attr($shown), $type === 'text' ? 'regular-text' : 'small-text');
                }
            }
            echo '</div>';
        }
        echo '</fieldset>';
    }
    echo '</div>';
}

/** Nombre saisi à la française (« 1 299,90 ») ; null si vide. */
function tatos_parse_number($raw): ?float
{
    $s = str_replace([' ', "\u{00A0}", "\u{202F}", '€'], '', trim((string) $raw));
    if ($s === '') {
        return null;
    }
    $s = str_replace(',', '.', $s);
    return is_numeric($s) ? (float) $s : null;
}

add_action('save_post_produit', function ($post_id) {
    if (!isset($_POST['tatos_product_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tatos_product_nonce'])), 'tatos_product_save')) {
        return;
    }
    if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_post', $post_id)) {
        return;
    }
    $in = isset($_POST['tatos_product']) ? (array) wp_unslash($_POST['tatos_product']) : [];
    $json = [];
    foreach (TATOS_PRODUCT_FORM as $fields) {
        foreach ($fields as [$path, , $type]) {
            $raw = $in[$path] ?? '';
            switch ($type) {
                case 'bool':
                    $value = !empty($raw) && $raw !== '0';
                    break;
                case 'money':
                case 'number':
                    $value = tatos_parse_number($raw);
                    break;
                case 'int':
                    $value = trim((string) $raw) === '' ? null : (int) $raw;
                    break;
                case 'list':
                    $value = array_values(array_filter(array_map('trim', explode(',', sanitize_text_field((string) $raw))), 'strlen'));
                    break;
                case 'gallery':
                    $value = array_values(array_filter(array_map('esc_url_raw', array_map('trim', preg_split('/\R/', (string) $raw)))));
                    break;
                case 'textarea':
                    $value = sanitize_textarea_field((string) $raw);
                    break;
                case 'image':
                    $value = esc_url_raw(trim((string) $raw), ['http', 'https']) ?: (str_starts_with(trim((string) $raw), '/') ? sanitize_text_field((string) $raw) : '');
                    break;
                default:
                    $value = sanitize_text_field((string) $raw);
            }
            if (str_contains($path, '.')) {
                [$meta, $key] = explode('.', $path, 2);
                $json[$meta][$key] = $value;
                continue;
            }
            if ($type === 'list' || $type === 'gallery') {
                update_post_meta($post_id, $path, wp_slash(wp_json_encode($value)));
            } elseif ($value === null || $value === '') {
                delete_post_meta($post_id, $path);
            } else {
                update_post_meta($post_id, $path, is_bool($value) ? ($value ? 1 : 0) : wp_slash($value));
            }
        }
    }
    foreach ($json as $meta => $obj) {
        $clean = array_filter($obj, fn($v) => $v !== null && $v !== '');
        if ($meta === 'garantie' && empty($clean['duree'])) {
            delete_post_meta($post_id, 'garantie');
            continue;
        }
        update_post_meta($post_id, $meta, wp_slash(wp_json_encode($clean ?: new stdClass())));
    }
    if (isset($_POST['tatos_stock']) && $_POST['tatos_stock'] !== '') {
        $stock = max(0, (int) $_POST['tatos_stock']);
        update_post_meta($post_id, 'stock', $stock);
        $site = isset($_POST['tatos_stock_site']) ? (int) $_POST['tatos_stock_site'] : null;
        if ($site !== null && $site !== $stock) {
            $GLOBALS['tatos_pending_stock'][$post_id] = $stock;
        }
    }
});

// Stock poussé sur le site une fois le produit entièrement enregistré.
add_action('wp_after_insert_post', function ($post_id, $post) {
    if (!array_key_exists($post_id, $GLOBALS['tatos_pending_stock'] ?? [])) {
        return;
    }
    $stock = $GLOBALS['tatos_pending_stock'][$post_id];
    unset($GLOBALS['tatos_pending_stock'][$post_id]);
    $res = tatos_site_request('PATCH', 'products/' . rawurlencode(tatos_product_id($post_id)), ['stock' => $stock], 10);
    if (!$res['ok'] && $res['status'] !== 404) {
        set_transient('tatos_notice_' . get_current_user_id(), ['error', 'Le stock n\'a pas pu être mis à jour sur le site : ' . $res['error']], 60);
    }
}, 20, 2);

/* ------------------------------------------------------------------------------------------------
 * Catégories produit : ordre, image, description
 * --------------------------------------------------------------------------------------------- */
add_action('categorie_produit_add_form_fields', function () {
    echo '<div class="form-field"><label for="tatos-ordre">Ordre d\'affichage</label><input type="number" id="tatos-ordre" name="tatos_term[ordre]" value="100"></div>';
    echo '<div class="form-field"><label for="tatos-term-image">Image (vignette du rayon)</label>' . tatos_image_input('tatos_term[image]', '', 'tatos-term-image') . '</div>';
    echo '<div class="form-field"><label for="tatos-desc">Description courte</label><textarea id="tatos-desc" name="tatos_term[description_courte]" rows="3"></textarea></div>';
    wp_nonce_field('tatos_term_save', 'tatos_term_nonce');
});
add_action('categorie_produit_edit_form_fields', function (WP_Term $term) {
    $ordre = (int) get_term_meta($term->term_id, 'ordre', true);
    $image = (string) get_term_meta($term->term_id, 'image', true);
    $desc = (string) get_term_meta($term->term_id, 'description_courte', true);
    echo '<tr class="form-field"><th><label for="tatos-ordre">Ordre d\'affichage</label></th><td><input type="number" id="tatos-ordre" name="tatos_term[ordre]" value="' . esc_attr((string) $ordre) . '"><p class="description">Les rayons sont classés du plus petit au plus grand.</p></td></tr>';
    echo '<tr class="form-field"><th><label for="tatos-term-image">Image (vignette du rayon)</label></th><td>' . tatos_image_input('tatos_term[image]', $image, 'tatos-term-image') . '</td></tr>';
    echo '<tr class="form-field"><th><label for="tatos-desc">Description courte</label></th><td><textarea id="tatos-desc" name="tatos_term[description_courte]" rows="3">' . esc_textarea($desc) . '</textarea></td></tr>';
    wp_nonce_field('tatos_term_save', 'tatos_term_nonce');
});
$tatos_save_term = function ($term_id) {
    if (!isset($_POST['tatos_term_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tatos_term_nonce'])), 'tatos_term_save') || !current_user_can('manage_categories')) {
        return;
    }
    $in = (array) wp_unslash($_POST['tatos_term'] ?? []);
    update_term_meta($term_id, 'ordre', (int) ($in['ordre'] ?? 0));
    update_term_meta($term_id, 'image', sanitize_text_field((string) ($in['image'] ?? '')));
    update_term_meta($term_id, 'description_courte', sanitize_textarea_field((string) ($in['description_courte'] ?? '')));
};
add_action('created_categorie_produit', $tatos_save_term);
add_action('edited_categorie_produit', $tatos_save_term);

// Thèmes de la FAQ : ordre d'affichage sur la page FAQ du site.
add_action('faq_categorie_add_form_fields', function () {
    echo '<div class="form-field"><label for="tatos-ordre">Ordre d\'affichage</label><input type="number" id="tatos-ordre" name="tatos_faq_ordre" value="100"></div>';
    wp_nonce_field('tatos_term_save', 'tatos_term_nonce');
});
add_action('faq_categorie_edit_form_fields', function (WP_Term $term) {
    printf('<tr class="form-field"><th><label for="tatos-ordre">Ordre d\'affichage</label></th><td><input type="number" id="tatos-ordre" name="tatos_faq_ordre" value="%s"><p class="description">Les thèmes sont classés du plus petit au plus grand.</p></td></tr>', esc_attr((string) (int) get_term_meta($term->term_id, 'ordre', true)));
    wp_nonce_field('tatos_term_save', 'tatos_term_nonce');
});
$tatos_save_faq_term = function ($term_id) {
    if (!isset($_POST['tatos_term_nonce'], $_POST['tatos_faq_ordre']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tatos_term_nonce'])), 'tatos_term_save') || !current_user_can('manage_categories')) {
        return;
    }
    update_term_meta($term_id, 'ordre', (int) $_POST['tatos_faq_ordre']);
};
add_action('created_faq_categorie', $tatos_save_faq_term);
add_action('edited_faq_categorie', $tatos_save_faq_term);

// Toute modification de catégorie, de FAQ ou de catégorie d'article est répercutée sur le site.
foreach (['created_term', 'edited_term', 'delete_term'] as $hook) {
    add_action($hook, function ($term_id, $tt_id, $taxonomy) {
        if ($taxonomy === 'categorie_produit') {
            tatos_notify_frontend('categories.updated');
        } elseif (in_array($taxonomy, ['faq_categorie', 'category'], true)) {
            tatos_notify_frontend('content.updated', ['type' => $taxonomy]);
        }
    }, 30, 3);
}

/* ------------------------------------------------------------------------------------------------
 * Pages du site : éditeur structuré des contenus (titres, textes, images, diapositives…)
 * --------------------------------------------------------------------------------------------- */
const TATOS_LABELS = [
    'hero' => 'En-tête', 'slides' => 'Diapositives', 'tag' => 'Étiquette', 'title' => 'Titre', 'subtitle' => 'Sous-titre', 'text' => 'Texte',
    'cta' => 'Texte du bouton', 'href' => 'Lien (ex. /boutique)', 'image' => 'Image', 'imageAlt' => "Description de l'image (accessibilité)",
    'marquee' => 'Bandeau défilant', 'categories' => 'Rayons', 'statement' => 'Message principal', 'services' => 'Services', 'promo' => 'Promotion',
    'selection' => 'Sélection', 'why' => 'Pourquoi nous', 'band' => 'Bandeau final', 'eyebrow' => 'Surtitre', 'intro' => 'Introduction',
    'items' => 'Éléments', 'points' => 'Points clés', 'icon' => 'Icône', 'label' => 'Libellé', 'value' => 'Valeur', 'rates' => 'Tarifs',
    'quote' => 'Demande de rendez-vous', 'location' => 'Plan d\'accès', 'description' => 'Description', 'heading' => 'Titre', 'body' => 'Texte',
    'stats' => 'Chiffres', 'history' => 'Histoire', 'values' => 'Valeurs', 'team' => 'Équipe', 'name' => 'Nom', 'id' => 'Identifiant (ancre)',
    'question' => 'Question', 'answer' => 'Réponse', 'link' => 'Lien', 'button' => 'Bouton', 'banner' => 'Bannière', 'cards' => 'Cartes',
];

function tatos_label(string $key): string
{
    if (isset(TATOS_LABELS[$key])) {
        return TATOS_LABELS[$key];
    }
    if (is_numeric($key)) {
        return 'Élément ' . ((int) $key + 1);
    }
    return ucfirst(trim(strtolower(preg_replace('/([a-z])([A-Z])/', '$1 $2', str_replace('_', ' ', $key)))));
}

function tatos_is_list($v): bool
{
    return is_array($v) && ($v === [] || array_keys($v) === range(0, count($v) - 1));
}

/** Valeur vide de même forme (modèle d'un nouvel élément de liste). */
function tatos_blank($v)
{
    if (is_array($v)) {
        if (tatos_is_list($v)) {
            return [];
        }
        return array_map('tatos_blank', $v);
    }
    return is_bool($v) ? false : (is_int($v) || is_float($v) ? 0 : '');
}

function tatos_long_text(string $key, $value): bool
{
    return (bool) preg_match('/(text|intro|description|body|answer|statement|content|lead|excerpt)$/i', $key) || (is_string($value) && mb_strlen($value) > 90);
}

function tatos_render_data($key, $value, string $name, int $depth = 0): string
{
    $label = esc_html(tatos_label((string) $key));
    if (is_array($value) && !tatos_is_list($value)) {
        $html = '<fieldset class="tatos-group depth-' . $depth . '"><legend>' . $label . '</legend>';
        foreach ($value as $k => $v) {
            $html .= tatos_render_data($k, $v, $name . '[' . $k . ']', $depth + 1);
        }
        return $html . '</fieldset>';
    }
    if (tatos_is_list($value)) {
        $objects = $value !== [] && is_array($value[0]);
        if (!$objects) {
            $id = 'tatos-' . md5($name);
            return '<div class="tatos-field"><label for="' . $id . '">' . $label . ' <span class="description">(un élément par ligne)</span></label><textarea id="' . $id . '" class="large-text" rows="' . max(3, count($value) + 1) . '" name="' . esc_attr($name . '[__lines]') . '">' . esc_textarea(implode("\n", array_map('strval', $value))) . '</textarea></div>';
        }
        $html = '<fieldset class="tatos-group tatos-repeater depth-' . $depth . '"><legend>' . $label . '</legend><div class="tatos-items">';
        foreach ($value as $i => $item) {
            $html .= tatos_render_item($item, $name . '[' . $i . ']', $depth, (int) $i);
        }
        $template = tatos_render_item(tatos_blank($value[0]), $name . '[__INDEX__]', $depth, -1);
        $html .= '</div><template class="tatos-template">' . $template . '</template>';
        return $html . '<p><button type="button" class="button tatos-add-item">+ Ajouter un élément</button></p></fieldset>';
    }
    $id = 'tatos-' . md5($name);
    if (is_bool($value)) {
        return '<div class="tatos-field"><label><input type="hidden" name="' . esc_attr($name) . '" value="0"><input type="checkbox" name="' . esc_attr($name) . '" value="1" ' . checked($value, true, false) . '> ' . $label . '</label></div>';
    }
    if (is_int($value) || is_float($value)) {
        return '<div class="tatos-field"><label for="' . $id . '">' . $label . '</label><input type="number" step="any" class="small-text" id="' . $id . '" name="' . esc_attr($name) . '" value="' . esc_attr((string) $value) . '"></div>';
    }
    if (is_string($value) && preg_match('/image|logo|photo|picture/i', (string) $key) && !preg_match('/alt$/i', (string) $key)) {
        return '<div class="tatos-field"><label for="' . $id . '">' . $label . '</label>' . tatos_image_input($name, $value, $id) . '</div>';
    }
    if (tatos_long_text((string) $key, $value)) {
        return '<div class="tatos-field"><label for="' . $id . '">' . $label . '</label><textarea id="' . $id . '" class="large-text" rows="3" name="' . esc_attr($name) . '">' . esc_textarea((string) $value) . '</textarea></div>';
    }
    return '<div class="tatos-field"><label for="' . $id . '">' . $label . '</label><input type="text" class="large-text" id="' . $id . '" name="' . esc_attr($name) . '" value="' . esc_attr((string) $value) . '"></div>';
}

function tatos_render_item($item, string $name, int $depth, int $index): string
{
    $title = $index >= 0 ? 'Élément ' . ($index + 1) : 'Nouvel élément';
    if (is_array($item)) {
        foreach (['title', 'label', 'name', 'question', 'tag'] as $k) {
            if (!empty($item[$k]) && is_string($item[$k])) {
                $title = $item[$k];
                break;
            }
        }
    }
    $html = '<div class="tatos-item"><div class="tatos-item-bar"><strong class="tatos-item-title">' . esc_html(wp_trim_words($title, 10)) . '</strong>'
        . '<span><button type="button" class="button-link tatos-move" data-dir="-1" aria-label="Monter">↑</button> <button type="button" class="button-link tatos-move" data-dir="1" aria-label="Descendre">↓</button> '
        . '<button type="button" class="button-link button-link-delete tatos-remove-item">Supprimer</button></span></div>';
    foreach ((array) $item as $k => $v) {
        $html .= tatos_render_data($k, $v, $name . '[' . $k . ']', $depth + 1);
    }
    return $html . '</div>';
}

/** Reconstruit les données saisies avec les types du modèle (nombres, booléens, listes…). */
function tatos_cast_data($posted, $model)
{
    if (is_array($model) && !tatos_is_list($model)) {
        $out = [];
        foreach ($model as $k => $v) {
            $out[$k] = tatos_cast_data(is_array($posted) && array_key_exists($k, $posted) ? $posted[$k] : (is_bool($v) ? false : null), $v);
        }
        return $out;
    }
    if (tatos_is_list($model)) {
        if (is_array($posted) && array_key_exists('__lines', $posted)) {
            return array_values(array_filter(array_map('trim', preg_split('/\R/', (string) $posted['__lines'])), 'strlen'));
        }
        if ($model === [] || !is_array($model[0])) {
            return is_array($posted) ? array_values($posted) : $model;
        }
        $items = [];
        foreach ((is_array($posted) ? $posted : []) as $k => $item) {
            if ($k === '__INDEX__') {
                continue;
            }
            $items[] = tatos_cast_data($item, $model[0]);
        }
        return $items;
    }
    if ($posted === null) {
        return $model;
    }
    if (is_bool($model)) {
        return !empty($posted) && $posted !== '0';
    }
    if (is_int($model)) {
        return (int) $posted;
    }
    if (is_float($model)) {
        return (float) str_replace(',', '.', (string) $posted);
    }
    return str_contains((string) $posted, "\n") ? sanitize_textarea_field((string) $posted) : sanitize_text_field((string) $posted);
}

add_action('add_meta_boxes_page', function (WP_Post $post) {
    $raw = (string) get_post_meta($post->ID, 'tatos_data', true);
    if ($raw !== '' && is_array(json_decode($raw, true))) {
        add_meta_box('tatos-page-data', 'Contenus de la page sur le site', 'tatos_page_data_box', 'page', 'normal', 'high');
    }
    add_meta_box('tatos-page-seo', 'Référencement (Google)', 'tatos_page_seo_box', 'page', 'normal', 'default');
});

function tatos_page_data_box(WP_Post $post): void
{
    $data = json_decode((string) get_post_meta($post->ID, 'tatos_data', true), true);
    wp_nonce_field('tatos_page_save', 'tatos_page_nonce');
    echo '<div class="tatos-form tatos-data-editor"><p class="description">Modifiez ici les textes, images et blocs de la page. Les listes (diapositives, rayons, services…) se réordonnent avec ↑ ↓ ; « + Ajouter un élément » crée un bloc vide à compléter. Le site est mis à jour à l\'enregistrement.</p>';
    foreach ($data as $k => $v) {
        echo tatos_render_data($k, $v, 'tatos_data[' . $k . ']');
    }
    echo '<details class="tatos-advanced"><summary>Mode avancé (JSON)</summary><p class="description">Pour les utilisateurs avertis : si ce texte est modifié et valide, il remplace le formulaire ci-dessus.</p>';
    printf('<textarea name="tatos_data_json" rows="12" class="large-text code">%s</textarea><input type="hidden" name="tatos_data_json_orig" value="%s">', esc_textarea(wp_json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)), esc_attr(tatos_data_hash($data)));
    echo '</details></div>';
}

/** Empreinte indépendante de la mise en forme (espaces, retours à la ligne du navigateur). */
function tatos_data_hash($data): string
{
    return md5((string) wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
}

function tatos_page_seo_box(WP_Post $post): void
{
    wp_nonce_field('tatos_page_seo', 'tatos_page_seo_nonce');
    printf('<p><label for="tatos-mt"><strong>Titre pour les moteurs de recherche</strong></label><br><input type="text" id="tatos-mt" name="tatos_meta_title" class="large-text" value="%s"></p>', esc_attr((string) get_post_meta($post->ID, 'tatos_meta_title', true)));
    printf('<p><label for="tatos-md"><strong>Description pour les moteurs de recherche</strong></label><br><textarea id="tatos-md" name="tatos_meta_description" class="large-text" rows="2">%s</textarea></p>', esc_textarea((string) get_post_meta($post->ID, 'tatos_meta_description', true)));
}

add_action('save_post_page', function ($post_id) {
    if ((defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) || !current_user_can('edit_page', $post_id)) {
        return;
    }
    if (isset($_POST['tatos_page_seo_nonce']) && wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tatos_page_seo_nonce'])), 'tatos_page_seo')) {
        update_post_meta($post_id, 'tatos_meta_title', sanitize_text_field(wp_unslash($_POST['tatos_meta_title'] ?? '')));
        update_post_meta($post_id, 'tatos_meta_description', sanitize_textarea_field(wp_unslash($_POST['tatos_meta_description'] ?? '')));
    }
    if (!isset($_POST['tatos_page_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['tatos_page_nonce'])), 'tatos_page_save')) {
        return;
    }
    $model = json_decode((string) get_post_meta($post_id, 'tatos_data', true), true);
    if (!is_array($model)) {
        return;
    }
    $json = isset($_POST['tatos_data_json']) ? (string) wp_unslash($_POST['tatos_data_json']) : '';
    $orig = isset($_POST['tatos_data_json_orig']) ? (string) wp_unslash($_POST['tatos_data_json_orig']) : '';
    $decoded = $json !== '' ? json_decode($json, true) : null;
    if ($json !== '' && (!is_array($decoded) || tatos_data_hash($decoded) !== $orig)) {
        if (is_array($decoded)) {
            update_post_meta($post_id, 'tatos_data', wp_slash(wp_json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
            return;
        }
        set_transient('tatos_notice_' . get_current_user_id(), ['error', 'Le JSON du mode avancé est invalide : le formulaire a été enregistré à la place.'], 60);
    }
    $posted = isset($_POST['tatos_data']) ? (array) wp_unslash($_POST['tatos_data']) : [];
    $data = tatos_cast_data($posted, $model);
    update_post_meta($post_id, 'tatos_data', wp_slash(wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
});

/* ------------------------------------------------------------------------------------------------
 * Notices après enregistrement
 * --------------------------------------------------------------------------------------------- */
add_action('admin_notices', function () {
    $key = 'tatos_notice_' . get_current_user_id();
    $notice = get_transient($key);
    if (!$notice) {
        return;
    }
    delete_transient($key);
    printf('<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr($notice[0]), esc_html($notice[1]));
});
