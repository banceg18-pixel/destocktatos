# Plan du site

Toutes les routes ci-dessous correspondent à des routes du site d'origine (relevées par son
`sitemap.xml`, les liens internes, les bundles JavaScript et des requêtes directes). Les chemins sont
conservés à l'identique ; aucun lien interne ne pointe vers le domaine d'origine.

Légende — **S** : page statique (générée au build, revalidée toutes les 5 min) ; **D** : rendu serveur
à la demande ; **🔒** : session requise (middleware → `/connexion?callbackUrl=…`).

## Pages publiques

| Route | Rendu | Contenu | Données |
| --- | --- | --- | --- |
| `/` | S | Accueil : carrousel des 3 derniers produits vedettes, 8 catégories × 4 produits, offres, « Pourquoi nous choisir » | CMS `accueil` + catalogue |
| `/boutique` | D | Catalogue en stock, 12 par page, filtres catégorie / sous-catégorie / prix / recherche / promotions (reflétés dans l'URL) | catalogue |
| `/boutique/[slug]` | D | Fiche produit : galerie, caractéristiques, garantie, étiquette énergie, avis, suggestions, ajout au panier | 581 fiches (346 en stock) |
| `/categorie/[slug]` | D | Page catégorie : description, produits, guide d'achat, FAQ | 16 catégories |
| `/promotions` | S | Vente flash, catégories, newsletter | CMS `promotions` |
| `/services` | S | Services (livraison, installation, reprise), demande de devis, plan d'accès | CMS `services` |
| `/contact` | S | Formulaire de contact, coordonnées, horaires, carte | CMS `contact` |
| `/a-propos` | S | Histoire, mission, engagements, valeurs | CMS `a-propos` |
| `/faq` | S | FAQ par catégories (JSON-LD `FAQPage`) | CMS FAQ |
| `/conseils`, `/conseils/[slug]` | S | Articles de conseils (liste et article) | CMS articles |
| `/newsletter/desinscription` | D | Désinscription en un clic (lien signé reçu par email) | API newsletter |
| `/cgv`, `/mentions-legales`, `/politique-confidentialite` | S | Pages légales (contenu d'origine, sections HTML) | CMS pages |
| `/signaler-bug` | S | Signalement de bug avec captures (3 images, 5 Mo) | API tickets |
| `/connexion`, `/inscription` | D | Connexion (email + mot de passe, Google si configuré), création de compte | NextAuth |
| `/connexion/mot-de-passe-oublie`, `/connexion/reinitialiser?token=` | S / D | Demande et utilisation d'un lien de réinitialisation (1 h, usage unique) | API auth |
| `/panier` | S | Panier : quantités, coupon, retrait magasin ou livraison (adresse, distance, options, étage, reprise), CGV | contexte panier + API |

## Pages client 🔒

| Route | Contenu |
| --- | --- |
| `/compte` | Tableau de bord : dernières commandes, adresses, coupons de fidélité |
| `/compte/profil` | Nom affiché, mot de passe, suppression du compte |
| `/compte/ajouter-adresse` | Ajout / modification d'adresse (autocomplétion BAN) |
| `/compte/commandes` | Historique, statuts, annulation d'une commande non réglée, factures PDF une fois la commande réglée |
| `/paiement` | Règlement de la commande en cours : carte (Stripe) et/ou virement bancaire avant livraison |
| `/confirmation` | Confirmation de commande (état lu en base, jamais dans l'URL) |

## Fichiers techniques

`/sitemap.xml` (pages + 581 fiches + 16 catégories), `/robots.txt` (exclut compte, panier, paiement,
API), `/manifest.webmanifest`, icônes locales.

## API (`/api/*`)

| Domaine | Endpoints |
| --- | --- |
| Catalogue | `GET produits` (pagination, filtres) · `GET produits/search` · `GET produits/vedettes` · `GET produits/suggestions` |
| Authentification | `…/auth/[...nextauth]` · `POST auth/register` · `POST auth/forgot-password` · `POST auth/reset-password` · `GET users/me` 🔒 |
| Adresses 🔒 | `GET/POST user/addresses` · `GET/PUT/DELETE user/addresses/[id]` · `PUT user/addresses/[id]/default` · `GET addresses/suggestions` · `POST addresses/validate` |
| Avis | `GET/POST avis` · `PUT/DELETE avis/[id]` 🔒 · `GET avis/verifier` |
| Commandes 🔒 | `POST orders/create` · `GET orders` · `GET orders/latest` · `GET orders/[id]` · `POST orders/[id]/cancel` · `GET orders/[id]/invoice` (PDF) · `GET orders/[id]/download-invoice` · `GET orders/[id]/view-invoice` |
| Paiement | `POST checkout/create-payment-intent` 🔒 · `POST checkout/confirm` 🔒 · `POST checkout/bank-transfer` 🔒 · `POST checkout/test-payment` 🔒 (tests automatisés uniquement) · `POST stripe/webhook` (signature Stripe) |
| Fidélité 🔒 | `POST loyalty/validate` |
| Formulaires | `POST contact` · `POST contact/services` · `POST newsletter/subscribe` · `POST tickets/images` · `POST tickets/create` |
| CMS | `POST webhooks/wordpress` (secret partagé) |
| Administration | `/api/admin/*` (clé d'administration) — voir [API du site](api.md) |

## Catégories (`/categorie/[slug]`)

| Slug | Libellé d'origine | Produits | En stock |
| --- | --- | ---: | ---: |
| `refrigerateur` | réfrigérateur | 113 | 64 |
| `congelateur` | congélateur | 23 | 16 |
| `lave-linge` | lave-linge | 139 | 78 |
| `seche-linge` | sèche-linge | 47 | 21 |
| `lave-vaisselle` | lave-vaisselle | 70 | 46 |
| `cuisiniere` | cuisinière | 34 | 18 |
| `four` | four | 37 | 19 |
| `plaque-de-cuisson` | plaque de cuisson | 13 | 13 |
| `micro-ondes` | micro-ondes | 24 | 16 |
| `hotte` | hotte | 8 | 7 |
| `aspirateur` | aspirateur | 14 | 9 |
| `climatiseur` | climatiseur | 1 | 1 |
| `autres` | autres | 19 | 19 |
| `robot-de-cuisine` | robot de cuisine | 6 | 5 |
| `plaque-a-gaz` | plaque à gaz | 2 | 2 |
| `television` | télévision | 31 | 12 |

Total : 581 produits (346 en stock, 77 en promotion, 117 vedettes). Les fiches des produits hors stock
restent accessibles par leur URL, comme sur le site d'origine, mais ne sont pas listées en boutique.
