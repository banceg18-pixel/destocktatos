<?php
/**
 * Applique les photos libres de droit (wordpress/export/images-libres.json) aux contenus WordPress,
 * en ne modifiant que les champs image (le reste des pages et articles est conservé) :
 *   php wordpress/.local/wp-cli.phar --path=wordpress/.local/wp eval-file wordpress/set-free-images.php
 */
$map = json_decode(file_get_contents(__DIR__ . '/export/images-libres.json'), true);
$GLOBALS['tatos_suspend_webhooks'] = true;

$page = get_page_by_path('services');
if ($page) {
    $data = json_decode((string) get_post_meta($page->ID, 'tatos_data', true), true);
    foreach ($map['services'] as $i => [$image, $alt]) {
        if (isset($data['services'][$i])) {
            $data['services'][$i]['image'] = $image;
            $data['services'][$i]['imageAlt'] = $alt;
        }
    }
    update_post_meta($page->ID, 'tatos_data', wp_slash(wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    WP_CLI::log('Services : 4 images');
}
$page = get_page_by_path('a-propos');
if ($page) {
    $data = json_decode((string) get_post_meta($page->ID, 'tatos_data', true), true);
    [$data['history']['image'], $data['history']['imageAlt']] = $map['history'];
    update_post_meta($page->ID, 'tatos_data', wp_slash(wp_json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
    WP_CLI::log('À propos : 1 image');
}
foreach ($map['posts'] as $slug => [$image, $alt]) {
    $found = get_posts(['post_type' => 'post', 'name' => $slug, 'numberposts' => 1, 'post_status' => 'any']);
    if ($found) {
        update_post_meta($found[0]->ID, 'tatos_image', wp_slash($image));
        update_post_meta($found[0]->ID, 'tatos_image_alt', wp_slash($alt));
        WP_CLI::log("Article $slug : image");
    }
}
$GLOBALS['tatos_suspend_webhooks'] = false;
tatos_notify_frontend('content.updated', ['type' => 'page']);
WP_CLI::success('Photos libres de droit appliquées.');
