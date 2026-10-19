<?php
/**
 * Retire des contenus de pages les champs de surtitre (« eyebrow ») et d'étiquette (« tag ») qui ne
 * sont plus affichés par le site, sans toucher au reste (modifications faites dans WordPress gardées) :
 *   php wordpress/.local/wp-cli.phar --path=wordpress/.local/wp eval-file wordpress/strip-kickers.php
 */
$strip = function ($v) use (&$strip) {
    if (!is_array($v)) {
        return $v;
    }
    $out = [];
    foreach ($v as $k => $item) {
        if ($k === 'eyebrow' || $k === 'tag') {
            continue;
        }
        $out[$k] = $strip($item);
    }
    return $out;
};
foreach (get_posts(['post_type' => 'page', 'numberposts' => -1, 'post_status' => 'any']) as $page) {
    $raw = (string) get_post_meta($page->ID, 'tatos_data', true);
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        continue;
    }
    $clean = $strip($data);
    if ($clean !== $data) {
        $GLOBALS['tatos_suspend_webhooks'] = true;
        update_post_meta($page->ID, 'tatos_data', wp_slash(wp_json_encode($clean, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)));
        WP_CLI::log('Nettoyé : ' . $page->post_name);
    }
}
$GLOBALS['tatos_suspend_webhooks'] = false;
tatos_notify_frontend('content.updated', ['type' => 'page']);
WP_CLI::success('Surtitres et étiquettes retirés des contenus de pages.');
