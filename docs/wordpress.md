# Extension WordPress « Destocktatos — Administration du site » (dossier tatos-headless)

L'extension (`wordpress/plugins/tatos-headless`, version 2.1) transforme WordPress en administration
complète du site : contenus, catalogue et gestion de la boutique. Le site public de WordPress n'est pas
utilisé : toute visite y est redirigée vers le site Next.js.

## Fichiers

| Fichier | Contenu |
| --- | --- |
| `tatos-headless.php` | Types de contenu (`produit`, `faq`), taxonomies (`categorie_produit`, `faq_categorie`), métadonnées exposées en REST, réglages **Site et magasin**, routes REST `tatos/v1`, webhook vers le site. |
| `includes/site-api.php` | Appels à l'API d'administration du site (`tatos_site_request`), adresse publique d'un contenu, rôle **Gestionnaire de boutique**. |
| `includes/editors.php` | Écrans d'édition : fiche produit structurée et stock en direct, champs des catégories, éditeur structuré des pages (`tatos_data`), liens « Voir sur le site ↗ », barre d'administration, menus retirés. |
| `includes/admin-shop.php` | Rubrique **Boutique** : tableau de bord, commandes, clients, stock, codes promo, avis, messages, newsletter, widget d'accueil ; actions `admin-post.php` protégées par nonce et capacité. |
| `includes/admin-help.php` | **Guide d'utilisation** et **Documentation technique** dans l'administration (rendu Markdown des fichiers `docs/` de l'extension). |
| `includes/importer.php` | Import des contenus (`tatos_import`), partagé par WP-CLI et par le bouton **Importer les contenus du site** des réglages (import par étapes via `admin-ajax`, données lues sur `/api/admin/export`). |
| `includes/class-tatos-cli.php` | Commande WP-CLI `wp tatos import`. |
| `assets/admin.css`, `assets/admin.js` | Styles et comportements de l'administration (médiathèque, listes répétables, confirmations). |
| `docs/` | Copie de la documentation du projet (`npm run docs:plugin`). |

## Contenus gérés

| Contenu WordPress | Sur le site |
| --- | --- |
| `produit` + métadonnées (marque, modèle, prix, promotion, stock, caractéristiques, garantie, images, étiquette énergie, vedette, référencement) | Fiches `/boutique/{slug}`, listes, recherche. |
| `categorie_produit` (+ ordre, image, description courte) | Rayons `/categorie/{slug}`, navigation. |
| `page` + `tatos_data` (JSON structuré), `tatos_meta_title`, `tatos_meta_description` | Accueil, services, à propos, contact, promotions, modèle de page catégorie ; pages légales (contenu HTML découpé en sections `<h2>`). |
| `post` (+ image à la une ou `tatos_image`, catégorie, extrait) | Rubrique « Conseils » `/conseils/{slug}`. |
| `faq` + `faq_categorie` (+ ordre) | Page `/faq`. |
| Menus `header`, `footer-legal` | En-tête et pied de page. |
| Réglages `tatos_settings` | Coordonnées, horaires, liaison. |

L'éditeur structuré des pages génère le formulaire à partir du JSON existant (`tatos_data`) : chaque
texte, image, lien ou liste du JSON devient un champ. Ajouter un nouveau bloc à une page passe donc par
le code du site (composant + données) puis l'import ou la saisie du JSON initial.

## Synchronisation avec le site

1. Un enregistrement dans WordPress déclenche `tatos_notify_frontend()` : requête POST vers l'URL du
   webhook avec l'en-tête `X-Tatos-Secret`.
2. Le site (`/api/webhooks/wordpress`) invalide ses caches de contenu et, pour un produit, relit
   `/wp-json/tatos/v1/products/{id}` et met à jour sa base (stock compris pour un nouveau produit).
3. Les écrans **Boutique** lisent et écrivent les données du site (commandes, clients, stock…) via
   `/api/admin/*` avec la clé d'administration ; les statistiques sont mises en cache 60 secondes.

| Événement | Déclencheur |
| --- | --- |
| `product.updated` / `product.deleted` | Enregistrement, mise à la corbeille ou suppression d'un produit. |
| `categories.updated` | Création, modification, suppression d'une catégorie de produits. |
| `content.updated` / `content.deleted` | Page, article, FAQ, catégorie d'article ou thème de FAQ. |
| `menu.updated` | Enregistrement d'un menu. |
| `settings.updated` | Enregistrement des réglages **Site et magasin**. |
| `sync.full` | Fin d'un import en masse (`wp tatos import`). |

## Commandes

| Commande | Effet |
| --- | --- |
| `wp tatos import <fichier.json> [--limit=<n>]` | Importe réglages, catégories, produits (avec les chemins de leurs images, servies par le site), pages, articles, FAQ et menus ; retire les contenus d'exemple de WordPress. Rejouable sans doublon. |
| `npm run wp:export` | Génère `wordpress/export/wordpress-import.json` depuis la base du site et `data/content`. |
| `npm run wp:sync` | Recopie toutes les catégories et produits WordPress dans la base du site. |
| `npm run wp:check` | Compare champ par champ l'API WordPress et les données du site. |
| `npm run docs:plugin` | Copie la documentation (`docs/*.md`, `docs/img/`) dans l'extension. |

## Administration : ergonomie

- Liens vers le site public : libellés « ↗ », ouverture dans un nouvel onglet (listes, barre
  d'administration, messages d'enregistrement, permalien).
- Retirés car sans effet sur le site : éditeur de site et polices du thème, commentaires, étiquettes
  d'articles, aperçu du thème pour les produits et les pages structurées, contenus d'exemple.
- Barre d'administration : nom du site (ouvre le site), **Guide d'utilisation**.
- Rubrique **Boutique** : pastille du nombre de commandes et messages à traiter.

## Sécurité

- Toutes les actions de la Boutique passent par `admin-post.php` avec nonce (`tatos_shop_action`) et
  capacité (`tatos_manage_shop`).
- Les secrets (clé d'administration, secret du webhook) ne sont jamais renvoyés par l'API REST
  publique (`/tatos/v1/settings` les retire) et sont masqués dans le formulaire.
- Les sorties HTML sont échappées (`esc_html`, `esc_attr`, `esc_url`) ; le contenu Markdown de l'aide
  provient uniquement des fichiers de l'extension.

## Installer sur un WordPress existant

Voir [Installation et mise en ligne](installation-deploiement.md), section « WordPress ». L'extension
fonctionne avec n'importe quel thème (il n'est jamais affiché) ; PHP 8.1 minimum.
