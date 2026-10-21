import type { SiteSettings } from "@/lib/cms/types";

export interface BankDetails {
  holder: string;
  bank: string;
  iban: string;
  bic: string;
  /** Communication à indiquer sur le virement (fournie par la banque du magasin). */
  reference: string;
}

/** Compte du magasin fourni par le gérant (modifiable dans WordPress → Réglages → Site et magasin). */
const DEFAULT_BANK = { bank: "BforBank", iban: "FR7616218000014012148835165", bic: "BFBKFRP1", reference: "MJ-MUBVYNWU-379C" };

type BankSettings = Pick<SiteSettings, "siteName" | "bankHolder" | "bankName" | "bankIban" | "bankBic" | "bankReference" | "legalName">;

/** Coordonnées bancaires du virement : réglages WordPress, sinon le compte fourni par le gérant. */
export function bankDetailsOf(s: BankSettings | null | undefined): BankDetails {
  const custom = (s?.bankIban ?? "").replace(/\s+/g, "").toUpperCase();
  const iban = custom || DEFAULT_BANK.iban;
  return {
    // Compte de la société qui exploite le site, à défaut de titulaire saisi.
    holder: s?.bankHolder?.trim() || s?.legalName?.trim() || "REIMS GOLD",
    bank: s?.bankName?.trim() || (custom ? "" : DEFAULT_BANK.bank),
    iban: iban.replace(/(.{4})(?=.)/g, "$1 "),
    bic: (s?.bankBic || (custom ? "" : DEFAULT_BANK.bic)).replace(/\s+/g, "").toUpperCase(),
    reference: (s?.bankReference || (custom ? "" : DEFAULT_BANK.reference)).trim(),
  };
}

/**
 * Lignes du virement attendu, identiques partout (page de confirmation, espace client, email,
 * facture) : montant, communication à indiquer, numéro de commande, coordonnées bancaires.
 */
export function transferLines(amount: string, orderNumber: string, bank: BankDetails | null): { rows: [string, string, boolean?][]; note: string } {
  const rows: [string, string, boolean?][] = [
    ["Montant", amount],
    ...(bank?.reference ? ([["Communication à indiquer", bank.reference, true]] as [string, string, boolean?][]) : []),
    [bank?.reference ? "Numéro de commande" : "Référence à indiquer", orderNumber, true],
    ...(bank ? ([["Titulaire", bank.holder], ...(bank.bank ? [["Banque", bank.bank]] : []), ["IBAN", bank.iban, true], ...(bank.bic ? [["BIC", bank.bic, true]] : [])] as [string, string, boolean?][]) : []),
  ];
  const how = bank?.reference
    ? `Indiquez la communication ${bank.reference} dans le libellé du virement, suivie si possible de votre numéro de commande ${orderNumber}.`
    : `Indiquez bien la référence ${orderNumber} dans le libellé du virement.`;
  return { rows, note: `${how} Votre commande est préparée et livrée dès réception du virement.` };
}
