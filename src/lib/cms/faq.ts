import { normalize } from "@/lib/text";
import type { FaqCategory } from "./types";

/**
 * Réponses de la FAQ d'origine (TATOS) devenues fausses pour Destocktatos : carte bancaire et PayPal,
 * livraison express, retours sous 30 jours, étiquette et numéro de suivi de colis… Tant qu'une réponse
 * de WordPress en contient une, le site affiche la réponse à jour (data/content/faq.json) ; une réponse
 * réécrite dans WordPress est affichée telle quelle.
 */
export const OBSOLETE_FAQ =
  /PayPal|Visa|Mastercard|livraison express|24-48 ?h|30 jours|étiquette de retour|numéro de suivi|prestataires de paiement certifiés|automatiquement envoyée par email après la validation|réception de votre retour en nos locaux|Remplissez le formulaire avec vos informations personnelles/i;

export function refreshObsoleteFaq(faq: FaqCategory[], reference: FaqCategory[]): FaqCategory[] {
  const answers = new Map(reference.flatMap((c) => c.items.map((i) => [normalize(i.question), i.answer] as const)));
  return faq.map((c) => ({
    ...c,
    items: c.items.map((i) => {
      const fresh = answers.get(normalize(i.question));
      return fresh && OBSOLETE_FAQ.test(i.answer) ? { ...i, answer: fresh } : i;
    }),
  }));
}
