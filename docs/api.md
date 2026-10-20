# API du site

Toutes les routes sont servies par Next.js sous `/api` (code : `src/app/api/**/route.ts`). Les
réponses sont en JSON ; les erreurs ont la forme `{ "error": "message en français", "details"?: … }`
avec un code HTTP explicite (400 données invalides, 401 non connecté, 403 interdit, 404 introuvable,
409 conflit d'état, 429 trop de requêtes).

Légende : 🔒 session client requise (cookie NextAuth) · 🔑 clé d'administration
(`Authorization: Bearer <ADMIN_API_SECRET>`) · ✍️ signature ou secret partagé.

## Catalogue

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/produits` | Produits en stock, paginés (`page`, `limit`), filtres `categorie`, `sousCategorie`, `prixMin`, `prixMax`, `promotions`, `recherche`, tri `tri` (`recent`, `prix-asc`, `prix-desc`, `remise`). |
| GET | `/api/produits/search` | Recherche plein texte (`q`, `limit`). |
| GET | `/api/produits/vedettes` | Produits vedettes (carrousel de l'accueil). |
| GET | `/api/produits/suggestions` | Produits proches d'un produit donné. |

## Comptes

| Méthode | Route | Description |
| --- | --- | --- |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth : connexion par identifiants (`email`, `mdp`) ou Google, session, déconnexion. |
| POST | `/api/auth/register` | Création de compte (`email`, `mdp`, `mdpv`, nom facultatif). |
| POST | `/api/auth/forgot-password` | Envoi d'un lien de réinitialisation (réponse identique que l'email existe ou non). |
| POST | `/api/auth/reset-password` | Nouveau mot de passe avec le jeton reçu (valable 1 h, usage unique). |
| GET 🔒 | `/api/users/me` | Profil du client connecté. |
| PATCH 🔒 | `/api/users/me` | Modification du profil. |
| DELETE 🔒 | `/api/users/me` | Suppression du compte (données personnelles effacées, commandes conservées anonymisées). |
| POST 🔒 | `/api/users/me/password` | Changement de mot de passe. |

## Adresses

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/addresses/suggestions` | Autocomplétion d'adresse (Base Adresse Nationale). |
| POST | `/api/addresses/validate` | Validation et géocodage d'une adresse, distance au magasin. |
| GET/POST 🔒 | `/api/user/addresses` | Adresses du client (la première devient l'adresse par défaut). |
| GET/PUT/DELETE 🔒 | `/api/user/addresses/[id]` | Lecture, modification, suppression. |
| PUT 🔒 | `/api/user/addresses/[id]/default` | Choix de l'adresse par défaut. |

## Commandes et paiement

| Méthode | Route | Description |
| --- | --- | --- |
| POST 🔒 | `/api/orders/create` | Crée la commande : recalcul serveur (prix, promotions, coupon, distance, frais), refus si le total envoyé diffère (409, total attendu dans `details`), réservation du stock 30 min. |
| GET 🔒 | `/api/orders` | Historique du client. |
| GET 🔒 | `/api/orders/latest` | Commande en attente de règlement. |
| GET 🔒 | `/api/orders/[id]` | Détail (statut, montants, livraison, `paymentProvider`, `paidAt`). |
| POST 🔒 | `/api/orders/[id]/cancel` | Annulation d'une commande non réglée (stock rendu). |
| GET 🔒 | `/api/orders/[id]/invoice` | Facture PDF (`?download=1` pour un téléchargement), disponible une fois la commande réglée. |
| GET 🔒 | `/api/orders/[id]/view-invoice`, `/download-invoice` | Liens vers la facture (format du site d'origine). |
| POST 🔒 | `/api/checkout/create-payment-intent` | Prépare le règlement : `{ provider: "stripe" \| "virement", clientSecret, bankTransfer }`. |
| POST 🔒 | `/api/checkout/confirm` | Vérifie auprès de Stripe un paiement par carte et marque la commande payée. |
| POST 🔒 | `/api/checkout/bank-transfer` | Confirme la commande avec règlement par virement bancaire avant livraison (`orderId`, `billingAddress`) : statut `EN_ATTENTE_VIREMENT`, facture PDF (coordonnées bancaires) envoyée par email. |
| POST 🔒 | `/api/checkout/test-payment` | Simulation réservée aux tests automatisés (`TEST_PAYMENTS=true`) ; 404 sinon. |
| POST ✍️ | `/api/stripe/webhook` | Événements Stripe signés (`payment_intent.succeeded`, `payment_intent.payment_failed`). |
| POST 🔒 | `/api/loyalty/validate` | Vérifie un code promo pour un montant (`couponCode`, `orderTotal`) et renvoie la réduction. |

## Avis

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/avis` | Avis d'un produit (`produit`). |
| POST 🔒 | `/api/avis` | Publie un avis (acheteurs uniquement, un par produit). |
| PUT/DELETE 🔒 | `/api/avis/[id]` | Modification ou suppression de son avis. |
| GET | `/api/avis/verifier` | Le visiteur peut-il noter ce produit (`produit`) ? Réponse négative sans session. |

## Formulaires

| Méthode | Route | Description |
| --- | --- | --- |
| POST | `/api/contact` | Message de contact (email au magasin). |
| POST | `/api/contact/services` | Demande de rendez-vous ou de devis. |
| POST | `/api/tickets/images` | Envoi des captures d'un signalement (3 images, 5 Mo chacune). |
| POST | `/api/tickets/create` | Signalement d'un problème. |
| POST | `/api/newsletter/subscribe` | Inscription à la newsletter. |
| POST | `/api/newsletter/unsubscribe` | Désinscription (`email` + jeton signé reçu par email). |

Les formulaires publics sont limités en débit par adresse IP (429 au-delà).

## Contenus

| Méthode | Route | Description |
| --- | --- | --- |
| POST ✍️ | `/api/webhooks/wordpress` | Événements WordPress (en-tête `X-Tatos-Secret`) : `content.updated`, `content.deleted`, `menu.updated`, `settings.updated`, `product.updated`, `product.deleted`, `categories.updated`, `sync.full`. Invalide les caches et synchronise le catalogue. |

## API d'administration 🔑

Utilisée par les écrans **Boutique** de WordPress (`wordpress/plugins/tatos-headless/includes/site-api.php`),
implémentée dans `src/lib/server/admin.ts`. Toutes les routes exigent l'en-tête
`Authorization: Bearer <ADMIN_API_SECRET>` (20 essais erronés par 10 minutes et par IP au plus).

| Méthode | Route | Description |
| --- | --- | --- |
| GET | `/api/admin/ping` | Test de liaison : `{ ok, site, smtp }`. |
| GET | `/api/admin/stats` | Indicateurs du tableau de bord (commandes par statut, chiffre d'affaires, à préparer, messages, clients, stock faible, avis, dernières commandes). |
| GET | `/api/admin/orders` | Liste paginée (`page`, `per`, `q`, `status` dont `A_TRAITER` = payées ou en préparation). |
| GET | `/api/admin/orders/[id]` | Détail complet (articles, paiements, client). |
| PATCH | `/api/admin/orders/[id]` | `{ status: "EN_PREPARATION" \| "EXPEDIEE" \| "LIVREE" \| "ANNULEE", notify }` ; email au client si `notify`. |
| GET | `/api/admin/orders/[id]/invoice` | Facture PDF. |
| GET | `/api/admin/customers`, `/api/admin/customers/[id]` | Clients, et fiche avec adresses et commandes. |
| GET, POST | `/api/admin/coupons` | Liste, création. |
| PUT, DELETE | `/api/admin/coupons/[id]` | Modification (dont désactivation), suppression. |
| GET | `/api/admin/reviews` · DELETE `/api/admin/reviews/[id]` | Avis et suppression. |
| GET | `/api/admin/messages?kind=contact\|services\|tickets` | Messages par boîte. |
| PATCH | `/api/admin/messages/[kind]/[id]` | Changement de statut. |
| POST | `/api/admin/messages/[kind]/[id]/reply` | Réponse par email au client. |
| GET | `/api/admin/newsletter` · `/api/admin/newsletter/export` (CSV) | Abonnés. |
| POST | `/api/admin/newsletter/send` | Envoi d'une lettre (`subject`, `text`, `testEmail` pour un aperçu). |
| DELETE | `/api/admin/newsletter/[id]` | Retrait d'un abonné. |
| GET | `/api/admin/products`, `/api/admin/products/[id]` | Stock réel et fiche côté site. |
| PATCH | `/api/admin/products/[id]` | Correction du stock. |

## Routes WordPress utilisées par le site

| Route | Contenu |
| --- | --- |
| `/wp-json/tatos/v1/settings` | Coordonnées publiques du magasin. |
| `/wp-json/tatos/v1/menus` | Menu principal et liens légaux. |
| `/wp-json/tatos/v1/pages/{slug}` | Page brute et ses données structurées (`tatos_data`). |
| `/wp-json/tatos/v1/faq` | FAQ par thème. |
| `/wp-json/tatos/v1/categories` | Catégories de produits (ordre, image, description). |
| `/wp-json/tatos/v1/products`, `/products/{id}` | Produits publiés (synchronisation). |
| `/wp-json/wp/v2/posts?_embed` | Articles « Conseils ». |
