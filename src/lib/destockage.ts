import { createHash } from "node:crypto";

/**
 * Règles de l'opération déstockage (module pur, utilisé par `scripts/destockage.ts`).
 * Remise sur le prix conseillé fabricant selon la tranche de prix :
 *   moins de 500 €   : 60 à 80 %
 *   500 à 2 000 €    : 40 à 60 %
 *   2 000 € et plus  : 30 à 50 %
 */
export const DESTOCKAGE_TIERS = [
  { maxCents: 50_000, min: 60, max: 80 },
  { maxCents: 200_000, min: 40, max: 60 },
  { maxCents: Infinity, min: 30, max: 50 },
];

/** Nombre stable dans [0, 1) propre au produit et à l'usage (`salt`). */
export function stableUnit(id: string, salt: string) {
  return createHash("sha256").update(`${salt}:${id}`).digest().readUInt32BE(0) / 2 ** 32;
}

/** Entier de [min, max] tiré de `u` ∈ [0, 1). */
export const between = (u: number, min: number, max: number) => min + Math.floor(u * (max - min + 1));

/** Prix de déstockage (centimes, terminé par ,99) : taux de la tranche, stable pour un même produit. */
export function destockagePriceCents(id: string, prixCents: number) {
  const tier = DESTOCKAGE_TIERS.find((t) => prixCents < t.maxCents)!;
  const pct = between(stableUnit(id, "remise"), tier.min, tier.max);
  const euros = Math.round((prixCents * (100 - pct)) / 100 / 100);
  return Math.max(99, euros * 100 - 1);
}
