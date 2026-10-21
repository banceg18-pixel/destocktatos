/**
 * Téléphones : numéros français uniquement, saisis sans indicatif (06 12 34 56 78). Un numéro collé
 * avec +33 ou 0033 est accepté et ramené au format français ; un numéro étranger est refusé.
 */
export const FR_PHONE_HINT = "Numéro de téléphone français à 10 chiffres, par exemple 06 12 34 56 78.";

export function normalizeFrPhone(value: string) {
  let s = value.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+33")) s = `0${s.slice(3)}`;
  else if (s.startsWith("0033")) s = `0${s.slice(4)}`;
  s = s.replace(/^00?(?=0[1-9])/, "");
  return /^0[1-9]\d{8}$/.test(s) ? s.replace(/(\d{2})(?=\d)/g, "$1 ") : value.trim();
}

export function isFrPhone(value: string) {
  return /^0[1-9](?: \d{2}){4}$/.test(normalizeFrPhone(value));
}
