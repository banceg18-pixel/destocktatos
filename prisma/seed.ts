/**
 * Seed de la base locale à partir de `data/seed/catalog.json`
 * (catalogue répliqué du site source, images servies depuis /public/assets).
 *
 * Données de démonstration ajoutées (aucune ne provient du site source) :
 * - coupon fidélité `BIENVENUE10` (10 %) et `FIDELITE20` (20 € réservé au compte de test) ;
 * - compte client de test (identifiants dans data/seed/demo-accounts.json).
 */
import { PrismaClient, CouponType } from "@prisma/client";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";

const prisma = new PrismaClient();

type SeedProduct = {
  id: string;
  slug: string;
  titre: string;
  marque: string;
  modele: string;
  prix: number;
  promotionPrix?: number | null;
  stock: number;
  categorie: string;
  sousCategorie: string[];
  description: string;
  caracteristiques: Record<string, number>;
  garantie?: { duree: number; descriptif: string } | null;
  pose?: string | null;
  couleur: string[];
  connecter: boolean;
  vedette: boolean;
  magasin: boolean;
  sonore?: number | null;
  imagePrincipale: string | null;
  images: string[];
  etiquetteEnergie: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type SeedCategory = { slug: string; nom: string; ordre: number; image: string | null };

const toCents = (v: number | null | undefined) => (v == null ? null : Math.round(v * 100));

async function main() {
  const root = process.cwd();
  const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/seed/catalog.json"), "utf8")) as {
    categories: SeedCategory[];
    products: SeedProduct[];
  };

  const categoryIds = new Map<string, string>();
  for (const c of catalog.categories) {
    const cat = await prisma.category.upsert({
      where: { slug: c.slug },
      update: { nom: c.nom, ordre: c.ordre, image: c.image },
      create: { slug: c.slug, nom: c.nom, ordre: c.ordre, image: c.image },
    });
    categoryIds.set(c.nom, cat.id);
  }

  let count = 0;
  for (const p of catalog.products) {
    const categoryId = categoryIds.get(p.categorie);
    if (!categoryId) throw new Error(`Catégorie inconnue: ${p.categorie}`);
    const data = {
      slug: p.slug,
      titre: p.titre,
      marque: p.marque,
      modele: p.modele,
      prixCents: toCents(p.prix)!,
      promotionPrixCents: toCents(p.promotionPrix ?? null),
      stock: p.stock ?? 0,
      categoryId,
      sousCategories: p.sousCategorie ?? [],
      description: p.description ?? "",
      caracteristiques: p.caracteristiques ?? {},
      garantie: p.garantie ?? undefined,
      pose: p.pose ?? null,
      couleurs: p.couleur ?? [],
      connecter: p.connecter,
      vedette: p.vedette,
      magasin: p.magasin,
      sonore: p.sonore ?? null,
      imagePrincipale: p.imagePrincipale,
      etiquetteEnergie: p.etiquetteEnergie,
      metaTitle: p.metaTitle ?? null,
      metaDescription: p.metaDescription ?? null,
      createdAt: p.createdAt ? new Date(p.createdAt) : undefined,
    };
    await prisma.$transaction([
      prisma.product.upsert({ where: { id: p.id }, update: data, create: { id: p.id, ...data } }),
      prisma.productImage.deleteMany({ where: { productId: p.id } }),
      prisma.productImage.createMany({
        data: p.images.map((url, position) => ({ productId: p.id, url, position })),
      }),
    ]);
    count++;
  }

  // Notes importées du site source (sans commentaire ni identité : auteurs anonymisés).
  for (const p of catalog.products) {
    const resume = (p as unknown as { resumeAvis?: { nombreAvis: number; noteMoyenne: number } }).resumeAvis;
    if (!resume?.nombreAvis) continue;
    for (let i = 0; i < resume.nombreAvis; i++) {
      const author = await prisma.user.upsert({
        where: { email: `avis-importe-${i + 1}@tatos.test` },
        update: {},
        create: { email: `avis-importe-${i + 1}@tatos.test`, name: "Client vérifié" },
      });
      await prisma.review.upsert({
        where: { productId_userId: { productId: p.id, userId: author.id } },
        update: { note: Math.round(resume.noteMoyenne) },
        create: { productId: p.id, userId: author.id, note: Math.round(resume.noteMoyenne), commentaire: "" },
      });
    }
  }

  // --- Données de démonstration (tests locaux uniquement) ---
  const demoFile = path.join(root, "data/seed/demo-accounts.json");
  const demo = JSON.parse(fs.readFileSync(demoFile, "utf8")) as {
    customer: { name: string; email: string; password: string };
  };
  const customer = await prisma.user.upsert({
    where: { email: demo.customer.email },
    update: {},
    create: {
      name: demo.customer.name,
      email: demo.customer.email,
      passwordHash: await bcrypt.hash(demo.customer.password, 10),
    },
  });

  await prisma.coupon.upsert({
    where: { code: "BIENVENUE10" },
    update: {},
    create: { code: "BIENVENUE10", description: "Coupon de bienvenue (démo)", type: CouponType.POURCENTAGE, value: 10 },
  });
  await prisma.coupon.upsert({
    where: { code: "FIDELITE20" },
    update: {},
    create: {
      code: "FIDELITE20",
      description: "Récompense fidélité (démo)",
      type: CouponType.MONTANT,
      value: 2000,
      maxUses: 1,
      userId: customer.id,
    },
  });

  console.log(`Seed terminé : ${catalog.categories.length} catégories, ${count} produits, compte de test ${customer.email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
