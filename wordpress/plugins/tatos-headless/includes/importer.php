<?php
/**
 * Import des contenus du site dans WordPress (format de `npm run wp:export` et de l'API
 * /api/admin/export du site). Utilisé par la commande `wp tatos import` et par le bouton
 * « Importer les contenus du site » des réglages. Rejouable : les contenus existants sont mis à jour.
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * @param array    $data  réglages, catégories, produits, pages, FAQ, articles, menus (tous facultatifs)
 * @param callable $log   reçoit chaque message de progression
 * @return int nombre de produits importés
 */
function tatos_import(array $data, callable $log, int $limit = PHP_INT_MAX): int
{
    // Import de confiance : le HTML exporté (classes Tailwind, entités) est conservé tel quel.
    kses_remove_filters();
    $GLOBALS['tatos_suspend_webhooks'] = true;
    // Les fonctions d'écriture WordPress (wp_insert_post, update_*_meta) attendent des données
    // « slashées » : sans wp_slash(), les antislashs du JSON (é, \") seraient supprimés.
    $meta = fn($id, $key, $value) => update_post_meta($id, $key, wp_slash($value));

    if (!empty($data['settings'])) {
        update_option('tatos_settings', array_merge(tatos_settings(), $data['settings']));
        $log('Réglages importés');
    }

    // Contenus d'exemple créés par l'installation de WordPress : sans objet sur le site.
    foreach ([['page', 'sample-page'], ['page', 'privacy-policy'], ['post', 'hello-world']] as [$type, $slug]) {
        foreach (get_posts(['post_type' => $type, 'name' => $slug, 'post_status' => 'any', 'numberposts' => -1]) as $sample) {
            wp_delete_post($sample->ID, true);
            $log("Contenu d'exemple supprimé : $slug");
        }
    }

    $termIds = [];
    foreach ($data['categories'] ?? [] as $c) {
        $existing = get_term_by('slug', $c['slug'], 'categorie_produit');
        $term = $existing ? ['term_id' => $existing->term_id] : wp_insert_term($c['nom'], 'categorie_produit', ['slug' => $c['slug']]);
        if (is_wp_error($term)) {
            $log('Attention : ' . $term->get_error_message());
            continue;
        }
        update_term_meta($term['term_id'], 'ordre', (int) $c['ordre']);
        update_term_meta($term['term_id'], 'image', wp_slash($c['image'] ?? ''));
        update_term_meta($term['term_id'], 'description_courte', wp_slash($c['description'] ?? ''));
        $termIds[$c['nom']] = (int) $term['term_id'];
    }
    if (!empty($data['categories'])) {
        $log(count($termIds) . ' catégories');
    }
    // Import des produits par lots : catégories déjà créées par une étape précédente.
    foreach (get_terms(['taxonomy' => 'categorie_produit', 'hide_empty' => false]) ?: [] as $t) {
        $termIds[$t->name] ??= (int) $t->term_id;
    }

    $count = 0;
    foreach ($data['products'] ?? [] as $p) {
        if ($count >= $limit) {
            break;
        }
        // Recherche par identifiant stable (le slug peut dépasser les 200 caractères de post_name).
        $found = get_posts(['post_type' => 'produit', 'post_status' => 'any', 'numberposts' => 1, 'meta_key' => 'tatos_id', 'meta_value' => $p['id']]);
        $existing = $found ? $found[0] : get_page_by_path($p['slug'], OBJECT, 'produit');
        $postarr = [
            'post_type' => 'produit',
            'post_status' => 'publish',
            'post_title' => $p['titre'],
            'post_name' => $p['slug'],
            'post_content' => $p['description'],
            'post_date_gmt' => gmdate('Y-m-d H:i:s', strtotime($p['createdAt'] ?? 'now')),
        ];
        if ($existing) {
            $postarr['ID'] = $existing->ID;
        }
        $id = wp_insert_post(wp_slash($postarr), true);
        if (is_wp_error($id)) {
            $log('Attention : ' . $id->get_error_message());
            continue;
        }
        $values = [
            'tatos_id' => $p['id'],
            'tatos_slug' => $p['slug'],
            'marque' => $p['marque'],
            'modele' => $p['modele'],
            'prix' => $p['prix'],
            'promotion_prix' => $p['promotionPrix'] ?? '',
            'stock' => $p['stock'],
            'caracteristiques' => wp_json_encode($p['caracteristiques'] ?? new stdClass()),
            'garantie' => isset($p['garantie']) ? wp_json_encode($p['garantie']) : '',
            'pose' => $p['pose'] ?? '',
            'couleurs' => wp_json_encode($p['couleur'] ?? []),
            'sous_categories' => wp_json_encode($p['sousCategorie'] ?? []),
            'connecter' => !empty($p['connecter']),
            'vedette' => !empty($p['vedette']),
            'magasin' => !empty($p['magasin']),
            'sonore' => $p['sonore'] ?? '',
            'image_principale' => $p['imagePrincipale'] ?? '',
            'images' => wp_json_encode($p['images'] ?? []),
            'etiquette_energie' => $p['etiquetteEnergie'] ?? '',
            'meta_title' => $p['metaTitle'] ?? '',
            'meta_description' => $p['metaDescription'] ?? '',
        ];
        foreach ($values as $k => $v) {
            $meta($id, $k, $v);
        }
        if (isset($termIds[$p['categorie']])) {
            wp_set_object_terms($id, [$termIds[$p['categorie']]], 'categorie_produit');
        }
        $count++;
    }
    if (!empty($data['products'])) {
        $log("$count produits");
    }

    foreach ($data['pages'] ?? [] as $page) {
        $existing = get_page_by_path($page['slug'], OBJECT, 'page');
        $postarr = ['post_type' => 'page', 'post_status' => 'publish', 'post_title' => $page['title'], 'post_name' => $page['slug'], 'post_content' => $page['html'] ?? ''];
        if ($existing) {
            $postarr['ID'] = $existing->ID;
        }
        $id = wp_insert_post(wp_slash($postarr), true);
        if (is_wp_error($id)) {
            $log('Attention : ' . $id->get_error_message());
            continue;
        }
        $meta($id, 'tatos_data', isset($page['data']) ? wp_json_encode($page['data']) : '');
        $meta($id, 'tatos_meta_title', $page['metaTitle'] ?? '');
        $meta($id, 'tatos_meta_description', $page['metaDescription'] ?? '');
    }
    if (!empty($data['pages'])) {
        $log(count($data['pages']) . ' pages');
    }

    foreach ($data['faq'] ?? [] as $ci => $cat) {
        $term = get_term_by('name', $cat['title'], 'faq_categorie') ?: (object) wp_insert_term($cat['title'], 'faq_categorie');
        $termId = $term->term_id ?? 0;
        if ($termId) {
            update_term_meta($termId, 'ordre', $ci);
        }
        foreach ($cat['items'] as $i => $item) {
            $existing = get_posts(['post_type' => 'faq', 'title' => $item['question'], 'numberposts' => 1, 'post_status' => 'any']);
            $postarr = ['post_type' => 'faq', 'post_status' => 'publish', 'post_title' => $item['question'], 'post_content' => $item['answer'], 'menu_order' => $ci * 100 + $i];
            if ($existing) {
                $postarr['ID'] = $existing[0]->ID;
            }
            $id = wp_insert_post(wp_slash($postarr));
            if ($termId) {
                wp_set_object_terms($id, [(int) $termId], 'faq_categorie');
            }
        }
    }
    if (!empty($data['faq'])) {
        $log(count($data['faq']) . ' catégories de FAQ');
    }

    foreach ($data['posts'] ?? [] as $post) {
        $existing = get_posts(['post_type' => 'post', 'name' => $post['slug'], 'numberposts' => 1, 'post_status' => 'any']);
        $postarr = [
            'post_type' => 'post',
            'post_status' => 'publish',
            'post_title' => $post['title'],
            'post_name' => $post['slug'],
            'post_excerpt' => $post['excerpt'] ?? '',
            'post_content' => $post['content'] ?? '',
            'post_date_gmt' => gmdate('Y-m-d H:i:s', strtotime($post['date'])),
            'post_date' => get_date_from_gmt(gmdate('Y-m-d H:i:s', strtotime($post['date']))),
        ];
        if ($existing) {
            $postarr['ID'] = $existing[0]->ID;
        }
        $id = wp_insert_post(wp_slash($postarr), true);
        if (is_wp_error($id)) {
            $log('Attention : ' . $id->get_error_message());
            continue;
        }
        $meta($id, 'tatos_image', $post['image'] ?? '');
        $meta($id, 'tatos_image_alt', $post['imageAlt'] ?? '');
        if (!empty($post['category'])) {
            $cat = get_term_by('name', $post['category'], 'category') ?: (object) wp_insert_term($post['category'], 'category');
            if (!empty($cat->term_id)) {
                wp_set_post_categories($id, [(int) $cat->term_id]);
            }
        }
    }
    if (!empty($data['posts'])) {
        $log(count($data['posts']) . ' articles');
    }
    // Article d'exemple de l'installation WordPress : retiré du site.
    $hello = get_posts(['post_type' => 'post', 'name' => 'hello-world', 'numberposts' => 1, 'post_status' => 'any']);
    if ($hello) {
        wp_trash_post($hello[0]->ID);
    }

    foreach (['header' => 'header', 'footerLegal' => 'footer-legal'] as $key => $location) {
        if (empty($data['menus'][$key])) {
            continue;
        }
        $name = $location === 'header' ? 'Menu principal' : 'Liens légaux';
        $menu = wp_get_nav_menu_object($name);
        $menuId = $menu ? $menu->term_id : wp_create_nav_menu($name);
        foreach (wp_get_nav_menu_items($menuId) ?: [] as $old) {
            wp_delete_post($old->ID, true);
        }
        foreach ($data['menus'][$key] as $pos => $item) {
            $itemId = wp_update_nav_menu_item($menuId, 0, [
                'menu-item-title' => $item['label'],
                'menu-item-url' => home_url($item['href']),
                'menu-item-status' => 'publish',
                'menu-item-type' => 'custom',
                'menu-item-position' => $pos + 1,
            ]);
            if (!is_wp_error($itemId) && !empty($item['dataCy'])) {
                update_post_meta($itemId, '_tatos_data_cy', wp_slash($item['dataCy']));
            }
        }
        $locations = get_theme_mod('nav_menu_locations') ?: [];
        $locations[$location] = $menuId;
        set_theme_mod('nav_menu_locations', $locations);
    }
    $GLOBALS['tatos_suspend_webhooks'] = false;
    return $count;
}

/* ------------------------------------------------------------------------------------------------
 * Bouton « Importer les contenus du site » (Réglages → Site et magasin) : import par étapes
 * (contenus, puis produits par lots de 25) pour rester sous les limites de temps des hébergements.
 * --------------------------------------------------------------------------------------------- */
add_action('wp_ajax_tatos_import', function () {
    if (!current_user_can('manage_options') || !check_ajax_referer('tatos_import', '_ajax_nonce', false)) {
        wp_send_json_error(['message' => 'Accès refusé.'], 403);
    }
    if (function_exists('set_time_limit')) {
        @set_time_limit(300);
    }
    $step = sanitize_key(wp_unslash($_POST['step'] ?? ''));
    $messages = [];
    $log = function ($m) use (&$messages) {
        $messages[] = (string) $m;
    };
    if ($step === 'content') {
        $res = tatos_site_request('GET', 'export?part=content', null, 60);
        if (!$res['ok']) {
            wp_send_json_error(['message' => $res['error']]);
        }
        $data = $res['data'];
        $total = (int) ($data['productCount'] ?? 0);
        unset($data['productCount'], $data['products']);
        // Les réglages techniques (liaison) restent ceux saisis dans WordPress.
        if (isset($data['settings']) && is_array($data['settings'])) {
            $data['settings'] = array_diff_key($data['settings'], array_flip(TATOS_TECHNICAL_FIELDS));
        }
        tatos_import($data, $log);
        wp_send_json_success(['messages' => $messages, 'productCount' => $total, 'per' => 25]);
    }
    if ($step === 'products') {
        $page = max(1, (int) ($_POST['page'] ?? 1));
        $res = tatos_site_request('GET', 'export?part=products&per=25&page=' . $page, null, 60);
        if (!$res['ok']) {
            wp_send_json_error(['message' => $res['error']]);
        }
        $count = tatos_import(['products' => $res['data']['products'] ?? []], $log);
        wp_send_json_success(['imported' => $count]);
    }
    if ($step === 'finish') {
        tatos_notify_frontend('sync.full');
        wp_send_json_success(['messages' => ['Import terminé : le site a été prévenu.']]);
    }
    wp_send_json_error(['message' => 'Étape inconnue.']);
});
