/**
 * Nom et coordonnées de la société dans les contenus : les textes repris de l'ancien site (TATOS)
 * sont présentés au nom de Destocktatos, avec sa boîte email et son hébergeur réel. Appliqué aux
 * contenus lus dans WordPress (filet de sécurité : l'extension corrige aussi ses propres contenus).
 */
const REPLACEMENTS: [RegExp, string][] = [
  [/tatos-electromenager@[a-z0-9.-]+\.[a-z]{2,}/gi, "contacts@destocktatos.com"],
  [/\bTATOS\b/g, "Destocktatos"],
  [/Example Hosting<br\s*\/?>456 avenue du Web<br\s*\/?>69000 Lyon, France<br\s*\/?>Téléphone : \+33 \(0\)4 56 78 90 12/g, "Hostinger International Ltd<br/>61 Lordou Vironos Street<br/>6023 Larnaca, Chypre<br/>Site : www.hostinger.fr"],
  [/Example Hosting/g, "Hostinger International Ltd"],
];

export function rebrandText(s: string) {
  let out = s;
  for (const [re, by] of REPLACEMENTS) out = out.replace(re, by);
  return out;
}

/** Applique `rebrandText` à toutes les chaînes d'une valeur (objets et tableaux compris). */
export function rebrand<T>(value: T): T {
  if (typeof value === "string") return rebrandText(value) as T;
  if (Array.isArray(value)) return value.map((v) => rebrand(v)) as T;
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, rebrand(v)])) as T;
  return value;
}
