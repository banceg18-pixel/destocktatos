# Installation et mise en ligne

Ce document décrit l'installation locale (développement) puis la mise en ligne complète : site
Next.js, base de données, WordPress, emails, paiement et nom de domaine. Les variables citées sont
détaillées dans [Configuration](configuration.md).

## Prérequis

| Outil | Version | Usage |
| --- | --- | --- |
| Node.js | 20 ou plus récent (développé avec Node 24, npm 11) | Site Next.js, scripts, tests unitaires. |
| PHP | 8.1 ou plus récent, extensions `pdo_sqlite`, `mbstring`, `curl` | WordPress local (aucun MySQL ni Docker requis). |
| Python | 3.10 ou plus récent, avec Playwright | Tests de bout en bout et recette de l'administration (facultatif). |

## Installation locale

### 1. Le site

```bash
npm install
```

```bash
cp .env.example .env
```

Dans `.env`, remplacez `NEXTAUTH_SECRET` par une valeur aléatoire :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Puis créez la base (migrations, catalogue, coupons, compte client de démonstration) :

```bash
npm run setup
```

```bash
npm run dev
```

Le site répond sur http://localhost:3000. Les identifiants du compte client de démonstration sont dans
`data/seed/demo-accounts.json`.

> Le mode développement compile chaque page à sa première visite : pour juger de la vitesse réelle,
> utilisez `npm run build` puis `npm run start`.

### 2. WordPress (administration)

Le script installe WordPress en local avec SQLite (téléchargement de WordPress, de l'extension SQLite
et de WP-CLI), active l'extension `tatos-headless`, importe les contenus et configure la liaison avec
le site à partir de `.env` :

```bash
bash wordpress/setup-local.sh
```

```bash
bash wordpress/setup-local.sh serve
```

L'administration répond sur http://localhost:8080/wp-admin. Les identifiants générés sont écrits dans
`wordpress/.local/admin-credentials.txt` (fichier local, jamais versionné).

Avant de lancer le script, renseignez dans `.env` deux secrets aléatoires, `ADMIN_API_SECRET` et
`WORDPRESS_WEBHOOK_SECRET` (le script les recopie dans les réglages de WordPress) :

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Passez ensuite `CMS_PROVIDER=wordpress` dans `.env` et redémarrez le site.

Après une modification de l'extension, recopiez-la dans l'installation locale :

```bash
cp -r wordpress/plugins/tatos-headless wordpress/.local/wp/wp-content/plugins/
```

### 3. Documentation dans l'administration

Les pages **Boutique → Guide d'utilisation** et **Boutique → Documentation technique** lisent les
fichiers de `docs/` copiés dans l'extension. Après toute modification de la documentation :

```bash
npm run docs:plugin
```

## Mise en ligne

### Vue d'ensemble

| Élément | Hébergement conseillé |
| --- | --- |
| Site Next.js | Serveur Node.js (VPS, Render, Railway, Fly.io, Scalingo…) ou Vercel avec une base PostgreSQL. |
| Base de données | PostgreSQL ou MySQL managé en production (SQLite convient à une seule instance sur un VPS avec disque persistant). |
| WordPress | Hébergement PHP/MySQL classique (OVH, o2switch, Hostinger…) ou sur le même VPS. |
| Emails | Fournisseur SMTP (Brevo, Mailjet, OVH, Gmail/Google Workspace, Outlook…). |
| Paiement par carte | Compte Stripe activé (facultatif : sans Stripe, les clients règlent à la livraison ou au retrait). |

Exemple de noms de domaine : `www.votre-boutique.fr` pour le site, `admin.votre-boutique.fr` pour
WordPress.

### Déploiement actuel : Vercel + Neon

Le site est déployé sur Vercel (projet `electro`, adresse https://electro-boutique.vercel.app) avec
une base PostgreSQL Neon reliée au projet (variables `DATABASE_URL` et `DATABASE_URL_UNPOOLED`
ajoutées par l'intégration).

- `prisma/schema.prisma` (SQLite) reste la référence ; `node scripts/prisma-postgres.mjs` en dérive
  `prisma/postgres/schema.prisma`. Après un changement de modèle, régénérez ce fichier puis créez la
  migration PostgreSQL :
  `npx prisma migrate diff --from-schema-datasource prisma/postgres/schema.prisma --to-schema-datamodel prisma/postgres/schema.prisma --script`
  (base à jour) dans un nouveau dossier de `prisma/postgres/migrations/`.
- Build Vercel (`vercel.json` → `npm run vercel-build`) : vérification du schéma, client PostgreSQL,
  `prisma migrate deploy`, `next build`.
- Données initiales (une fois) : avec les variables de production dans l'environnement,
  `npm run db:seed:postgres`.
- Fichiers écrits par le site : `UPLOAD_DIR=/tmp/uploads`, `MAIL_OUTBOX_DIR=/tmp/outbox` (temporaires
  sur Vercel : configurez le SMTP pour que les emails partent réellement).
- Déployer une nouvelle version : `npx vercel deploy --prod`, ou reliez le dépôt GitHub au projet
  (Vercel → Settings → Git) pour un déploiement à chaque `git push`.
- WordPress ne peut pas s'exécuter sur Vercel (ni PHP ni MySQL) : il s'installe chez un hébergeur
  PHP, l'extension se téléverse depuis https://electro-boutique.vercel.app/telechargements/tatos-headless.zip
  et les contenus s'importent depuis **Réglages → Site et magasin → Importer les contenus du site**.

### 1. Base de données

SQLite (par défaut) : `DATABASE_URL="file:./prod.db"` sur un disque persistant, une seule instance.

PostgreSQL : dans `prisma/schema.prisma`, remplacez `provider = "sqlite"` par
`provider = "postgresql"`, renseignez `DATABASE_URL` (`postgresql://utilisateur:motdepasse@hôte:5432/base`),
puis régénérez les migrations sur une base vide :

```bash
npx prisma migrate dev --name init
```

Ensuite, à chaque déploiement :

```bash
npm run db:migrate
```

Premier déploiement uniquement (catalogue, coupons) :

```bash
npm run db:seed
```

### 2. Le site Next.js

Variables minimales en production (voir [Configuration](configuration.md)) :
`NEXT_PUBLIC_SITE_URL` et `NEXTAUTH_URL` (adresse publique en `https://`), `NEXTAUTH_SECRET`,
`DATABASE_URL`, `CMS_PROVIDER=wordpress`, `WORDPRESS_API_URL`, `ADMIN_API_SECRET`,
`WORDPRESS_WEBHOOK_SECRET`, les variables SMTP et `STORE_NOTIFICATION_EMAIL`.

```bash
npm ci
```

```bash
npm run build
```

```bash
npm run start
```

Points d'attention :

- servez le site en **HTTPS** derrière un proxy inverse (Nginx, Caddy, ou la plateforme) qui
  **écrase** l'en-tête `X-Forwarded-For` (la limitation de débit s'appuie sur cette adresse) ;
- dossiers persistants : `UPLOAD_DIR` (images des signalements) et `MAIL_OUTBOX_DIR` ;
- une seule instance avec SQLite ; pour plusieurs instances, PostgreSQL et un stockage partagé pour la
  limitation de débit et le cache (`src/lib/server/rate-limit.ts`, `src/lib/server/memo.ts`) ;
- relancez le service automatiquement (systemd, PM2 ou la plateforme).

### 3. WordPress

1. Installez WordPress (en français) sur l'hébergement choisi, avec un mot de passe administrateur
   fort.
2. Copiez le dossier `wordpress/plugins/tatos-headless` dans `wp-content/plugins/` (après
   `npm run docs:plugin`), puis activez l'extension **TATOS Headless** (menu **Extensions**).
3. **Réglages → Permaliens** : choisissez « Titre de la publication ».
4. Importez les contenus avec WP-CLI (fichier généré par `npm run wp:export`) :

   ```bash
   wp tatos import wordpress-import.json
   ```

5. **Réglages → Site et magasin**, rubrique « Liaison avec le site » :
   - **Adresse publique du site** : `https://www.votre-boutique.fr` ;
   - **Clé d'administration** : la valeur de `ADMIN_API_SECRET` du site ;
   - **URL du webhook** : `https://www.votre-boutique.fr/api/webhooks/wordpress` ;
   - **Secret du webhook** : la valeur de `WORDPRESS_WEBHOOK_SECRET` du site.
6. Cliquez sur **Vérifier la liaison avec le site** : le message « Liaison réussie » doit apparaître.
7. Côté site : `WORDPRESS_API_URL=https://admin.votre-boutique.fr/wp-json`, et si les médias
   WordPress sont servis depuis un autre domaine, `WORDPRESS_MEDIA_HOST`.
8. Créez les comptes de l'équipe (**Comptes → Ajouter**, rôle « Gestionnaire de boutique »).

Le site public de WordPress redirige automatiquement vers le site : seuls `/wp-admin`, `/wp-login.php`
et l'API `/wp-json` restent accessibles.

### 4. Emails

Renseignez `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS ou 465 SSL), `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`
(ex. `Votre Boutique <contact@votre-boutique.fr>`) et `STORE_NOTIFICATION_EMAIL` (adresse qui reçoit
les commandes et messages). Configurez SPF, DKIM et DMARC du domaine d'envoi chez votre fournisseur
pour éviter les courriers indésirables. **Vérifier la liaison** dans WordPress indique « Emails : envoi
actif » une fois le SMTP configuré.

### 5. Paiement par carte (facultatif)

1. Créez et activez un compte sur <https://dashboard.stripe.com>.
2. Renseignez `STRIPE_SECRET_KEY` (`sk_live_…`) et `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
   (`pk_live_…`). `NEXT_PUBLIC_*` étant intégrée au build, relancez `npm run build`.
3. Stripe → Développeurs → Webhooks : point de terminaison
   `https://www.votre-boutique.fr/api/stripe/webhook`, événements `payment_intent.succeeded` et
   `payment_intent.payment_failed` ; copiez le secret de signature dans
   `STRIPE_WEBHOOK_SECRET`.
4. Pour proposer aussi le règlement à la livraison ou au retrait : `PAY_ON_DELIVERY=true`.

En local, utilisez des clés de test (`sk_test_…`) et relayez le webhook :

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

### 6. Connexion avec Google (facultatif)

1. Sur <https://console.cloud.google.com>, créez un projet, puis **API et services → Écran de
   consentement OAuth** : type **Externe**, nom de la boutique, email d'assistance, domaine ; portées
   `openid`, `email`, `profile` ; publiez l'application.
2. **Identifiants → Créer des identifiants → ID client OAuth → Application Web** :
   - origines autorisées : `https://www.votre-boutique.fr` (et `http://localhost:3000` en local) ;
   - URI de redirection : `https://www.votre-boutique.fr/api/auth/callback/google` (et
     `http://localhost:3000/api/auth/callback/google`).
3. Renseignez `GOOGLE_CLIENT_ID` et `GOOGLE_CLIENT_SECRET`, puis redémarrez le site : les boutons
   « Continuer avec Google » apparaissent sur la connexion et l'inscription.

### 7. Mesure d'audience et référencement (facultatif)

`NEXT_PUBLIC_GA_ID` (Google Analytics 4, chargé seulement après consentement aux cookies) et
`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` (Search Console). Déclarez ensuite
`https://www.votre-boutique.fr/sitemap.xml` dans la Search Console.

## Liste de contrôle avant ouverture

- [ ] `NEXT_PUBLIC_SITE_URL` et `NEXTAUTH_URL` en `https://` sur le domaine définitif, `NEXTAUTH_SECRET` aléatoire.
- [ ] Base de production migrée, sauvegardes automatiques en place (base du site **et** WordPress).
- [ ] WordPress : extension active, liaison vérifiée, comptes de l'équipe créés, compte `admin` doté d'un mot de passe fort.
- [ ] Coordonnées du magasin à jour (**Réglages → Site et magasin**).
- [ ] Pages légales complétées (raison sociale, SIRET, hébergeur, médiateur : passages entre crochets).
- [ ] SMTP configuré et testé (création de compte, commande, réponse à un message).
- [ ] Mode de règlement choisi : Stripe en clés `live` avec webhook, et/ou règlement à la livraison.
- [ ] Données de démonstration retirées : `npm run clean:test-data` ; compte client de démonstration supprimé si vous ne le gardez pas.
- [ ] Commande réelle de bout en bout passée et annulée, facture vérifiée.
- [ ] Sitemap déclaré dans la Search Console.

## Sauvegardes et mises à jour

- **Base du site** : SQLite → copie quotidienne du fichier (`prod.db`) ; PostgreSQL → sauvegarde
  managée ou `pg_dump` quotidien.
- **WordPress** : base MySQL et dossier `wp-content/uploads` (extension de sauvegarde ou outil de
  l'hébergeur).
- **Mises à jour** : WordPress et ses extensions depuis **Tableau de bord → Mises à jour** ; le site
  par un nouveau déploiement (`npm ci`, `npm run db:migrate`, `npm run build`, redémarrage). Lancez
  les tests avant chaque mise en production (voir [Tests et audits](tests.md)).
