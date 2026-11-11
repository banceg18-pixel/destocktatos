/**
 * Liste des principales banques allemandes pour le déclenchement de virement (Bridge / Open Banking).
 * Fournit les identifiants, codes BIC/BLZ, couleurs institutionnelles et portails de connexion.
 */

export interface GermanBank {
  id: string;
  name: string;
  shortName: string;
  bic: string;
  blz?: string;
  color: string;
  bgClass: string;
  textClass: string;
  popular?: boolean;
  onlineBankingUrl: string;
}

export const GERMAN_BANKS: GermanBank[] = [
  {
    id: "sparkasse",
    name: "Sparkasse (Berliner Sparkasse / Sparkassen)",
    shortName: "Sparkasse",
    bic: "SPKNDE",
    blz: "10050000",
    color: "#E3000F",
    bgClass: "bg-[#E3000F] text-white",
    textClass: "text-[#E3000F]",
    popular: true,
    onlineBankingUrl: "https://www.sparkasse.de",
  },
  {
    id: "deutsche-bank",
    name: "Deutsche Bank",
    shortName: "Deutsche Bank",
    bic: "DEUTDEDDXXX",
    blz: "10070000",
    color: "#0018A8",
    bgClass: "bg-[#0018A8] text-white",
    textClass: "text-[#0018A8]",
    popular: true,
    onlineBankingUrl: "https://meine.deutsche-bank.de",
  },
  {
    id: "commerzbank",
    name: "Commerzbank",
    shortName: "Commerzbank",
    bic: "COBADEFFXXX",
    blz: "10040000",
    color: "#FFD900",
    bgClass: "bg-[#002e3b] text-[#FFD900]",
    textClass: "text-[#002e3b]",
    popular: true,
    onlineBankingUrl: "https://www.commerzbank.de",
  },
  {
    id: "volksbank",
    name: "Volksbanken Raiffeisenbanken (VR Banken)",
    shortName: "Volksbank",
    bic: "GENODED1",
    blz: "10090000",
    color: "#0066B2",
    bgClass: "bg-[#0066B2] text-white",
    textClass: "text-[#0066B2]",
    popular: true,
    onlineBankingUrl: "https://www.vr.de",
  },
  {
    id: "ing",
    name: "ING Deutschland (ING-DiBa)",
    shortName: "ING",
    bic: "INGDDEFFXXX",
    blz: "50010517",
    color: "#FF6200",
    bgClass: "bg-[#FF6200] text-white",
    textClass: "text-[#FF6200]",
    popular: true,
    onlineBankingUrl: "https://banking.ing.de",
  },
  {
    id: "postbank",
    name: "Postbank",
    shortName: "Postbank",
    bic: "PBNKDEFFXXX",
    blz: "10010010",
    color: "#FFCB00",
    bgClass: "bg-[#002B49] text-[#FFCB00]",
    textClass: "text-[#002B49]",
    popular: true,
    onlineBankingUrl: "https://banking.postbank.de",
  },
  {
    id: "dkb",
    name: "DKB (Deutsche Kreditbank)",
    shortName: "DKB",
    bic: "BYLADEM1100",
    blz: "12030000",
    color: "#005A9C",
    bgClass: "bg-[#005A9C] text-white",
    textClass: "text-[#005A9C]",
    popular: true,
    onlineBankingUrl: "https://www.dkb.de",
  },
  {
    id: "santander",
    name: "Santander Consumer Bank",
    shortName: "Santander",
    bic: "SCFBDE33XXX",
    blz: "31010833",
    color: "#EC0000",
    bgClass: "bg-[#EC0000] text-white",
    textClass: "text-[#EC0000]",
    popular: true,
    onlineBankingUrl: "https://www.santander.de",
  },
  {
    id: "n26",
    name: "N26 Bank (Berlin)",
    shortName: "N26",
    bic: "NTSBDEB1XXX",
    blz: "10011001",
    color: "#36A18B",
    bgClass: "bg-[#1B2727] text-[#36A18B]",
    textClass: "text-[#36A18B]",
    popular: true,
    onlineBankingUrl: "https://app.n26.com",
  },
  {
    id: "hypovereinsbank",
    name: "HypoVereinsbank (UniCredit)",
    shortName: "HVB",
    bic: "HYVEDEMMXXX",
    blz: "70020270",
    color: "#D40026",
    bgClass: "bg-[#D40026] text-white",
    textClass: "text-[#D40026]",
    onlineBankingUrl: "https://www.hypovereinsbank.de",
  },
  {
    id: "sparda",
    name: "Sparda-Bank (Berlin / Bundesweit)",
    shortName: "Sparda-Bank",
    bic: "SPARDE",
    blz: "12096597",
    color: "#003366",
    bgClass: "bg-[#003366] text-white",
    textClass: "text-[#003366]",
    onlineBankingUrl: "https://www.sparda-b.de",
  },
  {
    id: "targobank",
    name: "TARGOBANK",
    shortName: "Targobank",
    bic: "CITIDE55XXX",
    blz: "30020900",
    color: "#002B49",
    bgClass: "bg-[#002B49] text-white",
    textClass: "text-[#002B49]",
    onlineBankingUrl: "https://www.targobank.de",
  },
  {
    id: "other",
    name: "Andere deutsche Bank (Sonstige)",
    shortName: "Andere Bank",
    bic: "SCFBDE33XXX",
    color: "#121212",
    bgClass: "bg-[#121212] text-white",
    textClass: "text-ink",
    onlineBankingUrl: "https://www.bundesbank.de",
  },
];

export function findGermanBank(id: string | null | undefined): GermanBank {
  return GERMAN_BANKS.find((b) => b.id === id) || GERMAN_BANKS[0];
}

