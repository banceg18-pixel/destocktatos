# Configuration

Le site se configure par variables d'environnement (fichier `.env` en local, variables du service en
production ; modèle commenté : `.env.example`). WordPress se configure dans **Réglages → Site et
magasin**. Les variables `NEXT_PUBLIC_*` sont intégrées au build : relancez `npm run build` après les
avoir modifiées.

## Variables du site

### Général

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | oui | Adresse publique du site (liens canoniques, sitemap, Open Graph, liens des emails). |
| `DATABASE_URL` | oui | Base de données. SQLite : `file:./dev.db` (chemin relatif à `prisma/`). |
| `CATALOG_CACHE_TTL_MS` | non | Durée du cache mémoire du catalogue (60000 par défaut, 0 = désactivé). |
| `UPLOAD_DIR` | non | Dossier des images jointes aux signalements (`./uploads`). |
| `ADDRESS_API_URL` | non | Service d'adresses (Base Adresse Nationale par défaut). |

### Comptes

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `NEXTAUTH_URL` | oui | Adresse exacte du site (identique à `NEXT_PUBLIC_SITE_URL`). |
| `NEXTAUTH_SECRET` | oui | Secret de signature des sessions (32 octets aléatoires). Le changer déconnecte tout le monde. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | non | Connexion avec Google (boutons affichés seulement si les deux sont définis). |

### Contenus et WordPress

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `CMS_PROVIDER` | oui | `wordpress` (contenus gérés dans WordPress) ou `local` (fichiers `data/content`). |
| `WORDPRESS_API_URL` | si WordPress | API REST de WordPress, ex. `https://admin.votre-boutique.fr/wp-json`. |
| `WORDPRESS_APPLICATION_USER`, `WORDPRESS_APPLICATION_PASSWORD` | non | Mot de passe d'application WordPress, seulement si l'API REST est restreinte. |
| `WORDPRESS_WEBHOOK_SECRET` | si WordPress | Secret partagé du webhook WordPress → site (même valeur dans les réglages WordPress). |
| `ADMIN_API_SECRET` | si WordPress | Clé de l'API d'administration utilisée par les écrans Boutique (même valeur dans les réglages WordPress). |
| `WP_SYNC_STOCK` | non | `true` pour reprendre aussi le stock de WordPress lors des synchronisations (par défaut, le stock du site fait foi). |
| `WORDPRESS_MEDIA_HOST` | non | Domaine des médias WordPress s'il diffère de celui de `WORDPRESS_API_URL`. |

### Paiement

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | non | Clé secrète Stripe. Vide : règlement à la livraison ou au retrait uniquement. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | avec Stripe | Clé publique Stripe. |
| `STRIPE_WEBHOOK_SECRET` | avec Stripe | Secret de signature du webhook Stripe. |
| `PAY_ON_DELIVERY` | non | Avec Stripe, `true` propose aussi le règlement à la livraison ou au retrait. |
| `TEST_PAYMENTS` | non | Réservé aux tests automatisés (simulation de paiement). Ne jamais définir en production. |

### Emails

| Variable | Obligatoire | Description |
| --- | --- | --- |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | en production | Serveur d'envoi (port 587 STARTTLS, 465 SSL). |
| `MAIL_FROM` | en production | Expéditeur affiché, ex. `Votre Boutique <contact@votre-boutique.fr>`. |
| `STORE_NOTIFICATION_EMAIL` | oui | Adresse du magasin qui reçoit les nouvelles commandes et les messages. |
| `MAIL_OUTBOX_DIR` | non | Dossier où sont conservés les emails non envoyés (`./outbox`). |

### Mesure d'audience

| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_GA_ID` | Identifiant Google Analytics 4 (chargé seulement après consentement). |
| `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` | Balise de vérification de la Search Console. |

### Développement et tests

| Variable | Description |
| --- | --- |
| `NEXT_DIST_DIR` | Dossier de build alternatif (ex. `.next-dev` pour un serveur de développement à côté d'un serveur de production). |

## Réglages WordPress (Réglages → Site et magasin)

| Champ | Utilisation |
| --- | --- |
| Nom du site, description | En-tête, titre des pages, emails, factures. |
| Email de contact, téléphone (et format international), adresse, code postal, ville, pays | Pied de page, page contact, emails, factures, données structurées. |
| Horaires (pied de page), horaires du magasin | Affichés sur le site et dans les emails de retrait. |
| Adresse pour la carte | Recherche utilisée pour la carte de la page contact. |
| Adresse publique du site | Liens « Voir sur le site » et appels à l'API d'administration. |
| Clé d'administration | Valeur de `ADMIN_API_SECRET`. |
| URL du webhook frontend | `https://<site>/api/webhooks/wordpress`. |
| Secret partagé du webhook | Valeur de `WORDPRESS_WEBHOOK_SECRET`. |

Les champs secrets sont masqués à l'écran. **Vérifier la liaison avec le site** teste la clé
d'administration et indique si l'envoi des emails est actif.

## Rôles WordPress

| Rôle | Capacités |
| --- | --- |
| Administrateur | Tout. |
| Gestionnaire de boutique (`tatos_shop_manager`) | Capacités d'un éditeur + `tatos_manage_shop` (rubrique Boutique) + `edit_theme_options` (menus) + liste des comptes. |
| Éditeur, Auteur, Contributeur | Rôles WordPress standards (contenus). |

La capacité requise pour la rubrique Boutique peut être changée par le filtre
`tatos_shop_capability`.

## Valeurs fixées dans le code

Grille de livraison, distance maximale (80 km), coordonnées du magasin pour le calcul des distances,
durée de réservation (30 minutes) : voir [Architecture](architecture.md), section « Modifier une règle métier ».
