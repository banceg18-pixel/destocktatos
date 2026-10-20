# Tests et audits

| Commande | Ce qui est vérifié | Prérequis |
| --- | --- | --- |
| `npm run lint` | ESLint (règles Next.js et TypeScript). | — |
| `npm run typecheck` | TypeScript strict, sans émission. | — |
| `npm test` | Vitest : règles de livraison, montants, coupons, validation, facture PDF, découpage des pages WordPress ; intégration (commandes, stock, paiement, coupons, avis, adresses, inscription, réinitialisation) sur une base dédiée `prisma/test.db`. | — |
| `npm run audit:source-refs` | Aucune référence au site d'origine ni à son CDN dans le code, les données, les bases et le build ; inventaire des hôtes externes. | — |
| `npm run audit:assets` | Chaque image référencée existe, correspond au manifeste `docs/assets-manifest.csv` (taille, SHA-256) et ne contient pas de coordonnées GPS. | — |
| `npm run build` | Build de production Next.js. | — |
| `npm run test:e2e` | Tests de bout en bout (voir ci-dessous). | Build, Python 3 et Playwright |
| `python tests/e2e/wordpress_admin.py` | Recette de l'administration WordPress (voir ci-dessous). | Site sur :3000 et WordPress sur :8080 |
| `npm run test:all` | Lint, types, tests, audits, build et tests de bout en bout. | — |

Installation de Playwright pour Python :

```bash
pip install playwright
```

```bash
python -m playwright install chromium
```

## Tests de bout en bout (`tests/e2e/run_e2e.py`)

Le script prépare une base dédiée (`prisma/e2e.db` : migrations et seed), démarre `next start` sur le
port 3100 avec `TEST_PAYMENTS=true` (simulation de paiement réservée aux tests) et une clé
d'administration de test, puis enchaîne :

- **API** : catalogue (pagination, filtres, recherche), SEO et en-têtes de sécurité, accès protégés
  (401), formulaires publics, isolation entre clients (404), adresses, commande avec recalcul
  serveur et refus d'un total falsifié, paiement refusé puis réussi, double paiement refusé, facture,
  avis réservés aux acheteurs, coupons ; **virement bancaire** (confirmation, double envoi
  refusé, facture avec coordonnées dès la confirmation, pas de livraison avant le virement, virement
  marqué reçu par le magasin, annulation avec remise en stock) ;
- **parcours navigateur** : inscription et messages d'erreur par champ, connexion, déconnexion,
  mot de passe oublié, achat en retrait magasin réglé au retrait, achat en livraison (autocomplétion
  d'adresse, distance, options, étage), panier (persistance selon le consentement), recherche et
  filtres, fiche produit, formulaires (contact, newsletter, signalement avec capture) ;
- **responsive** : absence de débordement horizontal et captures sur 8 tailles d'écran.

Options utiles :

```bash
python tests/e2e/run_e2e.py --only achat,api
```

```bash
python tests/e2e/run_e2e.py --no-server --base-url http://localhost:3000
```

Résultats : `test-results/e2e/report.json`, captures d'écran et journal du serveur.

## Recette de l'administration (`tests/e2e/wordpress_admin.py`)

Avec le site (port 3000, `CMS_PROVIDER=wordpress`) et WordPress (port 8080) démarrés, la recette se
connecte à l'administration avec `wordpress/.local/admin-credentials.txt` et vérifie, de bout en
bout : tableau de bord, liaison, modification de la page d'accueil répercutée sur le site, article
créé puis supprimé, produit (prix, stock), stock, commande réelle réglée au retrait puis suivie
jusqu'à « Retirée » (emails client et magasin, facture), clients, codes promo, réponse à un message,
newsletter (aperçu, désinscription), écrans restants, absence d'erreur JavaScript. Chaque modification
est annulée à la fin, puis `scripts/clean-test-data.ts` supprime les comptes, commandes et messages
créés.

## Données de test

Les tests créent des comptes en `@tatos.test`. Pour nettoyer une base (comptes de test, leurs
commandes, avis, adresses, messages et abonnements ; le stock des commandes actives est rendu ; le
compte de démonstration du seed est conservé) :

```bash
npm run clean:test-data -- --dry-run
```

```bash
npm run clean:test-data
```
