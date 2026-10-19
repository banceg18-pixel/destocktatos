import fs from "node:fs";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";

/**
 * Export des contenus du site au format d'import de l'extension WordPress (`wp tatos import` ou
 * bouton « Importer les contenus du site » des réglages WordPress) : réglages, menus, FAQ, articles,
 * pages, catégories et produits. Les chemins d'images deviennent des adresses absolues du site.
 */

type Block = { type: string; text?: string; items?: string[]; html?: string; level?: number };
const blockHtml = (b: Block) =>
  b.type === "html" ? b.html : b.type === "paragraph" ? `<p>${b.text}</p>` : b.type === "list" ? `<ul>${b.items!.map((i) => `<li>${i}</li>`).join("")}</ul>` : `<h${b.level}>${b.text}</h${b.level}>`;

const contentDir = () => path.join(process.cwd(), "data", "content");
const content = (f: string) => JSON.parse(fs.readFileSync(path.join(contentDir(), f), "utf8"));

/** Contenus éditoriaux, catégories et nombre de produits (sans les produits). */
export async function exportContent(prisma: PrismaClient, siteUrl: string) {
  const abs = (p: string | null) => (p ? (p.startsWith("http") ? p : `${siteUrl}${p}`) : null);
  const categories = await prisma.category.findMany({ orderBy: { ordre: "asc" } });
  const tpl = content("pages/categorie.json").data;
  const pagesDir = path.join(contentDir(), "pages");
  const pages = fs.readdirSync(pagesDir).map((f) => {
    const p = JSON.parse(fs.readFileSync(path.join(pagesDir, f), "utf8"));
    const html = (p.sections ?? []).map((s: { title: string; blocks: Block[] }) => `<h2>${s.title}</h2>\n${s.blocks.map(blockHtml).join("\n")}`).join("\n");
    return { slug: p.slug, title: p.title, metaTitle: p.metaTitle, metaDescription: p.metaDescription, html, data: p.data };
  });
  return {
    generatedAt: new Date().toISOString(),
    settings: content("site.json"),
    menus: content("menus.json"),
    faq: content("faq.json"),
    posts: content("posts.json"),
    categories: categories.map((c) => ({ slug: c.slug, nom: c.nom, ordre: c.ordre, image: abs(c.image), description: tpl.descriptions[c.slug] ?? null })),
    pages,
    productCount: await prisma.product.count(),
  };
}

/** Une page de produits (ordre de création), au format d'import. */
export async function exportProducts(prisma: PrismaClient, siteUrl: string, skip = 0, take?: number) {
  const abs = (p: string | null) => (p ? (p.startsWith("http") ? p : `${siteUrl}${p}`) : null);
  const products = await prisma.product.findMany({ include: { category: true, images: { orderBy: { position: "asc" } } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], skip, take });
  return products.map((p) => ({
    id: p.id,
    slug: p.slug,
    titre: p.titre,
    marque: p.marque,
    modele: p.modele,
    prix: p.prixCents / 100,
    promotionPrix: p.promotionPrixCents != null ? p.promotionPrixCents / 100 : null,
    stock: p.stock,
    categorie: p.category.nom,
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
    createdAt: p.createdAt.toISOString(),
  }));
}
