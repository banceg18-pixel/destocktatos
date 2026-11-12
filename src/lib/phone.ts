/**
 * Telefonnummern: deutsche Nummern, eingegeben ohne Vorwahl (030 123456789 oder +49 30 123456789).
 * Eine mit +49 oder 0049 eingegebene Nummer wird akzeptiert und in das deutsche Format umgewandelt.
 * Alte französische Nummern (06 12 34 56 78, +33…), die vor der Umstellung erfasst wurden,
 * bleiben als solche erkennbar (normalisiert), damit bestehende Kundenkonten weiter funktionieren.
 */
export const DE_PHONE_HINT = "Deutsche Telefonnummer (z.B. 030 12345678 oder +49 30 12345678).";

export function normalizeFrPhone(value: string) {
  let s = value.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+33")) s = `0${s.slice(3)}`;
  else if (s.startsWith("0033")) s = `0${s.slice(4)}`;
  s = s.replace(/^00?(?=0[1-9])/, "");
  return /^0[1-9]\d{8}$/.test(s) ? s.replace(/(\d{2})(?=\d)/g, "$1 ") : normalizeDePhone(value);
}

export function normalizeDePhone(value: string) {
  let s = value.replace(/[\s.\-()]/g, "");
  if (s.startsWith("+49")) s = `0${s.slice(3)}`;
  else if (s.startsWith("0049")) s = `0${s.slice(4)}`;
  return s;
}

/** Alte (französische) Nummer? Nur für bestehende Konten relevant. */
export function isFrPhone(value: string) {
  const norm = normalizeFrPhone(value);
  return /^0[1-9](?: \d{2}){4}$/.test(norm) || isDePhone(value);
}

export function isDePhone(value: string) {
  const s = normalizeDePhone(value);
  return /^0[1-9]\d{8,11}$/.test(s);
}
