# TATOS — boutique d'électroménager en ligne

Boutique en ligne complète d'un magasin d'électroménager : catalogue, recherche, panier avec
livraison calculée selon la distance, comptes clients, commande, règlement par carte ou à la
livraison, factures, avis, messages, newsletter. Le site est construit avec Next.js ; tout se gère
depuis une administration WordPress (contenus, catalogue, commandes, clients, promotions…).

## Documentation

| Document | Pour qui | Contenu |
| --- | --- | --- |
| [Guide d'utilisation](docs/guide-utilisation.md) | Équipe du magasin | Gérer la boutique au quotidien depuis l'administration : commandes, produits, pages, promotions, messages… |
| [Architecture](docs/architecture.md) | Développeurs | Composants, données, flux d'une commande, paiement, sécurité, où modifier une règle métier. |
| [Installation et mise en ligne](docs/installation-deploiement.md) | Développeurs, hébergeur | Installation locale, déploiement du site et de WordPress, emails, Stripe, Google, liste de contrôle. |
| [Configuration](docs/configuration.md) | Développeurs | Toutes les variables d'environnement, réglages WordPress, rôles. |
| [API du site](docs/api.md) | Développeurs | Routes publiques, client, paiement, webhooks, API d'administration. |
| [Extension WordPress](docs/wordpress.md) | Développeurs | Fonctionnement de l'extension `tatos-headless`, synchronisation, commandes WP-CLI. |
| [Tests et audits](docs/tests.md) | Développeurs | Tests unitaires, de bout en bout, recette de l'administration, nettoyage des données de test. |
| [Plan du site](docs/site-map.md) | Tous | Pages, routes et catégories. |
| [Crédits des images](docs/credits.md) | Tous | Origine et licence des photos. |

Une fois en ligne, le guide d'utilisation et la documentation technique sont aussi consultables dans
l'administration WordPress : **Boutique → Guide d'utilisation** et **Boutique → Documentation
technique** (après `npm run docs:plugin`).

## Démarrage rapide

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

```bash
cp .env.example .env
```

Renseignez `NEXTAUTH_SECRET` dans `.env` (valeur aléatoire), puis :

```bash
npm run setup
```

```bash
npm run dev
```

Le site répond sur http://localhost:3000. Pour l'administration WordPress locale (PHP 8.1+, sans
MySQL) :

```bash
bash wordpress/setup-local.sh
```

```bash
bash wordpress/setup-local.sh serve
```

Administration : http://localhost:8080/wp-admin (identifiants dans
`wordpress/.local/admin-credentials.txt`). Détails : [Installation et mise en ligne](docs/installation-deploiement.md).

## Commandes utiles

| Commande | Effet |
| --- | --- |
| `npm run dev` | Serveur de développement (port 3000). |
| `npm run build` puis `npm run start` | Build et serveur de production. |
| `npm run setup` | Client Prisma, migrations, données initiales. |
| `npm test` · `npm run test:e2e` · `npm run test:all` | Tests (voir [Tests et audits](docs/tests.md)). |
| `npm run lint` · `npm run typecheck` | Qualité du code. |
| `npm run wp:export` · `npm run wp:sync` · `npm run wp:check` | Échanges avec WordPress. |
| `npm run docs:plugin` | Copie la documentation dans l'extension WordPress. |
| `npm run clean:test-data` | Supprime les comptes et commandes créés par les tests. |

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 (SQLite, PostgreSQL
possible) · NextAuth (email + Google) · Stripe · Nodemailer · WordPress 6+ (extension headless) ·
Vitest · Playwright.
