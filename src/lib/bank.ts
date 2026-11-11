import type { SiteSettings } from "@/lib/cms/types";

export interface BankDetails {
  /** Service responsable des paiements (affiché au-dessus du titulaire). */
  service: string;
  holder: string;
  bank: string;
  iban: string;
  bic: string;
  /** Communication à indiquer sur le virement (fournie par la banque du magasin). */
  reference: string;
}

/** Compte du magasin fourni par le gérant (modifiable dans WordPress → Réglages → Site et magasin). */
const DEFAULT_BANK = {
  bank: "Santander Consumer Bank",
  iban: "DE53310108339914082074",
  bic: "SCFBDE33XXX",
  reference: "",
  holder: "Bernard Alexis Chabaud",
  service: "Finanzabteilung",
};

type BankSettings = Pick<SiteSettings, "siteName" | "bankService" | "bankHolder" | "bankName" | "bankIban" | "bankBic" | "bankReference" | "legalName">;

/** Coordonnées bancaires du virement : réglages WordPress, sinon le compte fourni par le gérant. */
export function bankDetailsOf(s: BankSettings | null | undefined): BankDetails {
  const custom = (s?.bankIban ?? "").replace(/\s+/g, "").toUpperCase();
  const iban = custom || DEFAULT_BANK.iban;
  return {
    service: s?.bankService?.trim() || (custom ? "Finanzabteilung" : DEFAULT_BANK.service),
    // Titulaire du compte du magasin, à défaut de titulaire saisi.
    holder: s?.bankHolder?.trim() || (custom ? "Bernard Alexis Chabaud" : DEFAULT_BANK.holder),
    bank: s?.bankName?.trim() || (custom ? "Santander Consumer Bank" : DEFAULT_BANK.bank),
    iban: iban.replace(/(.{4})(?=.)/g, "$1 "),
    bic: (s?.bankBic || (custom ? "SCFBDE33XXX" : DEFAULT_BANK.bic)).replace(/\s+/g, "").toUpperCase(),
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
    ["Numéro de commande", orderNumber, true],
    ...(bank
      ? ([
          ["Titulaire / Empfänger", bank.holder],
          ...(bank.bank ? [["Banque", bank.bank]] : []),
          ["IBAN", bank.iban, true],
          ...(bank.bic ? [["BIC", bank.bic, true]] : []),
        ] as [string, string, boolean?][])
      : []),
  ];
  const how = bank?.reference
    ? `Bitte geben Sie ${bank.reference} sowie Ihre Bestellnummer ${orderNumber} als Verwendungszweck an.`
    : `Bitte geben Sie Ihre Bestellnummer ${orderNumber} als Verwendungszweck an (Indiquez votre référence de commande).`;
  return { rows, note: `${how} Ihre Bestellung wird vorbereitet und geliefert, sobald die Zahlung eingegangen ist.` };
}
