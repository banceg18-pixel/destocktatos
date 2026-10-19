import type { SortKey } from "@/types/catalog";
import { PRICE_MAX_DEFAULT } from "./constants";

/** Filtres du catalogue tels qu'ils apparaissent dans l'URL (partageable, indexable). */
export interface CatalogQuery {
  page: number;
  categorie: string;
  sousCategorie: string;
  prixMin: number;
  prixMax: number;
  recherche: string;
  promotions: boolean;
  tri: SortKey;
}

type RawParams = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";
const num = (v: string, fallback: number) => {
  const n = Number(v);
  return v !== "" && Number.isFinite(n) ? n : fallback;
};
const SORTS: SortKey[] = ["recent", "prix-asc", "prix-desc", "remise"];

export function parseCatalogQuery(sp: RawParams): CatalogQuery {
  const tri = one(sp.tri) as SortKey;
  return {
    page: Math.max(1, Math.floor(num(one(sp.page), 1))),
    categorie: one(sp.categorie).trim().toLowerCase(),
    sousCategorie: one(sp.sousCategorie).trim().toLowerCase(),
    prixMin: Math.max(0, num(one(sp.prixMin), 0)),
    prixMax: Math.max(0, num(one(sp.prixMax), PRICE_MAX_DEFAULT)),
    recherche: one(sp.recherche).trim(),
    promotions: one(sp.promotions) === "1",
    tri: SORTS.includes(tri) ? tri : "recent",
  };
}

/** URL du catalogue avec des filtres modifiés ; tout changement de filtre revient en page 1. */
export function catalogHref(basePath: string, q: CatalogQuery, change: Partial<CatalogQuery> = {}) {
  const next = { ...q, ...(("page" in change) ? {} : { page: 1 }), ...change };
  const p = new URLSearchParams();
  if (next.recherche) p.set("recherche", next.recherche);
  if (next.categorie && !basePath.startsWith("/categorie/")) p.set("categorie", next.categorie);
  if (next.sousCategorie) p.set("sousCategorie", next.sousCategorie);
  if (next.prixMin > 0) p.set("prixMin", String(next.prixMin));
  if (next.prixMax < PRICE_MAX_DEFAULT) p.set("prixMax", String(next.prixMax));
  if (next.promotions) p.set("promotions", "1");
  if (next.tri !== "recent") p.set("tri", next.tri);
  if (next.page > 1) p.set("page", String(next.page));
  const qs = p.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export const SORT_LABELS: Record<SortKey, string> = {
  recent: "Nouveautés",
  "prix-asc": "Prix croissant",
  "prix-desc": "Prix décroissant",
  remise: "Meilleures remises",
};

export const PRICE_RANGES: { label: string; min: number; max: number }[] = [
  { label: "Moins de 300 €", min: 0, max: 300 },
  { label: "300 à 600 €", min: 300, max: 600 },
  { label: "600 à 1 000 €", min: 600, max: 1000 },
  { label: "Plus de 1 000 €", min: 1000, max: PRICE_MAX_DEFAULT },
];
