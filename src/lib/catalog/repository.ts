import "server-only";
import type { Category as DbCategory, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { invalidateMemo, memo } from "@/lib/server/memo";
import { bumpVersion, syncCaches } from "@/lib/server/sync-version";
import { toEuros } from "@/lib/money";
import { normalize } from "@/lib/text";
import type { Category, Product, ProductFilters, ProductListResult } from "@/types/catalog";
import sousCategoriesData from "../../../data/content/sous-categories.json";

import { PAGE_SIZE, PRICE_MAX_DEFAULT } from "./constants";
export { PAGE_SIZE, PRICE_MAX_DEFAULT };

const productInclude = {
  category: true,
  images: { orderBy: { position: "asc" } },
} satisfies Prisma.ProductInclude;

type DbProduct = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

const asArray = (v: Prisma.JsonValue | null | undefined): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

const asObject = <T>(v: Prisma.JsonValue | null | undefined): T | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as unknown as T) : null;

export function mapProduct(p: DbProduct, resume?: { nombreAvis: number; noteMoyenne: number }): Product {
  return {
    _id: p.id,
    slug: p.slug,
    titre: p.titre,
    marque: p.marque,
    modele: p.modele,
    prix: toEuros(p.prixCents),
    promotionPrix: p.promotionPrixCents != null ? toEuros(p.promotionPrixCents) : null,
    caracteristiques: asObject(p.caracteristiques) ?? {},
    description: p.description,
    imagePrincipale: p.imagePrincipale ? { url: p.imagePrincipale } : null,
    images: p.images.map((i) => ({ url: i.url, _id: i.id })),
    etiquetteEnergie: p.etiquetteEnergie ? { url: p.etiquetteEnergie } : null,
    stock: p.stock,
    categorie: p.category.nom,
    sousCategorie: asArray(p.sousCategories),
    magasin: p.magasin,
    garantie: asObject(p.garantie),
    pose: p.pose,
    couleur: asArray(p.couleurs),
    connecter: p.connecter,
    vedette: p.vedette,
    sonore: p.sonore,
    resumeAvis: resume ?? { nombreAvis: 0, noteMoyenne: 0 },
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    metaTitle: p.metaTitle,
    metaDescription: p.metaDescription,
  };
}


/* ------------------------------------------------------------------------------------------------
 * Instantané du catalogue
 * Tout le catalogue (≈ 600 produits) tient en mémoire : il est lu en base au plus une fois par
 * minute et partagé par toutes les requêtes. Les filtres, la recherche et les tris se font ensuite
 * en mémoire, sans requête SQL. Les écritures (commandes, avis, synchronisation WordPress)
 * appellent `invalidateCatalog()` pour que la lecture suivante reparte de la base.
 * ---------------------------------------------------------------------------------------------- */

// Réglable (CATALOG_CACHE_TTL_MS=0 désactive le cache, utile si la base est modifiée hors du site).
const CATALOG_TTL_MS = Number(process.env.CATALOG_CACHE_TTL_MS ?? 60_000);

interface Snapshot {
  /** Plus récents d'abord. */
  products: Product[];
  bySlug: Map<string, Product>;
  byId: Map<string, Product>;
  /** Texte de recherche normalisé (titre, marque, modèle, slug) par identifiant. */
  haystack: Map<string, string>;
  dbCategories: DbCategory[];
  categories: Category[];
}

/** Prix réellement payé, en centimes (promotion comprise si elle est valide). */
const effectiveCents = (p: Product) => Math.round((p.promotionPrix && p.promotionPrix > 0 && p.promotionPrix < p.prix ? p.promotionPrix : p.prix) * 100);
const discountRatio = (p: Product) => (p.prix > 0 ? 1 - effectiveCents(p) / Math.round(p.prix * 100) : 0);
const hasPromotion = (p: Product) => p.promotionPrix != null && p.promotionPrix > 0;

function buildCategories(cats: DbCategory[], products: Product[]): Category[] {
  // Disponibilité et prix d'entrée par catégorie (navigation, cartes de l'accueil).
  const stats = new Map<string, { count: number; min: number }>();
  for (const p of products) {
    if (p.stock <= 0) continue;
    const s = stats.get(p.categorie) ?? { count: 0, min: Infinity };
    s.count++;
    s.min = Math.min(s.min, effectiveCents(p));
    stats.set(p.categorie, s);
  }
  return cats.map((c) => {
    // Badges du carrousel : état du produit représentatif (même image que la catégorie).
    const rep = c.image ? products.find((p) => p.imagePrincipale?.url === c.image && p.categorie === c.nom) : undefined;
    const s = stats.get(c.nom);
    return {
      slug: c.slug,
      nom: c.nom,
      ordre: c.ordre,
      image: c.image,
      vedette: rep?.vedette ?? false,
      promotion: rep ? hasPromotion(rep) : false,
      imageAlt: rep ? `${c.nom} - ${rep.titre}` : c.nom,
      count: s?.count ?? 0,
      prixMin: s ? s.min / 100 : null,
    };
  });
}

async function readSnapshot(): Promise<Snapshot> {
  const [rows, dbCategories, reviews] = await Promise.all([
    prisma.product.findMany({ include: productInclude, orderBy: { createdAt: "desc" } }),
    prisma.category.findMany({ orderBy: { ordre: "asc" } }),
    prisma.review.groupBy({ by: ["productId"], _count: { _all: true }, _avg: { note: true } }),
  ]);
  const summaries = new Map(reviews.map((r) => [r.productId, { nombreAvis: r._count._all, noteMoyenne: Math.round((r._avg.note ?? 0) * 10) / 10 }]));
  const products = rows.map((r) => mapProduct(r, summaries.get(r.id)));
  return {
    products,
    bySlug: new Map(products.map((p) => [p.slug, p])),
    byId: new Map(products.map((p) => [p._id, p])),
    haystack: new Map(products.map((p) => [p._id, normalize([p.titre, p.marque, p.modele, p.slug].join(" "))])),
    dbCategories,
    categories: buildCategories(dbCategories, products),
  };
}

const snapshot = async () => {
  await syncCaches();
  return memo("catalog:snapshot", CATALOG_TTL_MS, readSnapshot);
};

/**
 * À appeler après toute écriture qui touche le catalogue (stock, prix, avis, catégories) : cache vidé
 * ici tout de suite, et dans les autres copies du site sous 2 s (version partagée en base).
 */
export function invalidateCatalog() {
  invalidateMemo("catalog:");
  void bumpVersion("catalog");
}

/** Correspondance de recherche : sans casse ni accents, sur titre, marque, modèle et slug. */
function searcher(s: Snapshot, q: string) {
  const needle = normalize(q);
  if (!needle) return () => true;
  return (p: Product) => (s.haystack.get(p._id) ?? "").includes(needle);
}

/** Liste paginée de la boutique (filtres identiques aux paramètres d'URL du site source). */
export async function listProducts(filters: ProductFilters = {}): Promise<ProductListResult> {
  const s = await snapshot();
  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const limit = Math.min(100, Math.max(1, Math.floor(filters.limit ?? PAGE_SIZE)));
  const sc = filters.sousCategorie ? normalize(filters.sousCategorie) : null;
  const match = filters.recherche ? searcher(s, filters.recherche) : null;
  // Prix : on filtre et trie sur le prix réellement payé (promotion comprise).
  const min = filters.prixMin && filters.prixMin > 0 ? Math.round(filters.prixMin * 100) : null;
  const max = filters.prixMax != null && filters.prixMax < PRICE_MAX_DEFAULT ? Math.round(filters.prixMax * 100) : null;

  const rows = s.products.filter(
    (p) =>
      (filters.inStockOnly === false || p.stock > 0) &&
      (!filters.categorie || p.categorie === filters.categorie) &&
      (!filters.promotions || hasPromotion(p)) &&
      (!sc || p.sousCategorie.some((x) => normalize(x) === sc)) &&
      (!match || match(p)) &&
      (min == null || effectiveCents(p) >= min) &&
      (max == null || effectiveCents(p) <= max),
  );
  if (filters.tri === "prix-asc") rows.sort((a, b) => effectiveCents(a) - effectiveCents(b));
  else if (filters.tri === "prix-desc") rows.sort((a, b) => effectiveCents(b) - effectiveCents(a));
  else if (filters.tri === "remise") rows.sort((a, b) => discountRatio(b) - discountRatio(a));

  const total = rows.length;
  return {
    produits: rows.slice((page - 1) * limit, page * limit),
    page,
    totalPages: Math.ceil(total / limit),
    total,
    sousCategories: getSousCategories(),
  };
}

export async function searchProducts(q: string, limit = 5): Promise<Product[]> {
  if (normalize(q).length < 2) return [];
  const s = await snapshot();
  return s.products.filter(searcher(s, q)).slice(0, Math.min(50, limit));
}

export async function getProductBySlug(slugOrId: string): Promise<Product | null> {
  const s = await snapshot();
  return s.bySlug.get(slugOrId) ?? s.byId.get(slugOrId) ?? null;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  const s = await snapshot();
  return ids.map((id) => s.byId.get(id)).filter((p): p is Product => !!p);
}

/** Produits « vedette » (accueil : sélection, cartes mises en avant). */
export async function getFeaturedProducts(limit = 10, onlyAvailable = false): Promise<Product[]> {
  const s = await snapshot();
  return s.products.filter((p) => p.vedette && (!onlyAvailable || p.stock > 0)).slice(0, Math.min(50, limit));
}

/** Derniers produits ajoutés. */
export async function getLatestProducts(limit = 20): Promise<Product[]> {
  return (await snapshot()).products.slice(0, Math.min(50, limit));
}

/** Suggestions : produits disponibles de la même catégorie, hors produit courant (plus anciens d'abord, comme observé sur la source). */
export async function getSuggestions(productId: string, categorie: string, limit = 8): Promise<Product[]> {
  const s = await snapshot();
  return s.products
    .filter((p) => p._id !== productId && p.categorie === categorie && p.stock > 0)
    .reverse()
    .slice(0, Math.min(24, limit));
}

export async function getProductsByCategory(categorie: string, limit?: number): Promise<Product[]> {
  const rows = (await snapshot()).products.filter((p) => p.categorie === categorie);
  return limit != null ? rows.slice(0, limit) : rows;
}

export async function getPromotionProducts(limit?: number, onlyAvailable = false): Promise<Product[]> {
  const rows = (await snapshot()).products.filter((p) => hasPromotion(p) && (!onlyAvailable || p.stock > 0));
  return limit != null ? rows.slice(0, limit) : rows;
}

export async function getCategories(): Promise<Category[]> {
  return (await snapshot()).categories;
}

export async function getCategoryBySlug(slug: string) {
  return (await snapshot()).dbCategories.find((c) => c.slug === slug) ?? null;
}

export function getSousCategories(): Record<string, string[]> {
  return sousCategoriesData as Record<string, string[]>;
}

export async function getAllProductSlugs() {
  return (await snapshot()).products.map((p) => ({ slug: p.slug, updatedAt: new Date(p.updatedAt) }));
}

/** Chiffres réels du catalogue (accueil) : produits disponibles et nombre de marques. */
export async function getCatalogStats() {
  const available = (await snapshot()).products.filter((p) => p.stock > 0);
  return { available: available.length, brands: new Set(available.map((p) => p.marque.trim().toUpperCase())).size };
}

/** Marques en stock, des plus représentées aux moins représentées (assistant du site). */
export async function getAvailableBrands(): Promise<string[]> {
  const counts = new Map<string, number>();
  for (const p of (await snapshot()).products) {
    if (p.stock <= 0) continue;
    const b = p.marque.replace(/\s+/g, " ").trim().toUpperCase();
    if (b && b.length <= 20 && !/\d/.test(b)) counts.set(b, (counts.get(b) ?? 0) + 1);
  }
  return [...counts].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([b]) => b);
}
