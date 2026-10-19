<?php
/**
 * Aide intégrée à l'administration : guide d'utilisation (toute l'équipe) et documentation
 * technique (administrateurs), lus depuis les fichiers Markdown du dossier docs/ de l'extension
 * (copiés depuis docs/ du projet par `npm run docs:plugin`).
 */

if (!defined('ABSPATH')) {
    exit;
}

const TATOS_DOCS = [
    'guide-utilisation' => "Guide d'utilisation",
    'architecture' => 'Architecture',
    'installation-deploiement' => 'Installation et mise en ligne',
    'configuration' => 'Configuration',
    'api' => 'API du site',
    'wordpress' => 'Extension WordPress',
    'tests' => 'Tests et audits',
    'credits' => 'Crédits des images',
];

function tatos_docs_dir(): string
{
    return dirname(__DIR__) . '/docs/';
}

// Guide : dans « Boutique » pour les gestionnaires, dans « Tableau de bord » pour les rédacteurs.
add_action('admin_menu', function () {
    $guide = fn() => tatos_page_doc('guide-utilisation', 'tatos-guide');
    if (current_user_can(tatos_shop_cap())) {
        add_submenu_page('tatos-boutique', "Guide d'utilisation", "Guide d'utilisation", 'edit_posts', 'tatos-guide', $guide);
    } else {
        add_dashboard_page("Guide d'utilisation", "Guide d'utilisation", 'edit_posts', 'tatos-guide', $guide);
    }
    add_submenu_page('tatos-boutique', 'Documentation technique', 'Documentation technique', 'manage_options', 'tatos-docs', function () {
        $doc = sanitize_key(wp_unslash($_GET['doc'] ?? 'architecture'));
        tatos_page_doc(isset(TATOS_DOCS[$doc]) && $doc !== 'guide-utilisation' ? $doc : 'architecture', 'tatos-docs');
    });
}, 20);

/** Lien d'administration vers un document (et une ancre). */
function tatos_doc_link(string $doc, string $anchor = ''): string
{
    $guide = current_user_can(tatos_shop_cap()) ? 'admin.php?page=tatos-guide' : 'index.php?page=tatos-guide';
    $url = $doc === 'guide-utilisation' ? admin_url($guide) : add_query_arg(['page' => 'tatos-docs', 'doc' => $doc], admin_url('admin.php'));
    return $url . ($anchor !== '' ? '#' . $anchor : '');
}

function tatos_page_doc(string $doc, string $page): void
{
    $file = tatos_docs_dir() . $doc . '.md';
    echo '<div class="wrap tatos-wrap tatos-doc-wrap">';
    if ($page === 'tatos-docs') {
        echo '<nav class="nav-tab-wrapper tatos-doc-tabs">';
        foreach (TATOS_DOCS as $key => $label) {
            if ($key === 'guide-utilisation') {
                continue;
            }
            printf('<a class="nav-tab%s" href="%s">%s</a>', $key === $doc ? ' nav-tab-active' : '', esc_url(tatos_doc_link($key)), esc_html($label));
        }
        echo '</nav>';
    }
    if (!is_readable($file)) {
        echo '<h1>' . esc_html(TATOS_DOCS[$doc]) . '</h1><div class="notice notice-error"><p>Le document est introuvable dans l\'extension (dossier docs/). Recopiez la documentation avec <code>npm run docs:plugin</code>.</p></div></div>';
        return;
    }
    $html = tatos_markdown((string) file_get_contents($file));
    // Sommaire : titres de niveau 2.
    preg_match_all('#<h2 id="([^"]+)">(.*?)</h2>#', $html, $m, PREG_SET_ORDER);
    echo '<div class="tatos-doc">';
    if (count($m) > 2) {
        echo '<aside class="tatos-doc-toc"><p class="tatos-doc-toc-title">Sommaire</p><ol>';
        foreach ($m as [, $id, $title]) {
            printf('<li><a href="#%s">%s</a></li>', esc_attr($id), wp_kses_post($title));
        }
        echo '</ol></aside>';
    }
    echo '<article class="tatos-doc-body">' . $html . '</article></div></div>';
}

/* ------------------------------------------------------------------------------------------------
 * Markdown → HTML (sous-ensemble utilisé par la documentation : titres, paragraphes, listes
 * imbriquées, tableaux, citations, blocs de code, images, liens, gras, italique, code).
 * --------------------------------------------------------------------------------------------- */
function tatos_md_slug(string $text): string
{
    $slug = remove_accents(wp_strip_all_tags(html_entity_decode($text, ENT_QUOTES, 'UTF-8')));
    return trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($slug)), '-');
}

function tatos_md_url(string $url): string
{
    if (preg_match('#^(https?:|mailto:|tel:|\#)#', $url)) {
        return $url;
    }
    // Lien vers un autre document : page d'aide correspondante.
    if (preg_match('#^(?:\./)?([a-z0-9-]+)\.md(?:\#(.+))?$#', $url, $m) && isset(TATOS_DOCS[$m[1]])) {
        return tatos_doc_link($m[1], $m[2] ?? '');
    }
    // Image ou fichier du dossier docs/ de l'extension.
    return plugin_dir_url(__DIR__) . 'docs/' . ltrim(preg_replace('#^\./#', '', $url), '/');
}

function tatos_md_inline(string $text): string
{
    $codes = [];
    $text = preg_replace_callback('/`([^`]+)`/', function ($m) use (&$codes) {
        $codes[] = '<code>' . esc_html($m[1]) . '</code>';
        return "\x01" . (count($codes) - 1) . "\x02";
    }, $text);
    $text = esc_html($text);
    $text = preg_replace_callback('/!\[([^\]]*)\]\(([^)\s]+)\)/', fn($m) => '<img src="' . esc_url(tatos_md_url(html_entity_decode($m[2]))) . '" alt="' . esc_attr(html_entity_decode($m[1])) . '" loading="lazy">', $text);
    $text = preg_replace_callback('/\[([^\]]+)\]\(([^)\s]+)\)/', function ($m) {
        $url = tatos_md_url(html_entity_decode($m[2]));
        $external = preg_match('#^https?:#', $url) && !str_starts_with($url, admin_url()) && !str_starts_with($url, plugin_dir_url(__DIR__));
        return '<a href="' . esc_url($url) . '"' . ($external ? ' target="_blank" rel="noopener"' : '') . '>' . $m[1] . ($external ? ' ↗' : '') . '</a>';
    }, $text);
    $text = preg_replace('/\*\*(.+?)\*\*/', '<strong>$1</strong>', $text);
    $text = preg_replace('/(?<![\w*])\*(?!\s)(.+?)(?<!\s)\*(?![\w*])/', '<em>$1</em>', $text);
    return preg_replace_callback("/\x01(\d+)\x02/", fn($m) => $codes[(int) $m[1]], $text);
}

/** Liste (imbriquée selon l'indentation) à partir des lignes d'un bloc de liste. */
function tatos_md_list(array $lines, int &$i, int $indent): string
{
    $ordered = (bool) preg_match('/^\s*\d+\.\s/', $lines[$i]);
    $html = $ordered ? '<ol>' : '<ul>';
    $text = null; // texte de l'élément en cours (lignes de suite comprises), converti en une fois
    $flush = function () use (&$text, &$html) {
        if ($text !== null) {
            $html .= tatos_md_inline($text);
            $text = '';
        }
    };
    $open = false;
    while ($i < count($lines)) {
        $line = $lines[$i];
        if (!preg_match('/^(\s*)([-*]|\d+\.)\s+(.*)$/', $line, $m)) {
            // Suite du texte de l'élément précédent.
            if ($open && trim($line) !== '' && strlen($line) - strlen(ltrim($line)) > $indent) {
                $text .= ' ' . trim($line);
                $i++;
                continue;
            }
            break;
        }
        $level = strlen($m[1]);
        if ($level > $indent) {
            $flush();
            $html .= tatos_md_list($lines, $i, $level);
            continue;
        }
        if ($level < $indent) {
            break;
        }
        $flush();
        $html .= ($open ? '</li>' : '') . '<li>';
        $text = $m[3];
        $open = true;
        $i++;
    }
    $flush();
    return $html . ($open ? '</li>' : '') . ($ordered ? '</ol>' : '</ul>');
}

function tatos_md_cells(string $row): array
{
    return array_map('trim', explode('|', trim(trim($row), '|')));
}

function tatos_markdown(string $md): string
{
    $lines = preg_split('/\R/', str_replace("\t", '    ', $md));
    $html = '';
    $n = count($lines);
    for ($i = 0; $i < $n;) {
        $line = $lines[$i];
        $trim = trim($line);
        if ($trim === '') {
            $i++;
            continue;
        }
        if (str_starts_with($trim, '```')) {
            $code = [];
            for ($i++; $i < $n && !str_starts_with(trim($lines[$i]), '```'); $i++) {
                $code[] = $lines[$i];
            }
            $i++;
            $html .= '<pre><code>' . esc_html(implode("\n", $code)) . '</code></pre>';
            continue;
        }
        if (preg_match('/^(#{1,4})\s+(.*)$/', $trim, $m)) {
            $level = strlen($m[1]);
            $html .= sprintf('<h%1$d id="%2$s">%3$s</h%1$d>', $level, esc_attr(tatos_md_slug($m[2])), tatos_md_inline($m[2]));
            $i++;
            continue;
        }
        if (preg_match('/^(-{3,}|\*{3,})$/', $trim)) {
            $html .= '<hr>';
            $i++;
            continue;
        }
        if (str_starts_with($trim, '|') && isset($lines[$i + 1]) && preg_match('/^\|?\s*:?-{3,}/', trim($lines[$i + 1]))) {
            $head = tatos_md_cells($trim);
            $html .= '<div class="tatos-doc-table"><table class="widefat striped"><thead><tr>' . implode('', array_map(fn($c) => '<th>' . tatos_md_inline($c) . '</th>', $head)) . '</tr></thead><tbody>';
            for ($i += 2; $i < $n && str_starts_with(trim($lines[$i]), '|'); $i++) {
                $html .= '<tr>' . implode('', array_map(fn($c) => '<td>' . tatos_md_inline($c) . '</td>', tatos_md_cells($lines[$i]))) . '</tr>';
            }
            $html .= '</tbody></table></div>';
            continue;
        }
        if (str_starts_with($trim, '>')) {
            $quote = [];
            for (; $i < $n && str_starts_with(trim($lines[$i]), '>'); $i++) {
                $quote[] = ltrim(substr(trim($lines[$i]), 1));
            }
            $html .= '<blockquote>' . tatos_markdown(implode("\n", $quote)) . '</blockquote>';
            continue;
        }
        if (preg_match('/^(\s*)([-*]|\d+\.)\s+/', $line, $m)) {
            $html .= tatos_md_list($lines, $i, strlen($m[1]));
            continue;
        }
        $para = [];
        for (; $i < $n && trim($lines[$i]) !== '' && !preg_match('/^(#{1,4}\s|```|>|\||(\s*)([-*]|\d+\.)\s)/', trim($lines[$i])); $i++) {
            $para[] = trim($lines[$i]);
        }
        if (!$para) {
            // Ligne isolée non reconnue : affichée telle quelle.
            $para[] = $trim;
            $i++;
        }
        $html .= '<p>' . tatos_md_inline(implode(' ', $para)) . '</p>';
    }
    return $html;
}
