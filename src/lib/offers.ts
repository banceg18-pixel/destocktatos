/**
 * Offre « -10 % sur les produits de plus de 1 000 € », annoncée par le popup du site : appliquée
 * automatiquement au prix de vente (déstockage compris) de chaque article concerné, au panier
 * comme sur la commande. Module pur, partagé par le panier (affichage) et par le backend (calcul
 * faisant foi lors de la création de commande).
 */
export const BIG_TICKET_OFFER = { thresholdEuros: 1000, percent: 10 } as const;

/** Prix unitaire après l'offre, en centimes. */
export function offerUnitCents(unitCents: number): number {
  return unitCents > BIG_TICKET_OFFER.thresholdEuros * 100 ? Math.round((unitCents * (100 - BIG_TICKET_OFFER.percent)) / 100) : unitCents;
}

/** Prix unitaire après l'offre, en euros (le panier client compte en euros). */
export function offerUnitEuros(unitEuros: number): number {
  return offerUnitCents(Math.round(unitEuros * 100)) / 100;
}

/** L'article (prix de vente en euros) bénéficie-t-il de l'offre ? */
export const offerApplies = (unitEuros: number) => offerUnitEuros(unitEuros) < unitEuros;
