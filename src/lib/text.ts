/** Normalisation pour les recherches : minuscules, sans accents. */
export function normalize(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

/** Slug d'URL (catégories) : "plaque à gaz" -> "plaque-a-gaz". */
export function slugify(value: string): string {
  return normalize(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Titre produit homogène à l'affichage : les titres saisis tout en majuscules passent en casse de
 * phrase (références, mesures et marque conservées), et la première lettre est toujours capitale.
 */
export function displayTitle(title: string, brand?: string): string {
  const t = title.replace(/\s+/g, " ").trim();
  if (!t) return t;
  const letters = t.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const shouting = letters.length > 3 && letters === letters.toUpperCase();
  const out = shouting
    ? t
        .split(" ")
        .map((w, i) => {
          if (/\d/.test(w)) return w; // référence ou mesure : « F94N15WHS », « 13KG »
          if (brand && w.toUpperCase() === brand.toUpperCase()) return w; // marque
          const lower = w.toLowerCase();
          return i === 0 ? lower.charAt(0).toUpperCase() + lower.slice(1) : lower;
        })
        .join(" ")
    : t;
  return out.charAt(0).toUpperCase() + out.slice(1);
}
