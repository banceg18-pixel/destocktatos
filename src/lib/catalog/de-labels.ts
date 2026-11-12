/**
 * Libellés allemands du catalogue : mapping des noms de catégories français du WordPress en
 * ligne vers les libellés allemands du dépôt, et gabarits de titre/description allemands pour
 * les produits (le WordPress en ligne peut encore contenir des textes français).
 * Les slugs restent inchangés (identifiants d'URL stables).
 */

export const CATEGORY_DE: Record<string, string> = {
  "réfrigérateur": "Kühlschrank",
  refrigerateur: "Kühlschrank",
  congélateur: "Gefrierschrank",
  congelateur: "Gefrierschrank",
  "lave-linge": "Waschmaschine",
  "sèche-linge": "Wäschetrockner",
  "seche-linge": "Wäschetrockner",
  "lave-vaisselle": "Geschirrspüler",
  cuisinière: "Herd",
  cuisiniere: "Herd",
  four: "Backofen",
  "plaque de cuisson": "Kochfeld",
  "micro-ondes": "Mikrowelle",
  hotte: "Dunstabzugshaube",
  aspirateur: "Staubsauger",
  climatiseur: "Klimagerät",
  autres: "Weitere",
  "robot de cuisine": "Küchenmaschine",
  "plaque à gaz": "Gaskochfeld",
  "plaque a gaz": "Gaskochfeld",
  télévision: "Fernseher",
  television: "Fernseher",
};

const normalizeKey = (s: string) => s.trim().toLowerCase();

export const categoryNameOf = (nom: string) => CATEGORY_DE[normalizeKey(nom)] ?? nom;

const TITLE_DE: [RegExp, string][] = [
  [/(?<![A-Za-zÀ-ÿ])(?:R[ÉE]FRIG[ÉE]RATEUR)(?![A-Za-zÀ-ÿ])/i, "Kühlschrank"],
  [/(?<![A-Za-zÀ-ÿ])(?:CONG[ÉE]LATEUR)(?![A-Za-zÀ-ÿ])/i, "Gefrierschrank"],
  [/(?<![A-Za-zÀ-ÿ])(?:LAVE[\s-]?LINGE)(?![A-Za-zÀ-ÿ])/i, "Waschmaschine"],
  [/(?<![A-Za-zÀ-ÿ])(?:S[ÈE]CHE?[\s-]?LINGE)(?![A-Za-zÀ-ÿ])/i, "Wäschetrockner"],
  [/(?<![A-Za-zÀ-ÿ])(?:LAVE[\s-]?VAISSELLE)(?![A-Za-zÀ-ÿ])/i, "Geschirrspüler"],
  [/(?<![A-Za-zÀ-ÿ])(?:CUISINI[ÈE]RE)(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(?:GAZINI[ÈE]RE)(?![A-Za-zÀ-ÿ])/i, "Herd"],
  [/(?<![A-Za-zÀ-ÿ])(?:FOUR)(?![A-Za-zÀ-ÿ])/i, "Backofen"],
  [/(?<![A-Za-zÀ-ÿ])(?:HOTTE)(?![A-Za-zÀ-ÿ])/i, "Dunstabzugshaube"],
  [/(?<![A-Za-zÀ-ÿ])(?:ASPIRATEUR)(?![A-Za-zÀ-ÿ])/i, "Staubsauger"],
  [/(?<![A-Za-zÀ-ÿ])(?:CLIMATISEUR)(?![A-Za-zÀ-ÿ])/i, "Klimagerät"],
  [/(?<![A-Za-zÀ-ÿ])(?:T[ÉE]L[ÉE]VISION)(?![A-Za-zÀ-ÿ])/i, "TV"],
  [/(?<![A-Za-zÀ-ÿ])(?:POUCES)(?![A-Za-zÀ-ÿ])/i, "Zoll"],
  [/(?<![A-Za-zÀ-ÿ])(?:ENCASTRABLE)(?![A-Za-zÀ-ÿ])/i, "Einbaugerät"],
  [/(?<![A-Za-zÀ-ÿ])(?:COUVERTS?)(?![A-Za-zÀ-ÿ])/i, "Maßgedecke"],
  [/(?<![A-Za-zÀ-ÿ])(?:POSE LIBRE)(?![A-Za-zÀ-ÿ])/i, "freistehend"],
  [/(?<![A-Za-zÀ-ÿ])(?:COMBIN[ÉE])(?![A-Za-zÀ-ÿ])/i, "Kombigerät"],
  [/(?<![A-Za-zÀ-ÿ])(?:MULTIFONCTION)(?![A-Za-zÀ-ÿ])/i, "Multifunktion"],
  [/(?<![A-Za-zÀ-ÿ])(?:PYROLYSE)(?![A-Za-zÀ-ÿ])/i, "Pyrolyse"],
  [/(?<![A-Za-zÀ-ÿ])(?:INOX)(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(?:ANTITRACE)(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(?:ANTI-TRACE)(?![A-Za-zÀ-ÿ])/i, "Edelstahl"],
  [/(?<![A-Za-zÀ-ÿ])(?:NOIR)(?![A-Za-zÀ-ÿ])/i, "schwarz"],
  [/(?<![A-Za-zÀ-ÿ])(?:BLANC)(?![A-Za-zÀ-ÿ])/i, "weiß"],
  [/(?<![A-Za-zÀ-ÿ])(?:SILENCIEUX)(?![A-Za-zÀ-ÿ])/i, "leise"],
  [/(?<![A-Za-zÀ-ÿ])(?:FRONTAL)(?![A-Za-zÀ-ÿ])/i, "Frontlader"],
  [/(?<![A-Za-zÀ-ÿ])(?:HUBLOT)(?![A-Za-zÀ-ÿ])/i, "Frontlader"],
  [/(?<![A-Za-zÀ-ÿ])(?:POMPE [ÀA] CHALEUR)(?![A-Za-zÀ-ÿ])/i, "Wärmepumpe"],
  [/(?<![A-Za-zÀ-ÿ])(?:CONDENSATION)(?![A-Za-zÀ-ÿ])/i, "Kondensation"],
  [/(?<![A-Za-zÀ-ÿ])(?:INT[ÉE]GR[ÉE])(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(?:INT[ÉE]GRABLE)(?![A-Za-zÀ-ÿ])/i, "integrierbar"],
  [/(?<![A-Za-zÀ-ÿ])(?:PORTES?)(?![A-Za-zÀ-ÿ])/i, "Türen"],
  [/(?<![A-Za-zÀ-ÿ])(?:CLASSE)(?![A-Za-zÀ-ÿ])/i, "Klasse"],
  [/(?<![A-Za-zÀ-ÿ])(?:[ÉE]NERG[ÉE]TIQUE)(?![A-Za-zÀ-ÿ])/i, "Energie"],
  [/(?<![A-Za-zÀ-ÿ])(?:[ÉE]CONOMIQUE)(?![A-Za-zÀ-ÿ])/i, "sparsam"],
  [/(?<![A-Za-zÀ-ÿ])(?:CONNECT[ÉE])(?![A-Za-zÀ-ÿ])/i, "Smart"],
  [/(?<![A-Za-zÀ-ÿ])(?:CFROST)(?![A-Za-zÀ-ÿ])|(?<![A-Za-zÀ-ÿ])(?:NO FROST)(?![A-Za-zÀ-ÿ])/i, "No Frost"],
  [/(?<![A-Za-zÀ-ÿ])(?:GRILLE[\s-]?PAIN)(?![A-Za-zÀ-ÿ])/i, "Toaster"],
  [/(?<![A-Za-zÀ-ÿ])(?:PURIFICATEUR D'AIR)(?![A-Za-zÀ-ÿ])/i, "Luftreiniger"],
  [/(?<![A-Za-zÀ-ÿ])(?:MACHINE [ÀA] CAF[ÉE])(?![A-Za-zÀ-ÿ])/i, "Kaffeemaschine"],
  [/(?<![A-Za-zÀ-ÿ])(?:CAVE [ÀA] VIN)(?![A-Za-zÀ-ÿ])/i, "Weinkühlschrank"],
];

// Marqueurs français des phrases produits (évite la dépendance avec cms/lang-guard).
const FRENCH_MARKERS =
  /(livraison|livré|commande|panier|votre|vous|merci|bienvenue|quantité|réduction|afficher|masquer|électroménager|garantie légale|rétractation|prix|avec|sans|pour|dans|grâce|idéal|durable|conçu|quotidien|fonctionne|chauffe|cuisson|nettoyage|capacité|consommation|température|pièce|œuvre|déplacement|performance|silencieux|économique|durabilité|confort|couleur|couleurs|fabricant|réfrigérateur|refrigérateur|congélateur|combiné|machine à laver|machine a laver|essorage|lavage|séchage|tour|tours|min pour|livrer|portière|tiroir|tiroirs|étagère|étagères|clayette|dégivrage|froid|brassé|ventile|est conçu|idéal pour|majeure|est un)/i;

export function germanProductTexts(p: {
  titre: string;
  marque: string;
  description: string;
  categorie: string;
  caracteristiques?: { largeur?: number; poids?: number } | null;
  garantie: { duree: number; descriptif: string } | null;
}): { titre: string; description: string; garantie: { duree: number; descriptif: string } | null } {
  let titre = p.titre ?? "";
  for (const [re, by] of TITLE_DE) titre = titre.replace(re, by);
  titre = titre.replace(/\s{2,}/g, " ").trim();

  // Description : si elle est encore française, gabarit allemand à partir des données objectives.
  const description = FRENCH_MARKERS.test(p.description ?? "") ? describeDe(p) : p.description || "";

  const garantie = p.garantie
    ? { duree: p.garantie.duree, descriptif: /monat|jahr|garantie/i.test(p.garantie.descriptif ?? "") ? p.garantie.descriptif : `Garantie ${p.garantie.duree} Monate` }
    : null;

  return { titre, description, garantie };
}

/** Description allemande courte pour un produit, à partir du type et des caractéristiques. */
export function describeDe(p: {
  marque: string;
  categorie: string;
  caracteristiques?: { largeur?: number; poids?: number } | null;
  garantie?: { duree: number } | null;
}): string {
  const name = categoryNameOf(p.categorie);
  const mar = p.marque?.trim() ?? "";
  const head = `${mar} ${name}`.trim();
  const claim =
    CLAIMS[normalizeKey(p.categorie).replace(/\s+/g, "-")] ??
    CLAIMS[normalizeKey(p.categorie)] ??
    "erleichtert den Haushaltsalltag – praktisch und zuverlässig.";
  let d = `${head}: ${claim}`;
  const bits: string[] = [];
  if (p.caracteristiques?.largeur) bits.push(`${String(p.caracteristiques.largeur).replace(".", ",")} cm breit`);
  if (p.caracteristiques?.poids) bits.push(`${String(p.caracteristiques.poids).replace(".", ",")} kg schwer`);
  if (bits.length) d += ` Maße: ${bits.join(", ")}.`;
  if (p.garantie?.duree) d += ` Garantie: ${p.garantie.duree} Monate.`;
  return d;
}

const CLAIMS: Record<string, string> = {
  refrigerateur: "kühlt zuverlässig und leise – ideal für den täglichen Gebrauch.",
  congelateur: "gefriert zuverlässig und bietet viel Stauraum.",
  "lave-linge": "wäscht effizient und schonend bei niedrigem Verbrauch.",
  "seche-linge": "trocknet schonend und energieeffizient.",
  "lave-vaisselle": "spült gründlich und leise – spart Zeit und Wasser.",
  cuisiniere: "vereint Backofen und Kochfeld für flexibles Kochen.",
  four: "backet und gart gleichmäßig – von Brot bis Braten.",
  "plaque-de-cuisson": "heizt schnell und präzise – leicht zu reinigen.",
  "plaque-a-gaz": "bietet sofort einsatzbereite Gasflammen.",
  "micro-ondes": "erwärmt und auftaut schnell und gleichmäßig.",
  hotte: "hält die Küchenluft sauber und leise.",
  aspirateur: "saugt gründlich auf allen Böden – auch Tierhaare.",
  climatiseur: "kühlt zuverlässig bei leisem Betrieb.",
  "robot-de-cuisine": "rührt, hackt und mixt – ein Alleskönner in der Küche.",
  television: "liefert ein scharfes Bild und klaren Klang.",
  autres: "erleichtert den Haushaltsalltag – praktisch und zuverlässig.",
};
