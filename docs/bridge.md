# Paiement par virement : Bridge (Open Banking / PISP)

Ce document décrit la configuration du paiement par virement : le parcours **standard SEPA**
(manuel, toujours actif) et le parcours **Bridge** (virement direct depuis la banque du client).

## Vue d'ensemble

Deux parcours de paiement cohabitent sur la page `/paiement` :

| Parcours | Ce qui se passe | Activation |
| --- | --- | --- |
| **Standard-SEPA-Überweisung** | Le client confirme sa commande, reçoit l'IBAN/BIC et verse lui-même le montant. Le magasin passe la commande à « Payée » à réception. | Toujours actif (`/api/checkout/bank-transfer`). |
| **Direktüberweisung (Bridge PISP)** | Le client choisit sa banque ; Bridge ouvre le guichet bancaire et pré-remplit le virement. La confirmation se fait par TAN dans la banque du client ; le webhook Bridge marque la commande payée. | Dès que `BRIDGE_CLIENT_ID` et `BRIDGE_CLIENT_SECRET` sont définis. Sans ces clés, la case Bridge redirige vers un **simulateur bancaire** (`/bank-sim`), pour tester le parcours de bout en bout. |

## Variables d'environnement

| Variable | Rôle | Valeur par défaut |
| --- | --- | --- |
| `BRIDGE_CLIENT_ID` / `BRIDGE_CLIENT_SECRET` | Authentification auprès de l'API Bridge. Les deux définis ⇒ mode **live**. | (vide ⇒ simulateur) |
| `BRIDGE_API_URL` | URL de l'API Bridge. | `https://api.bridgeapi.io` |
| `BRIDGE_VERSION` | Version de l'API (`Bridge-Version`). | `2025-01-15` |
| `BRIDGE_WEBHOOK_SECRET` | Secret HMAC utilisé pour vérifier l'en-tête `BridgeApi-Signature` du webhook. **À définir impérativement en production.** | (interne de secours) |
| `BRIDGE_BENEFICIARY_NAME` / `_IBAN` / `_BIC` | Compte marchand qui reçoit les virements. | Compte Santander fourni par le gérant |

> Sandbox Bridge : `BRIDGE_API_URL=https://api.bridgeapi.io` + les identifiants **sandbox** donnés
> par Bridge (`client_id_sandbox`). Le mode `live` au sens du site (clés présentes) s'applique aussi
> à la sandbox Bridge — les paiements y sont simulés côté Bridge.

## Webhook côté Bridge

Dans la console Bridge, déclare :

- **URL du webhook** : `https://<site>/api/webhooks/bridge`
- **Secret de signature** : la même valeur que `BRIDGE_WEBHOOK_SECRET`
- **Événements** : `payment.transaction.created`, `payment.transaction.updated`

Le site vérifie la signature `BridgeApi-Signature: v1=<hmac-sha256 hex>`, puis, si le statut de la
transaction est `ACSC` (Approved, Settlement Completed — ou `ACTC`/`succeeded`), il marque la
commande payée (paiement enregistré, coupon consommé, facture envoyée). La requête est idempotente :
renvoyer le même événement n'a aucun effet de plus.

## Compte marchand

Les virements arrivent sur le compte configuré dans `BRIDGE_BENEFICIARY_*` (sans ces variables :
le compte Santander Consumer Bank du gérant, identique à celui affiché aux clients). Modifiable
aussi dans WordPress → Réglages → Site et magasin (IBAN, BIC, communication).

## Vérifier la configuration

```bash
node scripts/check-env.mjs
```

affiche la situation de chaque bloc de configuration (site, base, emails, Bridge, paiement) et le
mode de paiement actif, sans afficher de secret.

## Parcours de test sans clés Bridge (simulateur)

1. Ajouter un article au panier, commander (virement standard ou Bridge).
2. Sur `/paiement`, choisir « Direktüberweisung (Bridge) », sélectionner une banque, valider.
3. Le simulateur `/bank-sim` s'ouvre : TAN affichée (842 195), boutons « Freigeben » / « Abbrechen ».
4. « Freigeben » marque la commande payée comme le ferait le webhook Bridge ; le retour se fait
   vers `/confirmation?status=success`.
