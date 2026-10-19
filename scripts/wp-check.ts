/**
 * Vérifie l'aller-retour local -> WordPress -> REST : compare champ par champ ce que renvoie
 * l'API du plugin « TATOS Headless » avec la base locale et data/content.
 *   WORDPRESS_API_URL=http://localhost:8080/wp-json npm run wp:check
 * Code de sortie 1 si au moins un écart est trouvé.
 */
import fs from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const API = (process.env.WORDPRESS_API_URL || "http://localhost:8080/wp-json").replace(/\/$/, "");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
const root = process.cwd();
const content = (f: string) => JSON.parse(fs.readFileSync(path.join(root, "data/content", f), "utf8"));
const abs = (p: string | null) => (p ? (p.startsWith("http") ? p : `${SITE}${p}`) : null);

const diffs: string[] = [];
function same(label: string, actual: unknown, expected: unknown) {
  if (!isDeepStrictEqual(actual, expected)) {
    diffs.push(`${label}\n    attendu : ${JSON.stringify(expected)?.slice(0, 200)}\n    obtenu  : ${JSON.stringify(actual)?.slice(0, 200)}`);
  }
}

async function get<T>(endpoint: string): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(`${API}${endpoint}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${endpoint} -> HTTP ${res.status}`);
  return { data: (await res.json()) as T, headers: res.headers };
}

type Block = { type: string; text?: string; items?: string[]; html?: string; level?: number };

async function main() {
  const settings = (await get<Record<string, unknown>>("/tatos/v1/settings")).data;
  const localSettings = content("site.json");
  for (const [k, v] of Object.entries(localSettings)) same(`settings.${k}`, settings[k], v);
  same("settings sans secrets", "webhookSecret" in settings || "webhookUrl" in settings, false);

  same("menus", (await get("/tatos/v1/menus")).data, content("menus.json"));
  same("faq", (await get("/tatos/v1/faq")).data, content("faq.json"));

  const pagesDir = path.join(root, "data/content/pages");
  let pageCount = 0;
  for (const f of fs.readdirSync(pagesDir)) {
    const local = JSON.parse(fs.readFileSync(path.join(pagesDir, f), "utf8"));
    const wp = (await get<{ title: string; data: unknown; metaTitle: string | null; metaDescription: string | null; content: string }>(`/tatos/v1/pages/${local.slug}`)).data;
    same(`page ${local.slug} titre`, wp.title, local.title);
    same(`page ${local.slug} data`, wp.data, local.data ?? null);
    same(`page ${local.slug} metaTitle`, wp.metaTitle, local.metaTitle ?? null);
    same(`page ${local.slug} metaDescription`, wp.metaDescription, local.metaDescription ?? null);
    // Même découpage que le fournisseur WordPress du frontend (src/lib/cms/wordpress.ts).
    const sections = wp.content
      .split(/<h2[^>]*>/i)
      .slice(1)
      .map((part) => {
        const [title, rest = ""] = part.split(/<\/h2>/i);
        return { title, html: rest.trim() };
      });
    const expected = (local.sections ?? []).map((s: { title: string; blocks: Block[] }) => ({ title: s.title, html: s.blocks.map((b) => b.html).join("\n").trim() }));
    same(`page ${local.slug} sections`, sections, expected);
    pageCount++;
  }

  const cats = (await get<{ slug: string; nom: string; ordre: number; image: string | null }[]>("/tatos/v1/categories")).data;
  const localCats = await prisma.category.findMany({ orderBy: { ordre: "asc" } });
  same(
    "catégories",
    cats.map((c) => [c.slug, c.nom, c.ordre, c.image]),
    localCats.map((c) => [c.slug, c.nom, c.ordre, abs(c.image)]),
  );

  const products: Record<string, Record<string, unknown>> = {};
  let page = 1;
  let totalPages = 1;
  do {
    const res = await get<Record<string, unknown>[]>(`/tatos/v1/products?per_page=100&page=${page}`);
    totalPages = Number(res.headers.get("X-WP-TotalPages") || 1);
    for (const p of res.data) products[p.id as string] = p;
    page++;
  } while (page <= totalPages);

  const local = await prisma.product.findMany({ include: { category: true, images: { orderBy: { position: "asc" } } } });
  same("nombre de produits", Object.keys(products).length, local.length);
  for (const p of local) {
    const w = products[p.id];
    if (!w) {
      diffs.push(`produit ${p.slug} absent de WordPress`);
      continue;
    }
    const expected = {
      slug: p.slug,
      titre: p.titre,
      marque: p.marque,
      modele: p.modele,
      prix: p.prixCents / 100,
      promotionPrix: p.promotionPrixCents != null ? p.promotionPrixCents / 100 : null,
      stock: p.stock,
      categorie: p.category.nom,
      categorieSlug: p.category.slug,
      sousCategorie: p.sousCategories,
      description: p.description,
      caracteristiques: p.caracteristiques,
      garantie: p.garantie,
      pose: p.pose,
      couleur: p.couleurs,
      connecter: p.connecter,
      vedette: p.vedette,
      magasin: p.magasin,
      sonore: p.sonore,
      imagePrincipale: abs(p.imagePrincipale),
      images: p.images.map((i) => abs(i.url)),
      etiquetteEnergie: abs(p.etiquetteEnergie),
      metaTitle: p.metaTitle,
      metaDescription: p.metaDescription,
      createdAt: p.createdAt.toISOString().replace(/\.\d{3}Z$/, "+00:00"),
    };
    for (const [k, v] of Object.entries(expected)) same(`produit ${p.slug}.${k}`, w[k], v);
  }

  console.log(`WordPress ${API} : réglages, menus, FAQ, ${pageCount} pages, ${cats.length} catégories, ${Object.keys(products).length} produits comparés.`);
  if (diffs.length) {
    console.log(`${diffs.length} écart(s) :`);
    for (const d of diffs.slice(0, 40)) console.log(`  - ${d}`);
    process.exitCode = 1;
  } else {
    console.log("Aucun écart.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
