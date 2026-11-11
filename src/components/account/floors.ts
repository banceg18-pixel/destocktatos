/** Etagen-Optionen (Warenkorb und Adressverwaltung) */
export const FLOOR_OPTIONS = [
  { value: 0, short: "Erdgeschoss", long: "Erdgeschoss" },
  { value: 1, short: "1. Etage", long: "1. Etage" },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, short: `${n}. Etage`, long: `${n}. Etage` })),
];
