import "server-only";
import { rebrandText } from "@/lib/brand";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/text";

/**
 * Synchronisation WordPress -> base locale (catalogue).
 * WordPress est la source éditoriale des produits ; la base locale reste la source de vérité
 * commerciale (stock réservé, commandes, prix facturés). Le webhook WordPress déclenche cette
 * synchronisation ; le stock n'est écrasé que si WP_SYNC_STOCK=true (sinon géré par les commandes).
 */
interface WpCategory {
  slug: string;
  nom: string;
  ordre: number;
  image: string | null;
}
interface WpProduct {
  id: string;
  slug: string;
  titre: string;
  marque: string;
  modele: string;
  prix: number;
  promotionPrix: number | null;
  stock: number;
  categorie: string;
  categorieSlug?: string;
  sousCategorie: string[];
  description: string;
  caracteristiques: Record<string, number>;
  garantie: { duree: number; descriptif: string } | null;
  pose: string | null;
  couleur: string[];
  connecter: boolean;
  vedette: boolean;
  magasin: boolean;
  sonore: number | null;
  imagePrincipale: string | null;
  images: string[];
  etiquetteEnergie: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  createdAt: string;
}

class WpNotFound extends Error {}

/** Les médias servis par le frontend local sont ramenés en chemins relatifs. */
function localize(url: string | null): string | null {
  if (!url) return null;
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  return url.startsWith(site) ? url.slice(site.length) : url;
}

async function wp<T>(endpoint: string): Promise<{ data: T; totalPages: number }> {
  const api = (process.env.WORDPRESS_API_URL || "").replace(/\/$/, "");
  if (!api) throw new Error("WORDPRESS_API_URL non défini");
  // Adresse unique : jamais de réponse gardée par LiteSpeed Cache ou le CDN de WordPress.
  const fresh = `_tatos=${Date.now().toString(36)}`;
  const res = await fetch(`${api}${endpoint}${endpoint.includes("?") ? "&" : "?"}${fresh}`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache" },
    cache: "no-store",
  });
  if (res.status === 404) throw new WpNotFound(`WordPress ${endpoint} -> HTTP 404`);
  if (!res.ok) throw new Error(`WordPress ${endpoint} -> HTTP ${res.status}`);
  return { data: (await res.json()) as T, totalPages: Number(res.headers.get("X-WP-TotalPages") || 1) };
}

/** Catégorie locale du produit (créée à la volée si WordPress en a ajouté une). */
async function categoryIdFor(p: WpProduct, cache: Map<string, string>): Promise<string> {
  const known = cache.get(p.categorie);
  if (known) return known;
  const slug = p.categorieSlug || slugify(p.categorie);
  const c = await prisma.category.upsert({ where: { slug }, update: {}, create: { slug, nom: p.categorie, ordre: 999 } });
  cache.set(p.categorie, c.id);
  return c.id;
}

async function upsertProduct(p: WpProduct, categoryId: string, syncStock: boolean) {
  const data = {
    slug: p.slug,
    titre: p.titre,
    marque: p.marque,
    modele: p.modele,
    prixCents: Math.round(p.prix * 100),
    promotionPrixCents: p.promotionPrix != null ? Math.round(p.promotionPrix * 100) : null,
    categoryId,
    sousCategories: p.sousCategorie ?? [],
    description: rebrandText(p.description ?? ""),
    caracteristiques: p.caracteristiques ?? {},
    garantie: p.garantie ?? undefined,
    pose: p.pose,
    couleurs: p.couleur ?? [],
    connecter: p.connecter,
    vedette: p.vedette,
    magasin: p.magasin,
    sonore: p.sonore,
    imagePrincipale: localize(p.imagePrincipale),
    etiquetteEnergie: localize(p.etiquetteEnergie),
    metaTitle: p.metaTitle ? rebrandText(p.metaTitle) : p.metaTitle,
    metaDescription: p.metaDescription ? rebrandText(p.metaDescription) : p.metaDescription,
  };
  await prisma.$transaction([
    prisma.product.upsert({
      where: { id: p.id },
      update: syncStock ? { ...data, stock: p.stock } : data,
      create: { id: p.id, ...data, stock: p.stock, createdAt: new Date(p.createdAt) },
    }),
    prisma.productImage.deleteMany({ where: { productId: p.id } }),
    prisma.productImage.createMany({
      data: (p.images ?? []).map((url, position) => ({ productId: p.id, url: localize(url)!, position })),
    }),
  ]);
}

/** Catégories seules (ordre, nom, image), après une modification dans WordPress. */
export async function syncCategoriesFromWordPress() {
  const { data: cats } = await wp<WpCategory[]>("/tatos/v1/categories");
  const catIds = new Map<string, string>();
  for (const c of cats) {
    const row = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nom: c.nom, ordre: c.ordre, image: localize(c.image) },
      create: { slug: c.slug, nom: c.nom, ordre: c.ordre, image: localize(c.image) },
    });
    catIds.set(c.nom, row.id);
  }
  return { categories: cats.length, catIds };
}

export async function syncCatalogFromWordPress(opts: { syncStock?: boolean } = {}) {
  const syncStock = opts.syncStock ?? process.env.WP_SYNC_STOCK === "true";
  const { categories: catCount, catIds } = await syncCategoriesFromWordPress();
  let page = 1;
  let totalPages = 1;
  let count = 0;
  do {
    const res = await wp<WpProduct[]>(`/tatos/v1/products?per_page=100&page=${page}`);
    totalPages = res.totalPages;
    for (const p of res.data) {
      await upsertProduct(p, await categoryIdFor(p, catIds), syncStock);
      count++;
    }
    page++;
  } while (page <= totalPages);
  return { categories: catCount, products: count };
}

/**
 * Synchronise un seul produit (webhook « product.updated »). Un produit absent ou dépublié côté
 * WordPress n'est pas supprimé (historique des commandes) : son stock passe à 0.
 */
export async function syncProductFromWordPress(id: string, opts: { syncStock?: boolean } = {}) {
  const syncStock = opts.syncStock ?? process.env.WP_SYNC_STOCK === "true";
  try {
    const { data: p } = await wp<WpProduct>(`/tatos/v1/products/${encodeURIComponent(id)}`);
    await upsertProduct(p, await categoryIdFor(p, new Map()), syncStock);
    return { id, status: "updated" as const };
  } catch (e) {
    if (!(e instanceof WpNotFound)) throw e;
    const { count } = await prisma.product.updateMany({ where: { id }, data: { stock: 0 } });
    return { id, status: count ? ("retired" as const) : ("unknown" as const) };
  }
}
