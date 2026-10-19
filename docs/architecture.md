# Architecture

Vue d'ensemble technique de la plateforme : composants, données, flux principaux et règles de
sécurité. Pour l'installation, voir [Installation et mise en ligne](installation-deploiement.md) ;
pour les variables d'environnement, [Configuration](configuration.md).

## Vue d'ensemble

```
            Clients (navigateur)                         Équipe du magasin
                     │                                           │
                     ▼                                           ▼
   ┌─────────────────────────────────┐        ┌──────────────────────────────────┐
   │  Site Next.js (frontend + API)  │◄──────►│  WordPress (administration)       │
   │  pages, panier, compte, paiement│  REST  │  extension tatos-headless         │
   │  /api/* (commandes, comptes…)   │        │  contenus, catalogue, Boutique    │
   └───────────────┬─────────────────┘        └──────────────────────────────────┘
                   │ Prisma                     ▲ webhook (X-Tatos-Secret)
                   ▼                            │ API d'administration (Bearer ADMIN_API_SECRET)
        Base de données du site
        (SQLite en local, PostgreSQL/MySQL possible)
```

| Composant | Technologie | Rôle |
| --- | --- | --- |
| Site | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 | Pages publiques, espace client, panier, paiement, API JSON. |
| Base de données | Prisma 6 + SQLite (`prisma/dev.db`) | Catalogue servi au site, comptes, adresses, commandes, paiements, coupons, avis, messages, abonnés. |
| Authentification | NextAuth 4 (JWT) | Email + mot de passe (bcrypt), connexion Google optionnelle. |
| Paiement | Stripe (Payment Element) ou règlement à la livraison | Vérification serveur systématique, webhook signé. |
| Emails | Nodemailer (SMTP) | Envoi transactionnel ; sans SMTP, messages conservés dans `outbox/`. |
| Contenus et administration | WordPress 6+ + extension `wordpress/plugins/tatos-headless` | Pages, articles, FAQ, menus, produits, catégories, réglages ; écrans Boutique (commandes, clients…). |
| Adresses | Base Adresse Nationale (api-adresse.data.gouv.fr) | Autocomplétion, géocodage, calcul de distance de livraison. |

## Arborescence

```
src/app/                 pages (App Router) et routes API (src/app/api/**/route.ts)
src/components/          interface : layout, home, shop, product, cart, checkout, account, auth, forms, ui
src/context/             panier (CartProvider), session, notifications
src/services/            appels HTTP du navigateur vers /api (fetch avec délais et relances)
src/lib/                 règles métier pures : livraison (delivery.ts), montants (money.ts), validation, SEO
src/lib/catalog/         lecture du catalogue (cache mémoire, filtres, recherche)
src/lib/cms/             contenus : fournisseur local (data/content) ou WordPress, synchronisation
src/lib/server/          services serveur : commandes, paiements, coupons, avis, adresses, factures PDF,
                         emails, administration, limitation de débit
src/types/               types partagés
prisma/                  schéma, migrations, seed (catalogue, coupons, compte de démonstration)
data/seed/               catalogue d'origine (JSON) ; data/content/ : contenus éditoriaux locaux
public/assets/           images, polices, étiquettes énergie (toutes locales)
wordpress/               extension tatos-headless, export d'import, installation locale (setup-local.sh)
scripts/                 audits, export/synchronisation WordPress, nettoyage des données de test
tests/                   unitaires et intégration (Vitest), bout en bout (Python + Playwright)
docs/                    documentation (ce dossier)
```

## Données

Modèles Prisma (`prisma/schema.prisma`) :

| Modèle | Contenu |
| --- | --- |
| `Category`, `Product`, `ProductImage` | Catalogue (prix en centimes, stock, caractéristiques, images, vedette, promotion). |
| `User` (rôle `CUSTOMER` / `ADMIN`), `PasswordResetToken`, `Address` | Comptes clients, réinitialisation de mot de passe, adresses de livraison. |
| `Order`, `OrderItem`, `Payment` | Commandes (statut, montants recalculés, livraison, adresses), lignes figées au moment de l'achat, tentatives de paiement. |
| `Coupon`, `CouponRedemption` | Codes promo (pourcentage ou montant, minimum, plafond d'utilisations, date de fin, code personnel) et utilisations. |
| `Review` | Avis (un par client et par produit, réservé aux acheteurs). |
| `ContactMessage`, `ServiceRequest`, `Ticket` | Messages de contact, demandes de rendez-vous, signalements (avec images). |
| `NewsletterSubscriber` | Abonnés. |

**Source de vérité** :

- contenus éditoriaux (pages, articles, FAQ, menus, réglages) : WordPress quand `CMS_PROVIDER=wordpress`,
  sinon les fichiers `data/content/` ;
- catalogue : WordPress (produits, catégories) synchronisé dans la base du site, qui sert les pages
  (rapide, filtrable) ;
- commandes, comptes, stock réel, coupons, avis, messages : **la base du site**. WordPress les lit et
  les modifie par l'API d'administration (`/api/admin/*`).

## Flux d'une commande

1. **Panier** (navigateur, `CartProvider`) : produits et quantités ; pour la livraison, l'adresse est
   validée et géocodée (BAN), la distance au magasin calculée, les options et frais proposés
   (`src/lib/delivery.ts` : grille par tranche de 20 km jusqu'à 80 km, frais d'étage, reprise).
2. **Création** `POST /api/orders/create` : le serveur recalcule tout (prix en base, promotions,
   coupon, distance, frais) et refuse une commande dont le total affiché diffère ; le stock est réservé
   de façon atomique pendant 30 minutes (statut `EN_ATTENTE_PAIEMENT`).
3. **Règlement** sur `/paiement` :
   - **Stripe** : `POST /api/checkout/create-payment-intent` (montant issu de la commande), confirmation
     par Stripe.js, puis vérification serveur `POST /api/checkout/confirm` et webhook signé
     `POST /api/stripe/webhook` ; `markOrderPaid` passe la commande à `PAYEE` (idempotent) ;
   - **à la livraison / au retrait** : `POST /api/checkout/pay-on-delivery` ; `confirmPayOnDelivery`
     passe la commande à `EN_PREPARATION` avec `paymentProvider = "sur_place"` et un paiement
     `EN_ATTENTE`.
   Dans les deux cas : coupon consommé une seule fois, emails client et magasin.
4. **Suivi** par le magasin (WordPress → `PATCH /api/admin/orders/:id`) : `EN_PREPARATION`,
   `EXPEDIEE`, `LIVREE` ou `ANNULEE` (remise en stock). Pour une commande à régler sur place, `LIVREE`
   enregistre le règlement (`paidAt`, paiement `REUSSI`).
5. **Facture** PDF (`src/lib/server/invoice.ts`, générateur PDF interne `pdf.ts`) disponible dès que
   la commande est réglée, côté client (`/compte/commandes`) et côté magasin.

Les commandes non réglées expirent après 30 minutes (`expireStaleOrders`) : statut `ANNULEE`, stock
rendu.

## Paiement

`src/lib/server/payments.ts` choisit le mode :

| Configuration | Modes proposés au client |
| --- | --- |
| Sans `STRIPE_SECRET_KEY` | Règlement à la livraison ou au retrait. |
| Avec Stripe | Carte bancaire ; plus le règlement sur place si `PAY_ON_DELIVERY=true`. |
| `TEST_PAYMENTS=true` (sans Stripe) | Active en plus `POST /api/checkout/test-payment`, simulation réservée aux tests automatisés ; jamais visible des clients. |

Le montant facturé provient toujours de la commande enregistrée, jamais du navigateur.

## Contenus (CMS)

`src/lib/cms/index.ts` expose les mêmes fonctions quel que soit le fournisseur :

- `local.ts` : fichiers `data/content/*.json` (pages, articles, FAQ, menus, réglages) ;
- `wordpress.ts` : API REST WordPress (`/wp/v2/*` et `/tatos/v1/*`), mise en cache 5 minutes et
  invalidée instantanément par le webhook `POST /api/webhooks/wordpress`.

Les contenus HTML venant de WordPress sont nettoyés (`sanitize.ts`) avant affichage. Les produits et
catégories modifiés dans WordPress sont recopiés dans la base du site (`wordpress-sync.ts`), produit
par produit à chaque événement, ou en totalité avec `npm run wp:sync`.

## Authentification et comptes

- NextAuth en JWT (`src/lib/auth.ts`) ; mots de passe hachés (bcrypt) ; règles de mot de passe
  communes au navigateur et au serveur (`src/lib/validation.ts`, `src/lib/client/form-rules.ts`).
- Google OAuth si `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` sont définis : seuls les emails vérifiés
  sont acceptés, un compte existant avec le même email est rattaché.
- `src/middleware.ts` protège `/compte`, `/paiement` ; chaque API vérifie en plus la session.
- Suppression de compte (`DELETE /api/users/me`) : données personnelles effacées, commandes et
  factures conservées sous une identité anonymisée.

## Emails

`src/lib/server/mailer.ts` envoie par SMTP (`SMTP_*`, `MAIL_FROM`) ; en l'absence de SMTP ou en cas
d'échec, le message est écrit en JSON dans `MAIL_OUTBOX_DIR` (`outbox/`), rien n'est perdu.
`src/lib/server/notifications.ts` contient les modèles : confirmation de commande (client et
magasin), changements de statut, bienvenue, newsletter (lien de désinscription signé HMAC).

## Sécurité

- Montants, stock, coupons et droits recalculés côté serveur ; chaque ressource client est filtrée par
  son propriétaire (404 sinon).
- Validation des entrées par Zod (`src/lib/server/order-schemas.ts`, `src/lib/validation.ts`).
- Limitation de débit en mémoire (`rate-limit.ts`) sur l'inscription, la connexion, les formulaires.
- En-têtes : `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`
  (`next.config.ts`).
- API d'administration : clé partagée `ADMIN_API_SECRET` (comparaison à temps constant), jamais
  exposée au navigateur ; webhook WordPress : secret `WORDPRESS_WEBHOOK_SECRET`.
- Webhook Stripe : signature vérifiée (`STRIPE_WEBHOOK_SECRET`).
- Côté WordPress : nonces et capacités sur toutes les actions, clés stockées dans les réglages et
  masquées à l'écran.

## Performances

- Catalogue en cache mémoire (`CATALOG_CACHE_TTL_MS`), invalidé à chaque modification de stock ou de
  produit.
- Pages statiques régénérées (ISR) : accueil, pages de contenu, fiches produits.
- Images optimisées par `next/image` (WebP, tailles adaptées, cache 30 jours).
- Côté navigateur : délais, relances automatiques et indicateur hors connexion (`NetworkStatus`).

## Modifier une règle métier

| Règle | Fichier |
| --- | --- |
| Grille et options de livraison, frais d'étage, distance maximale | `src/lib/delivery.ts` (+ coordonnées du magasin `STORE_COORDINATES`) |
| Durée de réservation du stock avant expiration (`PENDING_TTL_MS`) | `src/lib/server/orders.ts` |
| Règles des coupons | `src/lib/server/coupons.ts` |
| Textes des emails | `src/lib/server/notifications.ts` |
| Mise en page de la facture | `src/lib/server/invoice.ts` |
| Règles de validation des formulaires | `src/lib/validation.ts`, `src/lib/client/form-rules.ts` |

Après modification : `npm run lint`, `npm run typecheck`, `npm test`, puis `npm run build` et les
tests de bout en bout (voir [Tests et audits](tests.md)).
