/** Options d'étage (panier et gestion d'adresses) : la montée est comprise dans la livraison offerte. */
export const FLOOR_OPTIONS = [
  { value: 0, short: "Rez-de-chaussée", long: "Rez-de-chaussée" },
  { value: 1, short: "1er étage", long: "1er étage" },
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ value: n, short: `${n}ème étage`, long: `${n}ème étage` })),
];
