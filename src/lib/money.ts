/** Conversions monétaires : la base stocke des centimes entiers, l'API expose des euros. */
export const toCents = (euros: number) => Math.round(euros * 100);
export const toEuros = (cents: number) => Math.round(cents) / 100;

const EUR = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format unique des prix sur tout le site (panier, paiement, factures…) : « 1 299,00 € ». */
export const formatEuros = (euros: number) => EUR.format(euros);

/** Réduction en pourcentage arrondie (« -23 % »), 0 si pas de promotion valable. */
export const discountPercent = (prix: number, promo: number | null | undefined) =>
  promo != null && promo > 0 && promo < prix ? Math.round(((prix - promo) / prix) * 100) : 0;
