/** Options d'étage (libellés identiques au site source : panier et gestion d'adresses). */
export const FLOOR_OPTIONS = [
  { value: 0, short: "Rez-de-chaussée", long: "Rez-de-chaussée" },
  { value: 1, short: "1er étage", long: "1er étage" },
  { value: 2, short: "2ème étage", long: "2ème étage" },
  { value: 3, short: "3ème étage (+10€)", long: "3ème étage (+10€)" },
  ...[4, 5, 6, 7, 8, 9, 10].map((n) => ({
    value: n,
    short: `${n}ème étage (+10€ + ${(n - 3) * 10}€/étage si ≥20kg)`,
    long: `${n}ème étage (+10€ + ${(n - 3) * 10}€/étage si commande ≥ 20kg)`,
  })),
];
