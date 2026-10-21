<?php
/**
 * Menu « Boutique » de l'administration : tableau de bord, commandes, clients, codes promo, avis,
 * messages, newsletter et stock. Les données vivent dans la base du site (Next.js) ; chaque écran
 * les lit et les modifie via l'API d'administration (voir site-api.php).
 */

if (!defined('ABSPATH')) {
    exit;
}

const TATOS_ORDER_LABELS = [
    'EN_ATTENTE_PAIEMENT' => 'En attente de paiement',
    'EN_ATTENTE_VIREMENT' => 'En attente de virement',
    'PAYEE' => 'Payée',
    'EN_PREPARATION' => 'En préparation',
    'EXPEDIEE' => 'Expédiée',
    'LIVREE' => 'Livrée',
    'ANNULEE' => 'Annulée',
    'PAIEMENT_ECHOUE' => 'Paiement refusé',
];
const TATOS_MESSAGE_KINDS = [
    'contact' => ['label' => 'Contact', 'statuses' => ['NOUVEAU' => 'Nouveau', 'EN_COURS' => 'En cours', 'TRAITE' => 'Traité']],
    'services' => ['label' => 'Rendez-vous', 'statuses' => ['NOUVEAU' => 'Nouveau', 'PLANIFIE' => 'Planifié', 'TRAITE' => 'Traité', 'ANNULE' => 'Annulé']],
    'tickets' => ['label' => 'Signalements', 'statuses' => ['OUVERT' => 'Ouvert', 'EN_COURS' => 'En cours', 'RESOLU' => 'Résolu', 'FERME' => 'Fermé']],
];

function tatos_order_label(string $status, bool $pickup = false): string
{
    if ($pickup && $status === 'EXPEDIEE') {
        return 'Prête à retirer';
    }
    if ($pickup && $status === 'LIVREE') {
        return 'Retirée';
    }
    return TATOS_ORDER_LABELS[$status] ?? $status;
}

/** Mode de règlement d'une commande, en clair. */
function tatos_payment_label(?string $provider, ?string $mode = null): string
{
    $label = ['stripe' => 'Carte bancaire (Stripe)', 'virement' => 'Virement bancaire', 'sur_place' => 'À la livraison ou au retrait', 'test' => 'Simulation (tests automatisés)'][$provider ?? ''] ?? ($provider ?: '—');
    return $provider === 'stripe' && $mode === 'test' ? $label . ' — clé Stripe de test' : $label;
}

/** Commande confirmée en attente du virement du client (à passer à « Payée » à réception). */
function tatos_order_awaiting_transfer(array $o): bool
{
    return ($o['status'] ?? '') === 'EN_ATTENTE_VIREMENT';
}

/** Ancienne commande confirmée dont le règlement se fait à la livraison ou au retrait (pas encore encaissé). */
function tatos_order_to_collect(array $o): bool
{
    return ($o['paymentProvider'] ?? '') === 'sur_place' && empty($o['paidAt']) && !in_array($o['status'], ['ANNULEE', 'EN_ATTENTE_PAIEMENT'], true);
}

function tatos_badge(string $text, string $tone = ''): string
{
    return '<span class="tatos-badge ' . esc_attr($tone) . '">' . esc_html($text) . '</span>';
}

function tatos_order_tone(string $status): string
{
    return ['EN_ATTENTE_VIREMENT' => 'info', 'PAYEE' => 'warn', 'EN_PREPARATION' => 'warn', 'EXPEDIEE' => 'info', 'LIVREE' => 'ok', 'ANNULEE' => 'muted', 'PAIEMENT_ECHOUE' => 'bad', 'EN_ATTENTE_PAIEMENT' => 'muted'][$status] ?? '';
}

function tatos_admin_link(string $page, array $args = []): string
{
    return add_query_arg(array_merge(['page' => $page], $args), admin_url('admin.php'));
}

function tatos_action_form_open(string $action, string $class = ''): string
{
    return '<form method="post" action="' . esc_url(admin_url('admin-post.php')) . '" class="' . esc_attr($class) . '"><input type="hidden" name="action" value="' . esc_attr($action) . '">'
        . wp_nonce_field('tatos_shop_action', '_tatos_nonce', true, false);
}

/** Statistiques partagées (menu, tableau de bord, widget), gardées 60 s. */
function tatos_stats(bool $fresh = false): ?array
{
    $cached = $fresh ? false : get_transient('tatos_stats');
    if (is_array($cached)) {
        return empty($cached['__unavailable']) ? $cached : null;
    }
    $res = tatos_site_request('GET', 'stats', null, 6);
    if (!$res['ok']) {
        // Site injoignable : on ne réessaie pas à chaque écran (l'administration reste rapide).
        set_transient('tatos_stats', ['__unavailable' => true], 30);
        return null;
    }
    set_transient('tatos_stats', $res['data'], 60);
    return $res['data'];
}

function tatos_error_box(array $res): void
{
    printf('<div class="notice notice-error"><p>%s</p><p><a href="%s">Réglages de la liaison avec le site</a></p></div>', esc_html($res['error']), esc_url(admin_url('options-general.php?page=tatos-headless')));
}

function tatos_pagination(array $data, string $page, array $args = []): void
{
    $pages = (int) ($data['pages'] ?? 1);
    $current = (int) ($data['page'] ?? 1);
    if ($pages <= 1) {
        return;
    }
    echo '<div class="tablenav"><div class="tablenav-pages"><span class="displaying-num">' . (int) $data['total'] . ' éléments</span> ';
    echo paginate_links(['base' => esc_url_raw(add_query_arg(array_merge($args, ['page' => $page, 'paged' => '%#%']), admin_url('admin.php'))), 'format' => '', 'current' => $current, 'total' => $pages, 'prev_text' => '‹', 'next_text' => '›']);
    echo '</div></div>';
}

function tatos_paged(): int
{
    return max(1, (int) ($_GET['paged'] ?? 1));
}

function tatos_search_box(string $page, string $placeholder, array $hidden = []): void
{
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    echo '<form method="get" class="tatos-search"><input type="hidden" name="page" value="' . esc_attr($page) . '">';
    foreach ($hidden as $k => $v) {
        echo '<input type="hidden" name="' . esc_attr($k) . '" value="' . esc_attr($v) . '">';
    }
    printf('<input type="search" name="q" value="%s" placeholder="%s"> <button class="button">Rechercher</button></form>', esc_attr($q), esc_attr($placeholder));
}

/* ------------------------------------------------------------------------------------------------
 * Menu
 * --------------------------------------------------------------------------------------------- */
add_action('admin_menu', function () {
    $cap = tatos_shop_cap();
    $stats = current_user_can($cap) ? tatos_stats() : null;
    $bubble = fn(int $n) => $n > 0 ? ' <span class="awaiting-mod"><span>' . $n . '</span></span>' : '';
    $toShip = (int) ($stats['toShip'] ?? 0);
    $messages = (int) (($stats['messages']['contact'] ?? 0) + ($stats['messages']['services'] ?? 0) + ($stats['messages']['tickets'] ?? 0));
    add_menu_page('Boutique', 'Boutique' . $bubble($toShip + $messages + ($stats ? count(tatos_sold_out($stats)) : 0)), $cap, 'tatos-boutique', 'tatos_page_dashboard', 'dashicons-store', 3);
    add_submenu_page('tatos-boutique', 'Tableau de bord', 'Tableau de bord', $cap, 'tatos-boutique', 'tatos_page_dashboard');
    add_submenu_page('tatos-boutique', 'Commandes', 'Commandes' . $bubble($toShip), $cap, 'tatos-orders', 'tatos_page_orders');
    add_submenu_page('tatos-boutique', 'Clients', 'Clients', $cap, 'tatos-customers', 'tatos_page_customers');
    $soldOut = $stats ? count(tatos_sold_out($stats)) : 0;
    add_submenu_page('tatos-boutique', 'Stock', 'Stock' . $bubble($soldOut), $cap, 'tatos-stock', 'tatos_page_stock');
    add_submenu_page('tatos-boutique', 'Codes promo', 'Codes promo', $cap, 'tatos-coupons', 'tatos_page_coupons');
    add_submenu_page('tatos-boutique', 'Avis clients', 'Avis clients', $cap, 'tatos-reviews', 'tatos_page_reviews');
    add_submenu_page('tatos-boutique', 'Messages', 'Messages' . $bubble($messages), $cap, 'tatos-messages', 'tatos_page_messages');
    add_submenu_page('tatos-boutique', 'Newsletter', 'Newsletter', $cap, 'tatos-newsletter', 'tatos_page_newsletter');
});

/* ------------------------------------------------------------------------------------------------
 * Tableau de bord (et widget de l'accueil WordPress)
 * --------------------------------------------------------------------------------------------- */
function tatos_kpis(array $s): string
{
    $cards = [
        ['Chiffre d\'affaires (30 j)', tatos_eur($s['revenue30Cents'] ?? 0), ($s['orders30'] ?? 0) . ' commande(s) payée(s)', tatos_admin_link('tatos-orders')],
        ['À préparer / expédier', (string) ($s['toShip'] ?? 0), 'confirmées, pas encore parties', tatos_admin_link('tatos-orders', ['status' => 'A_TRAITER'])],
        ['Virements attendus', (string) ($s['awaitingTransfer'] ?? 0), 'commandes à passer à « Payée » à réception', tatos_admin_link('tatos-orders', ['status' => 'EN_ATTENTE_VIREMENT'])],
        ['Messages à traiter', (string) (($s['messages']['contact'] ?? 0) + ($s['messages']['services'] ?? 0) + ($s['messages']['tickets'] ?? 0)), ($s['messages']['services'] ?? 0) . ' rendez-vous, ' . ($s['messages']['tickets'] ?? 0) . ' signalement(s)', tatos_admin_link('tatos-messages')],
        ['Clients', (string) ($s['customers'] ?? 0), '+' . ($s['newCustomers'] ?? 0) . ' sur 30 jours', tatos_admin_link('tatos-customers')],
        ['Stock faible', (string) ($s['lowStockCount'] ?? 0), 'produits à 0 ou 1 exemplaire', tatos_admin_link('tatos-stock', ['low' => '1'])],
        ['Newsletter', (string) ($s['subscribers'] ?? 0), 'abonnés', tatos_admin_link('tatos-newsletter')],
    ];
    $html = '<div class="tatos-kpis">';
    foreach ($cards as [$label, $value, $hint, $url]) {
        $html .= '<a class="tatos-kpi" href="' . esc_url($url) . '"><span class="tatos-kpi-label">' . esc_html($label) . '</span><strong>' . esc_html($value) . '</strong><span class="tatos-kpi-hint">' . esc_html($hint) . '</span></a>';
    }
    return $html . '</div>';
}

function tatos_page_dashboard(): void
{
    $s = tatos_stats(true);
    echo '<div class="wrap tatos-wrap"><h1>Boutique</h1>';
    if (!$s) {
        tatos_error_box(tatos_site_request('GET', 'stats', null, 6));
        echo '</div>';
        return;
    }
    echo tatos_kpis($s);
    $home = get_page_by_path('accueil');
    echo '<div class="tatos-quick">';
    $links = [
        ['Ajouter un produit', admin_url('post-new.php?post_type=produit')],
        ['Écrire un article', admin_url('post-new.php')],
        ['Modifier la page d\'accueil', $home ? get_edit_post_link($home->ID, 'url') : admin_url('edit.php?post_type=page')],
        ['Menus du site', admin_url('nav-menus.php')],
        ['Coordonnées du magasin', current_user_can('manage_options') ? admin_url('options-general.php?page=tatos-headless') : ''],
        ["Guide d'utilisation", admin_url('admin.php?page=tatos-guide')],
        ['Voir le site ↗', tatos_site_url()],
    ];
    $links = array_filter($links, fn($l) => $l[1] !== '');
    foreach ($links as [$label, $url]) {
        printf('<a class="button" href="%s"%s>%s</a> ', esc_url($url), str_contains($label, '↗') ? ' target="_blank" rel="noopener"' : '', esc_html($label));
    }
    echo '</div><div class="tatos-columns"><div><h2>Dernières commandes</h2>';
    if (empty($s['recentOrders'])) {
        echo '<p>Aucune commande pour le moment.</p>';
    } else {
        echo '<table class="widefat striped"><thead><tr><th>Commande</th><th>Client</th><th>Total</th><th>Statut</th></tr></thead><tbody>';
        foreach ($s['recentOrders'] as $o) {
            printf('<tr><td><a href="%s"><strong>%s</strong></a><br><span class="description">%s</span></td><td>%s</td><td>%s</td><td>%s</td></tr>', esc_url(tatos_admin_link('tatos-orders', ['order' => $o['id']])), esc_html($o['number']), esc_html(tatos_date($o['createdAt'])), esc_html($o['customer']), esc_html(tatos_eur($o['totalCents'])), tatos_badge(tatos_order_label($o['status']), tatos_order_tone($o['status'])));
        }
        echo '</tbody></table>';
    }
    echo '</div><div><h2>Stock faible</h2>';
    if (empty($s['lowStock'])) {
        echo '<p>Aucun produit en rupture.</p>';
    } else {
        echo '<table class="widefat striped"><tbody>';
        foreach ($s['lowStock'] as $p) {
            printf('<tr><td>%s %s<br><span class="description">%s</span></td><td>%s</td></tr>', esc_html($p['marque']), esc_html($p['titre']), esc_html($p['modele']), tatos_badge($p['stock'] . ' en stock', $p['stock'] > 0 ? 'warn' : 'bad'));
        }
        echo '</tbody></table><p><a href="' . esc_url(tatos_admin_link('tatos-stock', ['low' => '1'])) . '">Gérer le stock →</a></p>';
    }
    printf('<h2>Avis clients</h2><p>%d avis, note moyenne %s / 5. <a href="%s">Modérer →</a></p>', (int) $s['reviews']['count'], esc_html(number_format((float) $s['reviews']['average'], 1, ',', '')), esc_url(tatos_admin_link('tatos-reviews')));
    echo '</div></div></div>';
}

add_action('wp_dashboard_setup', function () {
    if (!current_user_can(tatos_shop_cap())) {
        return;
    }
    wp_add_dashboard_widget('tatos_dashboard', 'Boutique — activité', function () {
        $s = tatos_stats();
        if (!$s) {
            echo '<p>Le site ne répond pas. <a href="' . esc_url(admin_url('options-general.php?page=tatos-headless')) . '">Vérifier la liaison</a></p>';
            return;
        }
        echo tatos_kpis($s);
        echo '<p><a class="button button-primary" href="' . esc_url(tatos_admin_link('tatos-boutique')) . '">Ouvrir la boutique</a></p>';
    }, null, null, 'normal', 'high');
    // Site headless : les encarts liés au thème WordPress et aux brouillons rapides n'ont pas d'usage.
    remove_meta_box('dashboard_quick_press', 'dashboard', 'side');
    remove_meta_box('dashboard_primary', 'dashboard', 'side');
});
remove_action('welcome_panel', 'wp_welcome_panel');

/* ------------------------------------------------------------------------------------------------
 * Commandes
 * --------------------------------------------------------------------------------------------- */
function tatos_page_orders(): void
{
    echo '<div class="wrap tatos-wrap">';
    if (!empty($_GET['order'])) {
        tatos_order_detail(sanitize_text_field(wp_unslash($_GET['order'])));
        echo '</div>';
        return;
    }
    echo '<h1>Commandes</h1>';
    $status = sanitize_text_field(wp_unslash($_GET['status'] ?? ''));
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    echo '<ul class="subsubsub">';
    $tabs = ['' => 'Toutes', 'A_TRAITER' => 'À traiter'] + array_diff_key(TATOS_ORDER_LABELS, ['EN_ATTENTE_PAIEMENT' => 1]);
    $i = 0;
    foreach ($tabs as $key => $label) {
        printf('<li>%s<a href="%s" class="%s">%s</a></li>', $i++ ? ' | ' : '', esc_url(tatos_admin_link('tatos-orders', $key ? ['status' => $key] : [])), $status === $key ? 'current' : '', esc_html($label));
    }
    echo '</ul>';
    tatos_search_box('tatos-orders', 'N° de commande, nom ou email', $status ? ['status' => $status] : []);
    $res = tatos_site_request('GET', 'orders?' . http_build_query(array_filter(['status' => $status, 'q' => $q, 'page' => tatos_paged(), 'per' => 25])));
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    $d = $res['data'];
    echo '<table class="widefat striped tatos-table"><thead><tr><th>Commande</th><th>Date</th><th>Client</th><th>Livraison</th><th>Articles</th><th>Total</th><th>Statut</th></tr></thead><tbody>';
    if (!$d['items']) {
        echo '<tr><td colspan="7">Aucune commande.</td></tr>';
    }
    foreach ($d['items'] as $o) {
        printf(
            '<tr><td><a href="%s"><strong>%s</strong></a>%s</td><td>%s</td><td>%s<br><span class="description">%s</span></td><td>%s</td><td>%d</td><td>%s</td><td>%s</td></tr>',
            esc_url(tatos_admin_link('tatos-orders', ['order' => $o['id']])),
            esc_html($o['number']),
            tatos_order_awaiting_transfer($o) ? ' ' . tatos_badge('virement attendu', 'info') : (tatos_order_to_collect($o) ? ' ' . tatos_badge('à encaisser', 'info') : ''),
            esc_html(tatos_date($o['createdAt'])),
            esc_html($o['customer']),
            esc_html($o['email']),
            $o['pickup'] ? 'Retrait en magasin' : 'Livraison',
            (int) $o['items'],
            esc_html(tatos_eur($o['totalCents'])),
            tatos_badge(tatos_order_label($o['status'], (bool) $o['pickup']), tatos_order_tone($o['status']))
        );
    }
    echo '</tbody></table>';
    tatos_pagination($d, 'tatos-orders', array_filter(['status' => $status, 'q' => $q]));
    echo '</div>';
}

function tatos_address_html($a): string
{
    if (!is_array($a)) {
        return '—';
    }
    $lines = array_filter([$a['fullName'] ?? $a['name'] ?? '', $a['address'] ?? '', $a['email'] ?? '', trim(($a['postalCode'] ?? '') . ' ' . ($a['city'] ?? '')), $a['phone'] ?? '', isset($a['floor']) && $a['floor'] !== '' ? 'Étage : ' . $a['floor'] : '', $a['info'] ?? '']);
    return implode('<br>', array_map('esc_html', array_map('strval', $lines)));
}

function tatos_order_detail(string $id): void
{
    $res = tatos_site_request('GET', 'orders/' . rawurlencode($id));
    echo '<p><a href="' . esc_url(tatos_admin_link('tatos-orders')) . '">← Toutes les commandes</a></p>';
    if (!$res['ok']) {
        tatos_error_box($res);
        return;
    }
    $o = $res['data'];
    $pickup = !empty($o['isPickupInStore']);
    printf('<h1>Commande %s %s</h1>', esc_html($o['number']), tatos_badge(tatos_order_label($o['status'], $pickup), tatos_order_tone($o['status'])));
    $collect = tatos_order_to_collect($o);
    $transfer = tatos_order_awaiting_transfer($o);
    printf('<p>Passée le %s%s · Client : <a href="%s">%s</a> (%s)</p>', esc_html(tatos_date($o['createdAt'])), $o['paidAt'] ? ', payée le ' . esc_html(tatos_date($o['paidAt'])) : ($transfer ? ', virement attendu de ' . esc_html(tatos_eur($o['totalCents'])) . ' (référence ' . esc_html($o['number']) . ')' : ($collect ? ', à encaisser ' . ($pickup ? 'au retrait' : 'à la livraison') . ' (' . esc_html(tatos_eur($o['totalCents'])) . ')' : '')), esc_url(tatos_admin_link('tatos-customers', ['customer' => $o['user']['id']])), esc_html($o['user']['name']), esc_html($o['user']['email']));
    echo '<div class="tatos-columns"><div>';
    echo '<h2>Articles</h2><table class="widefat striped"><thead><tr><th>Produit</th><th>Prix unitaire</th><th>Qté</th><th>Total</th></tr></thead><tbody>';
    foreach ($o['items'] as $it) {
        printf('<tr><td>%s %s</td><td>%s</td><td>%d</td><td>%s</td></tr>', esc_html($it['marque']), esc_html($it['titre']), esc_html(tatos_eur($it['unitPriceCents'])), (int) $it['quantity'], esc_html(tatos_eur($it['lineTotalCents'])));
    }
    echo '</tbody><tfoot>';
    printf('<tr><th colspan="3">Sous-total</th><th>%s</th></tr>', esc_html(tatos_eur($o['subtotalCents'])));
    if (!empty($o['discountCents'])) {
        printf('<tr><th colspan="3">Réduction %s</th><th>−%s</th></tr>', esc_html((string) ($o['couponCode'] ?? '')), esc_html(tatos_eur($o['discountCents'])));
    }
    $delivery = $pickup ? 'Retrait en magasin' : (['piedDuCamion' => 'Pied du camion', 'livraisonPiece' => 'Dans la pièce', 'installation' => 'Avec installation'][$o['deliveryMethod']] ?? 'Livraison') . ' — ' . round((float) $o['deliveryDistanceKm']) . ' km' . (!empty($o['includeOldItemPickup']) ? ', reprise de l\'ancien appareil' : '');
    printf('<tr><th colspan="3">%s</th><th>%s</th></tr><tr><th colspan="3">Total</th><th>%s</th></tr></tfoot></table>', esc_html($delivery), esc_html(tatos_eur($o['deliveryFeeCents'])), esc_html(tatos_eur($o['totalCents'])));
    echo '<h2>' . ($pickup ? 'Retrait' : 'Adresse de livraison') . '</h2><p>' . ($pickup ? 'Le client vient chercher sa commande au magasin.' : tatos_address_html($o['shippingAddress'])) . '</p>';
    if (!empty($o['billingAddress'])) {
        echo '<h2>Facturation</h2><p>' . tatos_address_html($o['billingAddress']) . '</p>';
    }
    echo '<h2>Paiements</h2><table class="widefat striped"><tbody>';
    foreach ($o['payments'] as $p) {
        printf('<tr><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>', esc_html(tatos_date($p['createdAt'])), esc_html(tatos_payment_label($p['provider'], $p['mode'])), esc_html(tatos_eur($p['amountCents'])), esc_html(['REUSSI' => 'Réussi', 'ECHOUE' => 'Refusé', 'EN_ATTENTE' => 'En attente', 'ANNULE' => 'Annulé'][$p['status']] ?? $p['status']));
    }
    if (!$o['payments']) {
        echo '<tr><td>Aucun paiement.</td></tr>';
    }
    echo '</tbody></table></div><div class="tatos-side">';
    if ($o['status'] !== 'ANNULEE') {
        echo '<div class="tatos-card"><h2>Changer le statut</h2>' . tatos_action_form_open('tatos_order_status', 'tatos-confirm-cancel');
        printf('<input type="hidden" name="order" value="%s"><p><select name="status">', esc_attr($o['id']));
        // En attente de virement : « Payée (virement reçu) » ou annulation ; ensuite préparation, livraison.
        foreach ($transfer ? ['EN_ATTENTE_VIREMENT', 'PAYEE', 'ANNULEE'] : ['EN_PREPARATION', 'EXPEDIEE', 'LIVREE', 'ANNULEE'] as $st) {
            if (!$transfer && !$o['paidAt'] && !$collect && $st !== 'ANNULEE') {
                continue;
            }
            $label = $st === 'PAYEE' ? 'Payée (virement reçu)' : tatos_order_label($st, $pickup);
            printf('<option value="%s" %s %s>%s</option>', esc_attr($st), selected($o['status'], $st, false), $st === 'EN_ATTENTE_VIREMENT' ? 'disabled' : '', esc_html($label));
        }
        echo '</select></p><p><label><input type="checkbox" name="notify" value="1" checked> Prévenir le client par email</label></p>';
        echo '<p class="description">' . ($transfer ? 'À réception du virement sur votre compte, choisissez « Payée (virement reçu) » : le client reçoit sa facture acquittée et la commande peut être préparée puis livrée. ' : '') . ($collect ? 'Passer la commande à « ' . esc_html(tatos_order_label('LIVREE', $pickup)) . ' » enregistre le règlement reçu sur place et rend la facture disponible. ' : '') . 'Annuler remet les articles en stock. Un paiement par carte se rembourse depuis votre espace Stripe.</p><p><button class="button button-primary">Mettre à jour</button></p></form></div>';
    }
    if ($o['paidAt'] || $transfer) {
        printf('<div class="tatos-card"><h2>Facture</h2><p><a class="button" target="_blank" href="%s">Ouvrir la facture PDF</a></p></div>', esc_url(wp_nonce_url(admin_url('admin-post.php?action=tatos_invoice&order=' . rawurlencode($o['id'])), 'tatos_shop_action', '_tatos_nonce')));
    }
    echo '</div></div>';
}

/* ------------------------------------------------------------------------------------------------
 * Clients
 * --------------------------------------------------------------------------------------------- */
function tatos_page_customers(): void
{
    echo '<div class="wrap tatos-wrap">';
    if (!empty($_GET['customer'])) {
        $res = tatos_site_request('GET', 'customers/' . rawurlencode(sanitize_text_field(wp_unslash($_GET['customer']))));
        echo '<p><a href="' . esc_url(tatos_admin_link('tatos-customers')) . '">← Tous les clients</a></p>';
        if (!$res['ok']) {
            tatos_error_box($res);
            echo '</div>';
            return;
        }
        $c = $res['data'];
        printf('<h1>%s</h1><p><a href="mailto:%2$s">%2$s</a> · client depuis le %3$s · connexion %4$s</p>', esc_html($c['name']), esc_html($c['email']), esc_html(tatos_date($c['createdAt'], false)), $c['login'] === 'google' ? 'avec Google' : 'par email');
        echo '<div class="tatos-columns"><div><h2>Commandes</h2><table class="widefat striped"><tbody>';
        foreach ($c['orders'] as $o) {
            printf('<tr><td><a href="%s">%s</a></td><td>%s</td><td>%s</td><td>%s</td></tr>', esc_url(tatos_admin_link('tatos-orders', ['order' => $o['id']])), esc_html($o['number']), esc_html(tatos_date($o['createdAt'], false)), esc_html(tatos_eur($o['totalCents'])), tatos_badge(tatos_order_label($o['status']), tatos_order_tone($o['status'])));
        }
        if (!$c['orders']) {
            echo '<tr><td>Aucune commande.</td></tr>';
        }
        echo '</tbody></table></div><div><h2>Adresses</h2>';
        foreach ($c['addresses'] as $a) {
            echo '<div class="tatos-card"><p>' . tatos_address_html($a) . '</p></div>';
        }
        if (!$c['addresses']) {
            echo '<p>Aucune adresse enregistrée.</p>';
        }
        echo '</div></div></div>';
        return;
    }
    echo '<h1>Clients</h1>';
    tatos_search_box('tatos-customers', 'Nom ou email');
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    $res = tatos_site_request('GET', 'customers?' . http_build_query(array_filter(['q' => $q, 'page' => tatos_paged(), 'per' => 30])));
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    echo '<table class="widefat striped"><thead><tr><th>Client</th><th>Inscription</th><th>Connexion</th><th>Commandes</th><th>Total dépensé</th></tr></thead><tbody>';
    foreach ($res['data']['items'] as $c) {
        printf('<tr><td><a href="%s"><strong>%s</strong></a><br><span class="description">%s</span></td><td>%s</td><td>%s</td><td>%d</td><td>%s</td></tr>', esc_url(tatos_admin_link('tatos-customers', ['customer' => $c['id']])), esc_html($c['name']), esc_html($c['email']), esc_html(tatos_date($c['createdAt'], false)), $c['login'] === 'google' ? 'Google' : 'Email', (int) $c['orders'], esc_html(tatos_eur($c['spentCents'])));
    }
    if (!$res['data']['items']) {
        echo '<tr><td colspan="5">Aucun client.</td></tr>';
    }
    echo '</tbody></table>';
    tatos_pagination($res['data'], 'tatos-customers', array_filter(['q' => $q]));
    echo '</div>';
}

/* ------------------------------------------------------------------------------------------------
 * Stock
 * --------------------------------------------------------------------------------------------- */
function tatos_page_stock(): void
{
    echo '<div class="wrap tatos-wrap"><h1>Stock</h1><p>Le stock du site baisse automatiquement à chaque commande. Corrigez-le ici après une livraison fournisseur ou un inventaire.</p>';
    $low = !empty($_GET['low']);
    $out = !empty($_GET['out']);
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    printf(
        '<ul class="subsubsub"><li><a class="%s" href="%s">Tous les produits</a> | </li><li><a class="%s" href="%s">Épuisés (0)</a> | </li><li><a class="%s" href="%s">Stock faible (0 ou 1)</a></li></ul>',
        $low || $out ? '' : 'current',
        esc_url(tatos_admin_link('tatos-stock')),
        $out ? 'current' : '',
        esc_url(tatos_admin_link('tatos-stock', ['out' => '1'])),
        $low ? 'current' : '',
        esc_url(tatos_admin_link('tatos-stock', ['low' => '1']))
    );
    if ($out) {
        echo '<p class="description">Produits vendus jusqu\'au dernier exemplaire : indiquez le nouveau stock s\'il vous en reste (puis « Enregistrer »), ou cliquez sur « Laisser épuisé » : le produit reste affiché « en rupture » sur le site et l\'alerte disparaît.</p>';
    }
    tatos_search_box('tatos-stock', 'Produit, marque ou référence', $out ? ['out' => '1'] : ($low ? ['low' => '1'] : []));
    $res = tatos_site_request('GET', 'products?' . http_build_query(array_filter(['q' => $q, 'low' => $low ? '1' : '', 'out' => $out ? '1' : '', 'page' => tatos_paged(), 'per' => 40])));
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    $ids = array_column($res['data']['items'], 'id');
    $wp = [];
    if ($ids) {
        foreach (get_posts(['post_type' => 'produit', 'post_status' => 'any', 'numberposts' => -1, 'meta_query' => [['key' => 'tatos_id', 'value' => $ids, 'compare' => 'IN']]]) as $p) {
            $wp[get_post_meta($p->ID, 'tatos_id', true)] = $p->ID;
        }
    }
    echo '<table class="widefat striped"><thead><tr><th>Produit</th><th>Prix</th><th>Stock</th></tr></thead><tbody>';
    foreach ($res['data']['items'] as $p) {
        $price = $p['promotionPrixCents'] ? tatos_eur($p['promotionPrixCents']) . ' <del>' . tatos_eur($p['prixCents']) . '</del>' : tatos_eur($p['prixCents']);
        $edit = isset($wp[$p['id']]) ? ' · <a href="' . esc_url(get_edit_post_link($wp[$p['id']], 'url')) . '">Modifier la fiche</a>' : '';
        printf('<tr><td><strong>%s %s</strong><br><span class="description">%s · <a href="%s" target="_blank" rel="noopener">Voir ↗</a>%s</span></td><td>%s</td><td>', esc_html($p['marque']), esc_html($p['titre']), esc_html($p['modele']), esc_url($p['url']), $edit, wp_kses($price, ['del' => []]));
        echo tatos_action_form_open('tatos_stock_update', 'tatos-inline');
        printf('<input type="hidden" name="product" value="%s"><input type="number" name="stock" min="0" step="1" value="%d" class="small-text"> <button class="button">Enregistrer</button></form>', esc_attr($p['id']), (int) $p['stock']);
        if ((int) $p['stock'] <= 0 && !in_array($p['id'], (array) get_option('tatos_soldout_ack', []), true)) {
            echo tatos_action_form_open('tatos_soldout_ack', 'tatos-inline');
            printf('<input type="hidden" name="product" value="%s"><button class="button-link">Laisser épuisé</button></form>', esc_attr($p['id']));
        }
        echo '</td></tr>';
    }
    if (!$res['data']['items']) {
        echo '<tr><td colspan="3">Aucun produit.</td></tr>';
    }
    echo '</tbody></table>';
    tatos_pagination($res['data'], 'tatos-stock', array_filter(['q' => $q, 'low' => $low ? '1' : '']));
    echo '</div>';
}

/* ------------------------------------------------------------------------------------------------
 * Codes promo
 * --------------------------------------------------------------------------------------------- */
function tatos_page_coupons(): void
{
    echo '<div class="wrap tatos-wrap"><h1>Codes promo</h1><p class="description">Rappel : la réduction d\'un code est plafonnée à 10 % du montant des articles (règle du site).</p>';
    $res = tatos_site_request('GET', 'coupons');
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    $edit = null;
    if (!empty($_GET['edit'])) {
        foreach ($res['data']['items'] as $c) {
            if ($c['id'] === $_GET['edit']) {
                $edit = $c;
            }
        }
    }
    echo '<div class="tatos-columns"><div><table class="widefat striped"><thead><tr><th>Code</th><th>Réduction</th><th>Utilisations</th><th>Conditions</th><th>État</th><th></th></tr></thead><tbody>';
    foreach ($res['data']['items'] as $c) {
        $value = $c['type'] === 'POURCENTAGE' ? $c['value'] . ' %' : tatos_eur($c['value']);
        $cond = array_filter([$c['minOrderCents'] ? 'dès ' . tatos_eur($c['minOrderCents']) : '', $c['expiresAt'] ? 'jusqu\'au ' . tatos_date($c['expiresAt'], false) : '', $c['customerEmail'] ? 'réservé à ' . $c['customerEmail'] : '']);
        $state = !$c['active'] ? tatos_badge('désactivé', 'muted') : ($c['expiresAt'] && strtotime($c['expiresAt']) < time() ? tatos_badge('expiré', 'muted') : tatos_badge('actif', 'ok'));
        printf('<tr><td><strong>%s</strong><br><span class="description">%s</span></td><td>%s</td><td>%d%s</td><td>%s</td><td>%s</td><td><a href="%s">Modifier</a> · ', esc_html($c['code']), esc_html($c['description']), esc_html($value), (int) $c['usedCount'], $c['maxUses'] ? ' / ' . (int) $c['maxUses'] : '', esc_html(implode(' · ', $cond) ?: '—'), $state, esc_url(tatos_admin_link('tatos-coupons', ['edit' => $c['id']])));
        echo tatos_action_form_open('tatos_coupon_delete', 'tatos-inline tatos-confirm');
        printf('<input type="hidden" name="coupon" value="%s"><button class="button-link button-link-delete">Supprimer</button></form></td></tr>', esc_attr($c['id']));
    }
    if (!$res['data']['items']) {
        echo '<tr><td colspan="6">Aucun code.</td></tr>';
    }
    echo '</tbody></table></div><div class="tatos-side"><div class="tatos-card"><h2>' . ($edit ? 'Modifier ' . esc_html($edit['code']) : 'Nouveau code') . '</h2>';
    echo tatos_action_form_open('tatos_coupon_save');
    $v = fn($k, $d = '') => $edit[$k] ?? $d;
    printf('<input type="hidden" name="coupon" value="%s">', esc_attr($v('id')));
    printf('<p><label>Code<br><input type="text" name="code" required pattern="[A-Za-z0-9_-]{3,30}" value="%s" class="regular-text"></label></p>', esc_attr($v('code')));
    printf('<p><label>Description (interne)<br><input type="text" name="description" value="%s" class="regular-text"></label></p>', esc_attr($v('description')));
    printf('<p><label>Type<br><select name="type"><option value="POURCENTAGE" %s>Pourcentage</option><option value="MONTANT" %s>Montant fixe (€)</option></select></label></p>', selected($v('type'), 'POURCENTAGE', false), selected($v('type'), 'MONTANT', false));
    $value = $edit ? ($edit['type'] === 'MONTANT' ? number_format($edit['value'] / 100, 2, ',', '') : (string) $edit['value']) : '';
    printf('<p><label>Valeur (%% ou €)<br><input type="text" name="value" required value="%s" class="small-text"></label></p>', esc_attr($value));
    printf('<p><label>Commande minimum (€)<br><input type="text" name="min" value="%s" class="small-text"></label></p>', esc_attr($edit && $edit['minOrderCents'] ? number_format($edit['minOrderCents'] / 100, 2, ',', '') : ''));
    printf('<p><label>Nombre d\'utilisations maximum (vide = illimité)<br><input type="number" min="1" name="maxUses" value="%s" class="small-text"></label></p>', esc_attr((string) $v('maxUses')));
    printf('<p><label>Date de fin (incluse)<br><input type="date" name="expiresAt" value="%s"></label></p>', esc_attr($edit && $edit['expiresAt'] ? substr($edit['expiresAt'], 0, 10) : ''));
    printf('<p><label>Réservé au client (email, facultatif)<br><input type="email" name="customerEmail" value="%s" class="regular-text"></label></p>', esc_attr((string) $v('customerEmail')));
    printf('<p><label><input type="checkbox" name="active" value="1" %s> Actif</label></p>', checked($edit ? $edit['active'] : true, true, false));
    echo '<p><button class="button button-primary">' . ($edit ? 'Enregistrer' : 'Créer le code') . '</button>' . ($edit ? ' <a href="' . esc_url(tatos_admin_link('tatos-coupons')) . '">Annuler</a>' : '') . '</p></form></div></div></div></div>';
}

/* ------------------------------------------------------------------------------------------------
 * Avis
 * --------------------------------------------------------------------------------------------- */
function tatos_page_reviews(): void
{
    echo '<div class="wrap tatos-wrap"><h1>Avis clients</h1><p>Seuls les clients ayant acheté le produit peuvent laisser un avis. Supprimez ici un avis abusif ou hors sujet.</p>';
    $res = tatos_site_request('GET', 'reviews?' . http_build_query(['page' => tatos_paged(), 'per' => 30]));
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    echo '<table class="widefat striped"><thead><tr><th>Note</th><th>Avis</th><th>Produit</th><th>Client</th><th></th></tr></thead><tbody>';
    foreach ($res['data']['items'] as $r) {
        printf('<tr><td class="tatos-stars">%s</td><td>%s<br><span class="description">%s</span></td><td><a href="%s" target="_blank" rel="noopener">%s ↗</a></td><td>%s<br><span class="description">%s</span></td><td>', str_repeat('★', (int) $r['note']) . str_repeat('☆', 5 - (int) $r['note']), esc_html($r['commentaire'] ?: '(sans commentaire)'), esc_html(tatos_date($r['createdAt'])), esc_url($r['productUrl']), esc_html($r['product']), esc_html($r['customer']), esc_html($r['email']));
        echo tatos_action_form_open('tatos_review_delete', 'tatos-inline tatos-confirm');
        printf('<input type="hidden" name="review" value="%s"><button class="button-link button-link-delete">Supprimer</button></form></td></tr>', esc_attr($r['id']));
    }
    if (!$res['data']['items']) {
        echo '<tr><td colspan="5">Aucun avis.</td></tr>';
    }
    echo '</tbody></table>';
    tatos_pagination($res['data'], 'tatos-reviews');
    echo '</div>';
}

/* ------------------------------------------------------------------------------------------------
 * Messages (contact, rendez-vous, signalements)
 * --------------------------------------------------------------------------------------------- */
function tatos_page_messages(): void
{
    $kind = sanitize_key($_GET['kind'] ?? 'contact');
    if (!isset(TATOS_MESSAGE_KINDS[$kind])) {
        $kind = 'contact';
    }
    $status = sanitize_text_field(wp_unslash($_GET['status'] ?? ''));
    $s = tatos_stats();
    echo '<div class="wrap tatos-wrap"><h1>Messages</h1><nav class="nav-tab-wrapper">';
    foreach (TATOS_MESSAGE_KINDS as $k => $conf) {
        $n = (int) ($s['messages'][$k] ?? 0);
        printf('<a class="nav-tab %s" href="%s">%s%s</a>', $k === $kind ? 'nav-tab-active' : '', esc_url(tatos_admin_link('tatos-messages', ['kind' => $k])), esc_html($conf['label']), $n ? ' (' . $n . ')' : '');
    }
    echo '</nav><ul class="subsubsub"><li><a class="' . ($status === '' ? 'current' : '') . '" href="' . esc_url(tatos_admin_link('tatos-messages', ['kind' => $kind])) . '">Tous</a></li>';
    foreach (TATOS_MESSAGE_KINDS[$kind]['statuses'] as $key => $label) {
        printf('<li> | <a class="%s" href="%s">%s</a></li>', $status === $key ? 'current' : '', esc_url(tatos_admin_link('tatos-messages', ['kind' => $kind, 'status' => $key])), esc_html($label));
    }
    echo '</ul><div class="clear"></div>';
    $res = tatos_site_request('GET', 'messages?' . http_build_query(array_filter(['kind' => $kind, 'status' => $status, 'page' => tatos_paged(), 'per' => 20])));
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    if (!$res['data']['items']) {
        echo '<p>Aucun message.</p>';
    }
    foreach ($res['data']['items'] as $m) {
        $title = $kind === 'contact' ? ($m['subject'] ?: 'Message') : ($kind === 'services' ? ($m['service'] ?: 'Demande de rendez-vous') : '[' . $m['number'] . '] ' . $m['title']);
        $who = $kind === 'services' ? $m['fullName'] : ($m['name'] ?: $m['email']);
        // Demande de rappel laissée à l'assistant du site : parfois sans email (téléphone seul).
        $callback = $kind === 'contact' && str_starts_with((string) $m['subject'], 'Demande de rappel');
        $email = (string) ($m['email'] ?? '');
        $phone = (string) ($m['phone'] ?? '');
        echo '<div class="tatos-card tatos-message' . ($callback ? ' tatos-callback' : '') . '">';
        printf(
            '<div class="tatos-message-head"><div><strong>%s</strong>%s<br><span class="description">%s%s%s · %s</span></div><div>%s</div></div>',
            esc_html($title),
            $callback ? ' ' . tatos_badge('À rappeler', 'info') : '',
            esc_html($who),
            $email !== '' ? sprintf(' · <a href="mailto:%1$s">%1$s</a>', esc_html($email)) : '',
            $phone !== '' ? sprintf(' · <a href="tel:%s">%s</a>', esc_attr(preg_replace('/\s+/', '', $phone)), esc_html($phone)) : '',
            esc_html(tatos_date($m['createdAt'])),
            tatos_badge(TATOS_MESSAGE_KINDS[$kind]['statuses'][$m['status']] ?? $m['status'], in_array($m['status'], ['NOUVEAU', 'OUVERT'], true) ? 'warn' : 'muted')
        );
        $text = $kind === 'contact' ? $m['message'] : ($kind === 'services' ? $m['message'] : $m['description']);
        if ($text) {
            echo '<p class="tatos-message-text">' . nl2br(esc_html($text)) . '</p>';
        }
        $details = $kind === 'contact' ? [] : (array) ($m['details'] ?? []);
        if ($kind === 'tickets') {
            $details = ['Type' => $m['type'], 'Priorité' => $m['priority']] + $details;
        }
        if ($details) {
            echo '<dl class="tatos-details">';
            foreach ($details as $k => $v) {
                printf('<dt>%s</dt><dd>%s</dd>', esc_html(tatos_label((string) $k)), esc_html(is_scalar($v) ? (string) $v : wp_json_encode($v, JSON_UNESCAPED_UNICODE)));
            }
            echo '</dl>';
        }
        if ($kind === 'tickets' && !empty($m['images'])) {
            echo '<p>Captures : ';
            foreach ((array) $m['images'] as $img) {
                $url = is_array($img) ? ($img['url'] ?? '') : (string) $img;
                printf('<a href="%s" target="_blank" rel="noopener">%s</a> ', esc_url(str_starts_with($url, '/') ? tatos_site_url() . $url : $url), esc_html(is_array($img) ? ($img['name'] ?? 'image') : 'image'));
            }
            echo '</p>';
        }
        echo '<div class="tatos-message-actions">' . tatos_action_form_open('tatos_message_status', 'tatos-inline');
        printf('<input type="hidden" name="kind" value="%s"><input type="hidden" name="id" value="%s"><select name="status">', esc_attr($kind), esc_attr($m['id']));
        foreach (TATOS_MESSAGE_KINDS[$kind]['statuses'] as $key => $label) {
            printf('<option value="%s" %s>%s</option>', esc_attr($key), selected($m['status'], $key, false), esc_html($label));
        }
        echo '</select> <button class="button">Changer le statut</button></form>';
        if ($email === '') {
            // Pas d'email : le client attend un appel.
            printf('<a class="button button-primary" href="tel:%s">Appeler %s</a></div></div>', esc_attr(preg_replace('/\s+/', '', $phone)), esc_html($phone));
            continue;
        }
        echo '<details><summary class="button">Répondre par email</summary>' . tatos_action_form_open('tatos_message_reply');
        printf('<input type="hidden" name="kind" value="%s"><input type="hidden" name="id" value="%s">', esc_attr($kind), esc_attr($m['id']));
        printf('<p><input type="text" name="subject" class="large-text" required value="%s"></p>', esc_attr('Re : ' . $title));
        printf('<p><textarea name="text" rows="6" class="large-text" required>Bonjour %s,&#10;&#10;</textarea></p>', esc_textarea($who));
        echo '<p><button class="button button-primary">Envoyer la réponse</button></p></form></details></div></div>';
    }
    tatos_pagination($res['data'], 'tatos-messages', array_filter(['kind' => $kind, 'status' => $status]));
    echo '</div>';
}

/* ------------------------------------------------------------------------------------------------
 * Newsletter
 * --------------------------------------------------------------------------------------------- */
function tatos_page_newsletter(): void
{
    $q = sanitize_text_field(wp_unslash($_GET['q'] ?? ''));
    $res = tatos_site_request('GET', 'newsletter?' . http_build_query(array_filter(['q' => $q, 'page' => tatos_paged(), 'per' => 50])));
    echo '<div class="wrap tatos-wrap"><h1>Newsletter</h1>';
    if (!$res['ok']) {
        tatos_error_box($res);
        echo '</div>';
        return;
    }
    $export = wp_nonce_url(admin_url('admin-post.php?action=tatos_newsletter_export'), 'tatos_shop_action', '_tatos_nonce');
    printf('<p>%d abonné(s). <a class="button" href="%s">Exporter (CSV)</a></p>', (int) $res['data']['total'], esc_url($export));
    echo '<div class="tatos-columns"><div>';
    tatos_search_box('tatos-newsletter', 'Email');
    echo '<table class="widefat striped"><thead><tr><th>Email</th><th>Inscription</th><th></th></tr></thead><tbody>';
    foreach ($res['data']['items'] as $sub) {
        printf('<tr><td>%s</td><td>%s</td><td>', esc_html($sub['email']), esc_html(tatos_date($sub['createdAt'], false)));
        echo tatos_action_form_open('tatos_newsletter_delete', 'tatos-inline tatos-confirm');
        printf('<input type="hidden" name="subscriber" value="%s"><button class="button-link button-link-delete">Retirer</button></form></td></tr>', esc_attr($sub['id']));
    }
    if (!$res['data']['items']) {
        echo '<tr><td colspan="3">Aucun abonné.</td></tr>';
    }
    echo '</tbody></table>';
    tatos_pagination($res['data'], 'tatos-newsletter', array_filter(['q' => $q]));
    echo '</div><div class="tatos-side"><div class="tatos-card"><h2>Envoyer une lettre</h2>' . tatos_action_form_open('tatos_newsletter_send', 'tatos-confirm-send');
    echo '<p><label>Objet<br><input type="text" name="subject" class="large-text" required></label></p>';
    echo '<p><label>Message<br><textarea name="text" rows="10" class="large-text" required></textarea></label></p>';
    echo '<p class="description">Texte simple ; les adresses web deviennent des liens. Un lien de désinscription est ajouté automatiquement.</p>';
    printf('<p><label>Recevoir d\'abord un aperçu à<br><input type="email" name="testEmail" class="regular-text" value="%s"></label></p>', esc_attr(wp_get_current_user()->user_email));
    echo '<p><button class="button" name="mode" value="test">M\'envoyer un aperçu</button> <button class="button button-primary" name="mode" value="all">Envoyer à tous les abonnés</button></p></form></div></div></div></div>';
}

/* ------------------------------------------------------------------------------------------------
 * Actions (admin-post.php)
 * --------------------------------------------------------------------------------------------- */
function tatos_guard(): void
{
    if (!current_user_can(tatos_shop_cap())) {
        wp_die('Accès refusé.', 403);
    }
    check_admin_referer('tatos_shop_action', '_tatos_nonce');
}

function tatos_done(array $res, string $success, ?string $redirect = null): void
{
    set_transient('tatos_notice_' . get_current_user_id(), $res['ok'] ? ['success', $success] : ['error', $res['error']], 60);
    delete_transient('tatos_stats');
    wp_safe_redirect($redirect ?: (wp_get_referer() ?: tatos_admin_link('tatos-boutique')));
    exit;
}

function tatos_post(string $key): string
{
    return sanitize_text_field(wp_unslash($_POST[$key] ?? ''));
}

add_action('admin_post_tatos_order_status', function () {
    tatos_guard();
    $status = tatos_post('status');
    $res = tatos_site_request('PATCH', 'orders/' . rawurlencode(tatos_post('order')), ['status' => $status, 'notify' => !empty($_POST['notify'])]);
    tatos_done($res, 'Statut mis à jour : ' . ($status === 'PAYEE' ? 'Payée (virement reçu)' : tatos_order_label($status)) . (!empty($_POST['notify']) ? ' (client prévenu par email).' : '.'));
});

add_action('admin_post_tatos_invoice', function () {
    tatos_guard();
    $res = tatos_site_request('GET', 'orders/' . rawurlencode(sanitize_text_field(wp_unslash($_GET['order'] ?? ''))) . '/invoice', null, 30);
    if (!$res['ok']) {
        wp_die(esc_html($res['error']));
    }
    nocache_headers();
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="facture.pdf"');
    echo $res['body']; // phpcs:ignore WordPress.Security.EscapeOutput -- PDF binaire
    exit;
});

// Produit laissé épuisé : plus d'alerte pour lui (jusqu'à un réapprovisionnement puis une nouvelle rupture).
add_action('admin_post_tatos_soldout_ack', function () {
    tatos_guard();
    $ack = array_values(array_unique(array_merge((array) get_option('tatos_soldout_ack', []), [tatos_post('product')])));
    update_option('tatos_soldout_ack', array_slice($ack, -2000), false);
    delete_transient('tatos_stats');
    tatos_done(['ok' => true], 'Produit laissé épuisé : il reste affiché « en rupture » sur le site.');
});

add_action('admin_post_tatos_stock_update', function () {
    tatos_guard();
    $stock = max(0, (int) ($_POST['stock'] ?? 0));
    $id = tatos_post('product');
    $res = tatos_site_request('PATCH', 'products/' . rawurlencode($id), ['stock' => $stock]);
    if ($res['ok'] && $stock > 0) {
        update_option('tatos_soldout_ack', array_values(array_diff((array) get_option('tatos_soldout_ack', []), [$id])), false);
        delete_transient('tatos_stats');
    }
    if ($res['ok']) {
        foreach (get_posts(['post_type' => 'produit', 'post_status' => 'any', 'numberposts' => 1, 'meta_key' => 'tatos_id', 'meta_value' => $id]) as $p) {
            update_post_meta($p->ID, 'stock', $stock);
        }
    }
    tatos_done($res, 'Stock enregistré : ' . $stock . ' exemplaire(s).');
});

add_action('admin_post_tatos_coupon_save', function () {
    tatos_guard();
    $type = tatos_post('type') === 'MONTANT' ? 'MONTANT' : 'POURCENTAGE';
    $value = tatos_parse_number(tatos_post('value'));
    $min = tatos_parse_number(tatos_post('min'));
    $payload = [
        'code' => strtoupper(tatos_post('code')),
        'description' => tatos_post('description'),
        'type' => $type,
        'value' => $type === 'MONTANT' ? (int) round(((float) $value) * 100) : (int) round((float) $value),
        'active' => !empty($_POST['active']),
        'maxUses' => tatos_post('maxUses') === '' ? null : (int) tatos_post('maxUses'),
        'minOrderCents' => $min ? (int) round($min * 100) : 0,
        'expiresAt' => tatos_post('expiresAt') ?: null,
        'customerEmail' => tatos_post('customerEmail') ?: null,
    ];
    $id = tatos_post('coupon');
    $res = $id ? tatos_site_request('PUT', 'coupons/' . rawurlencode($id), $payload) : tatos_site_request('POST', 'coupons', $payload);
    tatos_done($res, 'Code ' . $payload['code'] . ' enregistré.', $res['ok'] ? tatos_admin_link('tatos-coupons') : null);
});

add_action('admin_post_tatos_coupon_delete', function () {
    tatos_guard();
    $res = tatos_site_request('DELETE', 'coupons/' . rawurlencode(tatos_post('coupon')));
    tatos_done($res, !empty($res['data']['deactivated']) ? 'Ce code a déjà servi : il est désactivé (et conservé dans l\'historique des commandes).' : 'Code supprimé.');
});

add_action('admin_post_tatos_review_delete', function () {
    tatos_guard();
    tatos_done(tatos_site_request('DELETE', 'reviews/' . rawurlencode(tatos_post('review'))), 'Avis supprimé.');
});

add_action('admin_post_tatos_message_status', function () {
    tatos_guard();
    tatos_done(tatos_site_request('PATCH', 'messages/' . rawurlencode(tatos_post('kind')) . '/' . rawurlencode(tatos_post('id')), ['status' => tatos_post('status')]), 'Statut du message mis à jour.');
});

add_action('admin_post_tatos_message_reply', function () {
    tatos_guard();
    $text = sanitize_textarea_field(wp_unslash($_POST['text'] ?? ''));
    $res = tatos_site_request('POST', 'messages/' . rawurlencode(tatos_post('kind')) . '/' . rawurlencode(tatos_post('id')) . '/reply', ['subject' => tatos_post('subject'), 'text' => $text]);
    tatos_done($res, !empty($res['data']['delivered']) ? 'Réponse envoyée.' : 'Réponse enregistrée, mais pas encore partie : l\'envoi d\'emails (SMTP) n\'est pas configuré sur le serveur du site. Voir le guide d\'utilisation, rubrique « Emails ».');
});

add_action('admin_post_tatos_newsletter_delete', function () {
    tatos_guard();
    tatos_done(tatos_site_request('DELETE', 'newsletter/' . rawurlencode(tatos_post('subscriber'))), 'Abonné retiré.');
});

add_action('admin_post_tatos_newsletter_send', function () {
    tatos_guard();
    $test = ($_POST['mode'] ?? '') === 'test';
    $payload = ['subject' => tatos_post('subject'), 'text' => sanitize_textarea_field(wp_unslash($_POST['text'] ?? ''))];
    if ($test) {
        $payload['testEmail'] = sanitize_email(wp_unslash($_POST['testEmail'] ?? ''));
    }
    $res = tatos_site_request('POST', 'newsletter/send', $payload, 30);
    tatos_done($res, $test ? 'Aperçu envoyé à ' . ($payload['testEmail'] ?? '') . '.' : 'Envoi lancé vers ' . (int) ($res['data']['recipients'] ?? 0) . ' abonné(s).');
});

add_action('admin_post_tatos_newsletter_export', function () {
    tatos_guard();
    $res = tatos_site_request('GET', 'newsletter/export', null, 30);
    if (!$res['ok']) {
        wp_die(esc_html($res['error']));
    }
    nocache_headers();
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="newsletter-' . gmdate('Y-m-d') . '.csv"');
    echo $res['body']; // phpcs:ignore WordPress.Security.EscapeOutput -- fichier CSV
    exit;
});

/** Produits épuisés après des ventes, sauf ceux que le magasin a choisi de laisser épuisés. */
function tatos_sold_out(?array $stats = null): array
{
    $stats ??= tatos_stats();
    $ack = (array) get_option('tatos_soldout_ack', []);
    return array_values(array_filter((array) ($stats['outOfStock'] ?? []), fn($p) => !in_array($p['id'] ?? '', $ack, true)));
}

/* ------------------------------------------------------------------------------------------------
 * Alerte de rupture de stock, en haut de toutes les pages de l'administration
 * --------------------------------------------------------------------------------------------- */
add_action('admin_notices', function () {
    if (!current_user_can(tatos_shop_cap()) || (($_GET['page'] ?? '') === 'tatos-stock' && !empty($_GET['out']))) {
        return;
    }
    $sold = tatos_sold_out();
    $count = count($sold);
    if ($count < 1) {
        return;
    }
    $names = array_map(fn($p) => trim(($p['marque'] ?? '') . ' ' . ($p['titre'] ?? '')), array_slice($sold, 0, 3));
    printf(
        '<div class="notice notice-warning"><p><strong>Rupture de stock : %d produit(s) épuisé(s)</strong>%s. Indiquez le nouveau stock s\'il vous en reste, ou cliquez sur « Laisser épuisé ». <a class="button button-small" href="%s">Voir les produits épuisés</a></p></div>',
        $count,
        $names ? ' — ' . esc_html(implode(', ', $names)) . ($count > count($names) ? '…' : '') : '',
        esc_url(tatos_admin_link('tatos-stock', ['out' => '1']))
    );
});
