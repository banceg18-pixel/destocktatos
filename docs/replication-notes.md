# Notes de réplication

Ce document décrit comment le site d'origine (`https://www.tatosatout.fr/`, audité en octobre 2026) a
été reproduit, ce qui est identique, ce qui diffère volontairement, ce qui n'a pas pu l'être et ce qui
n'a pas pu être vérifié. Il fait foi avec le manifeste [`assets-manifest.csv`](assets-manifest.csv)
et le [plan du site](site-map.md).

## 1. Méthode

- **Inventaire** : `sitemap.xml`, liens internes de chaque page, routes trouvées dans les bundles
  JavaScript, requêtes directes sur les routes candidates (ex. `/compte/commandes` : 200,
  `/commandes` : 404).
- **Contenu et structure** : le site d'origine est une application Next.js (App Router) ; le HTML
  serveur et la charge RSC de chaque page ont été analysés pour reconstruire l'arbre des composants,
  les chaînes de classes Tailwind (reprises à l'identique, donc CSS identique) et les textes.
- **Règles métier** : extraites des bundles (grille de livraison, frais d'étage, coordonnées du
  magasin, plafonnement des coupons, persistance du panier soumise au consentement, tri et pagination
  de la boutique, recherche insensible aux accents…), puis réimplémentées côté serveur.
- **Données** : catalogue complet (16 catégories, 581 produits avec caractéristiques, garanties,
  couleurs, images, étiquettes énergie, métadonnées SEO), contenus éditoriaux et FAQ.
- **Vérification visuelle** : captures pleine page source / réplique côte à côte (1440 px pour toutes
  les pages, 390 px pour les pages principales), hauteurs de page comparées.

## 2. Architecture

| Couche | Choix |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 (mêmes classes que l'origine), Swiper, react-icons |
| Polices | Lexend, Playfair Display, Montserrat : fichiers woff2 d'origine auto-hébergés |
| Contenus | Fournisseur interchangeable : `local` (`data/content/*.json`) ou `wordpress` (REST du plugin TATOS Headless, cache ISR invalidé par webhook, repli local) |
| API | Route handlers `/api/*`, validation zod, erreurs JSON homogènes sans détail technique |
| Données | Prisma ; SQLite en local (PostgreSQL/MySQL possibles) ; montants en centimes entiers |
| Auth | NextAuth (JWT) : email + mot de passe (bcrypt, coût 12), Google en option ; middleware sur `/compte`, `/paiement` |
| Paiement | Stripe (PaymentElement + AddressElement, vérification serveur, webhook signé) ou mode test explicite |
| Emails | Abstraction `sendMail` ; sans fournisseur, fichiers JSON dans `outbox/` |

La base locale est la source de vérité commerciale (prix facturés, stock réservé, commandes) ;
WordPress est la source éditoriale (textes, fiches produit, menus, FAQ, réglages).

## 3. Assets

Bilan de `npm run audit:assets` (et du manifeste) :

| Élément | Nombre |
| --- | ---: |
| Entrées du manifeste | 1 723 |
| Fichiers téléchargés et vérifiés (taille + SHA-256) | 1 591 |
| Doublons détectés et dédupliqués (même empreinte, fichier réutilisé) | 126 |
| Échecs de téléchargement (404 sur le site d'origine lui-même) | 6 |
| Références locales (code, contenus, base) | 1 592 chemins distincts, 0 cassé |
| Fichiers de `public/assets` hors manifeste | 0 |
| Images avec métadonnées EXIF / avec coordonnées GPS | 57 / 0 (contrôle double : script + Pillow) |

- Les 6 échecs (5 images produit Cloudinary et `elements/pattern-dots.png`) renvoient 404 sur le site
  d'origine : ils n'y étaient déjà pas affichés. Ils ne sont référencés nulle part dans la réplique ;
  le motif de fond correspondant est simplement absent, comme sur l'origine.
- Les images sont conservées telles quelles (pas de recompression, filigranes et métadonnées de
  licence des SVG intacts). Les noms de fichiers sont lisibles (`marque-modele-principale.webp`,
  `-detail-NN`, `-etiquette-energie`) ; la provenance de chaque fichier est dans le manifeste.
- Une police avait été enregistrée sous deux noms (même empreinte) : le doublon inutilisé a été supprimé
  et le manifeste pointe vers le fichier réellement servi.

## 4. Particularités du site d'origine conservées

Reproduites à l'identique par fidélité (corrigeables en une ligne si souhaité) :

- Titre des pages catégorie avec suffixe doublé : « Réfrigérateur | TATOS | TATOS ».
- URL canonique `/` sur la plupart des pages.
- Lien de l'accueil vers `/boutique?categorie=réfrigerateur` (faute de frappe : 0 résultat).
- Coquilles de contenu : « dimanchd », email `contact@exemple.fr` dans la FAQ, téléphone `0123456789`
  dans les CGV.
- « Dernière mise à jour » des pages légales = date du jour.
- Produit ou catégorie inconnus : réponse 200 (« soft 404 ») ; produit inconnu en `noindex`, titre
  « Produit | TATOS ». Seules les routes inexistantes renvoient 404, comme à l'origine.
- Avis : les 4 notes publiques d'origine (5/5, sans commentaire) sont importées sous des comptes
  anonymisés « Client vérifié » ; aucune donnée personnelle n'est reprise.

## 5. Écarts volontaires (corrections et durcissements)

- **Sécurité des commandes** : le total, le stock, le coupon et la distance de livraison sont
  recalculés côté serveur (la source faisait confiance au navigateur) ; réservation atomique du stock,
  expiration des commandes impayées après 30 min, paiement idempotent, coupon consommé une seule fois.
- **Paiement** : sans clés Stripe, mode test affiché comme tel et tracé (`paymentMode = "test"`), jamais
  présenté comme un vrai paiement.
- **Analytics** : Google Analytics chargé uniquement si `NEXT_PUBLIC_GA_ID` est défini **et** après
  consentement (la source le chargeait d'emblée).
- **Boutons inertes de l'origine** reliés à leur destination ; bouton Google affichant un message
  explicite si la connexion Google n'est pas configurée.
- **Filtres de la boutique** reflétés dans l'URL (partage, retour arrière).
- **SEO** : positions du fil d'Ariane JSON-LD corrigées ; balise de vérification Google et méta
  `author` personnelle retirées du code (vérification configurable par variable d'environnement).
- **Accessibilité** : bouton de menu mobile réel (clavier, lecteur d'écran), listes déroulantes avec
  `aria-controls`/`aria-activedescendant`, icône « afficher le mot de passe » utilisable au clavier.
  Aucun changement visuel.
- **Mot de passe oublié** : jeton aléatoire stocké haché, valable 1 h, usage unique, réponse identique
  que le compte existe ou non.
- **Pièces jointes** : type vérifié par signature binaire, nom aléatoire, 3 fichiers / 5 Mo maximum.
- **Panier** : les articles transportent leur poids, pour des frais d'étage exacts.

## 6. Écarts non maîtrisables

- **Données vivantes** : le catalogue est un instantané de l'audit. Le stock et les indicateurs de
  visibilité de l'origine évoluent ; quelques produits listés par catégorie ou en suggestion peuvent
  donc différer de ceux visibles aujourd'hui sur l'origine. Mesure au 18/10/2026 : la catégorie
  réfrigérateur liste 64 produits dans la réplique contre 60 sur l'origine (4 produits épuisés depuis
  l'instantané, aucun produit manquant), soit +2 088 px de hauteur à 390 px. Les 10 autres pages
  comparées à 390 px (accueil, boutique, promotions, services, contact, à propos, FAQ, CGV, connexion,
  panier) ont une hauteur identique au pixel près ; la fiche produit comparée est identique jusqu'au
  bloc « Produits recommandés », dont le premier produit diffère (−27 px, cf. ci-dessous).
- **Suggestions** : même catégorie, produits en stock ; l'ordre exact de l'origine (calculé par son
  backend) n'est pas observable, il est approché (ordre de création).
- **Animations** : mêmes effets (apparition au défilement, carrousels Swiper) ; la temporisation exacte
  des carrousels peut différer de quelques centaines de millisecondes.

## 7. Exceptions externes

Aucune requête vers le domaine d'origine ni vers son CDN d'images : 0 occurrence dans le code, les
données et le build (`npm run audit:source-refs`), 0 requête mesurée par les tests de bout en bout.
Seuls ces services tiers peuvent être contactés :

| Service | Quand | Pourquoi |
| --- | --- | --- |
| Google Maps (iframe : `www.google.com`, `maps.googleapis.com`, `maps.gstatic.com`, `fonts.googleapis.com`) | Pages Contact et Services | Carte d'accès du magasin, comme à l'origine |
| Base Adresse Nationale (`api-adresse.data.gouv.fr`) | Saisie d'adresse, création de commande | Autocomplétion et géocodage (calcul de distance de livraison) |
| Nominatim (`nominatim.openstreetmap.org`) | Si la BAN ne trouve pas l'adresse | Géocodage de secours (règle de l'origine) |
| Stripe | Uniquement avec des clés configurées | Paiement par carte |
| Google OAuth | Uniquement avec `GOOGLE_CLIENT_ID` | Connexion Google |
| Google Analytics | Uniquement avec `NEXT_PUBLIC_GA_ID` et après consentement | Mesure d'audience |

## 8. WordPress Headless : vérifications réelles

Testé sur un WordPress local réel (dernière version de wordpress.org, extension officielle SQLite
Database Integration, WP-CLI), installé par `wordpress/setup-local.sh` :

| Vérification | Résultat |
| --- | --- |
| Import (`wp tatos import`) | Réglages, menus, 16 catégories, 581 produits, 9 pages, 4 catégories de FAQ ; réimport idempotent |
| `npm run wp:check` (API WordPress vs données locales) | Réglages, menus, FAQ, 9 pages, 16 catégories, 581 produits × 25 champs : **0 écart** |
| `npm run wp:sync` sur une copie de la base | 16 catégories, 581 produits, 778 images : **identiques** à l'original |
| Rendu `CMS_PROVIDER=wordpress` vs `local` | 12 pages : mêmes textes et mêmes classes CSS |
| Webhook : modification d'un produit (titre, prix) | Produit resynchronisé seul (≈ 2 s) |
| Webhook : modification d'une FAQ | Cache invalidé, nouveau texte affiché |
| Webhook : produit dépublié | Stock local à 0, produit plus vendable, historique conservé |
| Webhook sans secret | 401 |

Défauts trouvés et corrigés pendant ces tests : antislashs du JSON supprimés par WordPress à
l'enregistrement (`wp_slash`), descriptions tronquées au premier « < » (« < 30 min »), slugs limités à
200 caractères par WordPress (slug complet conservé en méta), notification envoyée avant
l'enregistrement des métadonnées (`wp_after_insert_post` au lieu de `save_post`), 581 webhooks lors
d'un import (suspendus, un seul `sync.full` final), guillemets typographiques ajoutés par
`wptexturize` (titres bruts), attribut `data-cy` des menus perdu, synchronisation complète à chaque
enregistrement (remplacée par une synchronisation du seul produit modifié).

Non testé : WordPress sur MySQL/MariaDB (Docker n'était pas disponible) ; le plugin n'utilise que
des API WordPress standard, indépendantes du moteur de base.

## 9. Tests et contrôles

| Contrôle | Commande | Résultat |
| --- | --- | --- |
| Lint | `npm run lint` | 0 erreur, 0 avertissement |
| Types | `npm run typecheck` | 0 erreur |
| Unitaires + intégration (base dédiée, migrations rejouées à chaque exécution) | `npm test` | 78 / 78 |
| Références à la source | `npm run audit:source-refs` | 0 (≈ 2 000 fichiers, binaires, bases et build inclus) |
| Assets | `npm run audit:assets` | 0 référence cassée, 0 écart de manifeste, 0 GPS |
| Build de production | `npm run build` | OK — 23 pages (dont 2 dynamiques par produit / catégorie), 36 routes API, 47 sorties statiques |
| API + parcours + responsive (build de production, base dédiée) | `npm run test:e2e` | voir ci-dessous |

Couverture des tests unitaires et d'intégration : grille de livraison et ses bornes (20/40/60/80 km),
frais d'étage, reprise, distance ; montants ; validation (adresse, téléphone, mot de passe, avis,
commande, facturation) ; plafonnement des coupons ; facture PDF ; découpage des pages WordPress ;
limitation de débit ; devis serveur (promotions, quantités fusionnées, livraison, refus > 80 km et
> 60 km hors pied du camion, adresse introuvable, rupture) ; création de commande (réservation du stock,
total falsifié refusé sans effet de bord, annulation de la commande impayée précédente, deux clients
pour un dernier article) ; expiration à 30 min ; annulation ; isolation entre clients ; paiement
idempotent et coupon consommé une fois ; paiement tardif ; refus historisé ; coupons (inactif, expiré,
personnel, épuisé, minimum) ; avis réservés aux acheteurs ; carnet d'adresses (défaut unique,
promotion, 10 maximum, isolation) ; inscription (bcrypt, doublon, confirmation, JSON invalide,
limitation à 10 essais) ; réinitialisation (pas d'énumération, jeton haché, usage unique, expiration).

### Tests de bout en bout (`npm run test:e2e`, dernière exécution complète : 21 / 21)

Build de production, base dédiée recréée à chaque exécution, Chromium.

| Groupe | Contenu | Résultat |
| --- | --- | --- |
| API | Catalogue (pagination 12/page, tri, filtres, recherche, vedettes, suggestions) ; SEO, en-têtes de sécurité, 404 ; 401 sans session et redirection du middleware ; contact, devis d'installation, newsletter (doublon 409), ticket avec image (fichier déguisé refusé) ; profil et adresses (isolation entre clients) ; commande (total falsifié 409), paiement test refusé puis accepté, double paiement refusé, facture PDF, avis réservé aux acheteurs, coupon | 6 / 6 |
| Compte | Inscription (erreur de confirmation), mauvais / bon mot de passe, page protégée ; mot de passe oublié (email dans l'outbox, lien à usage unique, connexion avec le nouveau mot de passe) | 2 / 2 |
| Achat | Retrait en magasin : panier → commande → paiement refusé puis accepté → confirmation → historique « Payée » → facture → panier vidé ; livraison : autocomplétion BAN, distance calculée par le serveur, options 0-20 km, installation + 4e étage = 55 € ; persistance du panier selon le consentement | 3 / 3 |
| Navigation | Recherche avec suggestions, filtre catégorie, pagination, fiche produit | 1 / 1 |
| Formulaires (interface) | Contact, newsletter, signalement de bug avec capture d'écran | 1 / 1 |
| Responsive | 8 tailles (1440, 1280, 1024, tablette 768 portrait et 1024 paysage, mobile 430, 390, 375) × 16 pages = 128 chargements : HTTP 200, aucun débordement horizontal, menu mobile ou navigation desktop fonctionnels, aucune erreur console ; captures dans `test-results/e2e/responsive/` | 8 / 8 |

Réseau mesuré pendant la série : **0 requête vers le site d'origine** ; hôtes tiers contactés :
`api-adresse.data.gouv.fr` (livraison) et Google Maps (iframe des pages Contact et Services :
`www.google.com`, `maps.googleapis.com`, `maps.gstatic.com`, `fonts.googleapis.com`). Aucune requête
Stripe ni Google Analytics sans clés configurées.

### Défauts de l'application trouvés par les tests et corrigés

- **Session côté navigateur jamais chargée** : `SessionProvider` recevait `session={null}`, ce qui
  empêche next-auth de lire la session au montage ; après tout chargement complet de page, un client
  connecté apparaissait déconnecté (en-tête « Connexion », adresse non enregistrable, caisse bloquée).
  Corrigé : la session est lue côté client, les pages restent statiques.
- **Stripe.js chargé sans clé** : l'import de `@stripe/stripe-js` injectait le script Stripe sur la page
  de paiement même en mode test. Corrigé (entrée `pure`, chargement uniquement avec une clé).
- **Accessibilité** : deux groupes de boutons radio portaient le même nom (« Mode de livraison ») ;
  menu mobile et icône « afficher le mot de passe » non utilisables au clavier ; listes déroulantes sans
  `aria-controls`. Corrigés sans changement visuel.
- **Méta-données** : titre d'un produit inconnu aligné sur l'origine ; variables d'environnement
  documentées mais jamais lues retirées de `.env.example`, variables lues mais non documentées ajoutées.

## 10. Points non vérifiables ou non vérifiés

- **Paiement Stripe réel** : aucune clé Stripe n'était disponible ; le parcours a été testé en mode
  test interne. Le code Stripe (PaymentElement, confirmation serveur, webhook signé) est en place mais
  n'a pas été exécuté de bout en bout. À valider avec des clés `sk_test_` / `pk_test_` et la CLI Stripe.
- **Connexion Google** : non testée (identifiants OAuth requis).
- **Envoi d'emails** : aucun fournisseur configuré ; les messages sont écrits et vérifiés dans
  `outbox/`, pas réellement envoyés.
- **Google Analytics** : non testé (identifiant requis) ; le chargement conditionnel est vérifié
  (aucune requête Google Analytics pendant les tests).
- **WordPress sur MySQL** : testé sur SQLite uniquement (cf. § 8).
- **Hébergement de production** (HTTPS, proxy inverse, plusieurs instances) : non testé ; exigences
  décrites dans le README.
- **Navigateurs** : tests automatisés sous Chromium uniquement (Firefox et Safari non testés).
- **Fidélité visuelle** : vérifiée par captures à 1440 px (toutes les pages) et 390 px (pages
  principales) ; les autres largeurs sont couvertes par les contrôles responsive automatiques
  (débordement, menu, erreurs), pas par une comparaison pixel avec l'origine.

## 11. Refonte (nouvelle identité, octobre 2026)

Le site ne reproduit plus l'apparence de l'origine : toute l'interface a été redessinée dans un
univers éditorial monochrome (grands titres en Archivo élargi, grilles à filets fins, bandeau
défilant, apparitions au défilement, tiroirs latéraux). Le design est original : aucun texte, image
ni nom n'est repris du site qui a servi d'inspiration. Les règles métier, l'API, la base et
l'intégration WordPress sont inchangées. Changements de comportement à connaître :

- **Panier** : toujours conservé sur l'appareil (localStorage), y compris si les cookies de mesure
  d'audience sont refusés ; le consentement ne concerne plus que la mesure d'audience.
- **CGV** : la case « J'accepte les CGV » du panier ne modifie plus le consentement cookies (bogue corrigé).
- **Vraie page 404** : plus d'écran de chargement global (`loading.tsx`), remplacé par une barre de
  progression ; les produits et catégories inconnus renvoient un statut HTTP 404.
- **Catalogue** : tri (récents, prix croissant/décroissant, remise), filtres dans l'URL (liens
  partageables), titres de produits sans répétition de la marque (`displayTitle`).
- **Contenus** : page Services réécrite avec des informations exactes (tarifs issus de la grille de
  livraison), libellés de statut de commande clarifiés.

## 12. Performances et tenue en charge

- **Catalogue en mémoire** (`src/lib/catalog/repository.ts`, `src/lib/server/memo.ts`) : les ~600
  produits sont lus en base au plus une fois par minute et partagés par toutes les requêtes ; une
  seule lecture à la fois même sous forte affluence, valeur précédente servie pendant le
  rafraîchissement ou si la base est momentanément indisponible. Commandes, avis et webhook
  WordPress invalident le cache. `CATALOG_CACHE_TTL_MS=0` le désactive.
- **Fiches produit pré-rendues** (ISR, 60 s) au lieu d'un rendu serveur à chaque visite : elles
  sont servies depuis le cache et préchargées par les liens, d'où une navigation instantanée. Le
  stock affiché peut avoir jusqu'à environ une minute de retard ; il est toujours revérifié à la commande.
- **API publiques du catalogue** : en-têtes `Cache-Control` (30 s navigateur, 60 s CDN, 5 min en
  rafraîchissement) ; images de `/assets` mises en cache 7 jours ; variantes d'images optimisées
  gardées 30 jours, 1920 px maximum.
- **Polices** : sous-ensemble latin seulement, police mono non préchargée.
- **Accueil** : seul le premier visuel du carrousel est chargé avec la page ; les suivants le sont
  ensuite, et le défilement attend que le visuel suivant soit prêt.
- **Réseau lent ou coupé** (`src/services/http.ts`) : délai maximal par requête (20 s, 45 s pour
  commande et paiement), relance automatique des lectures (coupure, 502/503/504), jamais des
  écritures ; bandeau « Hors connexion » ; pages d'erreur avec bouton « Réessayer »
  (`app/error.tsx`, `app/global-error.tsx`) ; la barre de navigation ne reste jamais figée.
- **Base SQLite** : journal WAL activé au démarrage (les lectures ne sont plus bloquées par une
  écriture). Limiteur de débit à mémoire bornée.
- **Limites** : cache et limiteur sont propres à chaque processus. En multi-instance, prévoir un
  stockage partagé (Redis) et une base PostgreSQL/MySQL plutôt que SQLite.
- **Hydratation sous forte charge** : une erreur React #418 apparaissait sur environ 5 % des premiers
  chargements quand serveur et navigateur étaient saturés. Cause : des mises à jour d'état faites au
  montage (panier, consentement) interrompaient l'hydratation. Elles passent désormais en transition
  (`CartProvider`), et la barre de navigation n'utilise plus `useSearchParams`. Résultat : 0 erreur sur
  87 chargements dans les mêmes conditions de charge.

## 13. Fonctionnalités complétées et administration WordPress

Audit de toutes les fonctionnalités du site (octobre 2026). Ce qui n'existait pas ou ne fonctionnait
qu'à moitié, et ce qui a été fait :

| Constat | Mise en place |
| --- | --- |
| Aucun email réellement envoyé (fichiers `outbox/` seulement), pas de confirmation de commande ni de suivi | Envoi SMTP (`src/lib/server/mailer.ts`, repli sur `outbox/` sans configuration ou en cas d'échec), confirmation de commande au client et au magasin (une seule fois même si Stripe confirme deux fois), emails de statut, bienvenue, réponse directe au client (`Reply-To`) |
| « Désinscription en un clic » annoncée mais inexistante | Lien signé (HMAC) dans chaque email, page `/newsletter/desinscription`, en-tête `List-Unsubscribe` |
| Pas de profil client | `/compte/profil` : nom, mot de passe (création pour un compte Google), suppression du compte (anonymisation, commandes conservées, stock des commandes non payées remis en vente) |
| Pas d'articles | Rubrique `/conseils` (liste, article, données structurées, plan du site), alimentée par les articles WordPress ; HTML assaini avant affichage |
| Aucune gestion des commandes, clients, codes promo, avis, messages, newsletter, stock | API `/api/admin/*` (clé `ADMIN_API_SECRET`, comparaison à temps constant, limitation des essais) et menu **Boutique** dans WordPress |
| Produits, catégories et pages éditables seulement en champs bruts ou JSON | Fiche produit structurée (stock réel du site affiché et modifiable), champs des catégories, éditeur structuré des contenus de page (listes réordonnables, médiathèque) avec mode JSON avancé |
| Site non relié à WordPress | `CMS_PROVIDER=wordpress`, webhook et clés configurés (`wordpress/configure-link.php`), contenus de la refonte et articles importés, administration en français, site public WordPress redirigé vers le site |

Vérifications : 91 tests unitaires et d'intégration (dont l'API d'administration, le profil, la
désinscription, la connexion Google), recette WordPress de bout en bout `tests/e2e/wordpress_admin.py`
(45 vérifications : accueil modifié et restauré, article publié puis supprimé, prix et stock, commande
payée puis suivie, facture, code promo utilisable, réponse à un message, newsletter et désinscription).

Restent à fournir par l'exploitant : identifiants SMTP, clés Stripe live, identifiants Google OAuth,
hébergement de production de WordPress (MySQL) et du site.

## 14. Ajustements d'interface et correctif d'hydratation

- **Interface** : plus de surtitres (« Espace client », « Services »…), d'étiquettes décoratives ni de
  fil d'Ariane ; pied de page sans grand nom, tenant toujours sur la hauteur d'un écran (vérifié de
  360 × 740 à 1440 × 900) et masqué sur la connexion, l'inscription et le mot de passe oublié ; bouton
  Google toujours affiché (message clair tant que les identifiants Google ne sont pas configurés).
- **Erreurs de saisie** : règles communes (`src/lib/client/form-rules.ts`) et affichage champ par champ
  (`src/lib/client/use-field-errors.ts`) sur tous les formulaires : message précis sous le champ, à la
  sortie du champ et à l'envoi, effacé dès que la saisie est correcte, focus sur le premier champ fautif,
  erreurs du serveur rattachées à leur champ. Les formulaires d'accès envoient en POST.
- **Hydratation** : une erreur React #418 apparaissait au rechargement d'une page quand ses scripts
  étaient déjà en cache (préchargement des liens). Cause identifiée par instrumentation : React
  rejouait l'élément `<main>` après une mise en attente de son contenu et perdait sa position. Un
  composant transparent (`PageSlot`) entre `<main>` et la page supprime le problème (0 erreur sur
  45 rechargements ciblés, contre la plupart auparavant). Le défaut existait déjà, plus rarement.
- **Emails** : noms de fichiers uniques dans `outbox/` (deux emails écrits dans la même milliseconde
  s'écrasaient, défaut révélé par les tests).
