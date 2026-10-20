import type { SiteSettings } from "@/lib/cms/types";

export interface BankDetails {
  holder: string;
  bank: string;
  iban: string;
  bic: string;
}

/**
 * Coordonnées bancaires du virement, saisies dans WordPress (Réglages → Site et magasin).
 * `null` tant que l'IBAN n'est pas renseigné : rien n'est inventé ni affiché au client.
 */
export function bankDetailsOf(s: Pick<SiteSettings, "siteName" | "bankHolder" | "bankName" | "bankIban" | "bankBic" | "legalName"> | null | undefined): BankDetails | null {
  const iban = (s?.bankIban ?? "").replace(/\s+/g, "").toUpperCase();
  if (!iban) return null;
  return {
    // Compte de la société qui exploite le site, à défaut de titulaire saisi.
    holder: s?.bankHolder?.trim() || s?.legalName?.trim() || "REIMS GOLD",
    bank: s?.bankName?.trim() ?? "",
    iban: iban.replace(/(.{4})(?=.)/g, "$1 "),
    bic: (s?.bankBic ?? "").replace(/\s+/g, "").toUpperCase(),
  };
}
