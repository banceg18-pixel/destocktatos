/**
 * Génère `wordpress/export/wordpress-import.json` à partir des données locales
 * (catalogue en base + contenus data/content) pour alimenter WordPress :
 *   wp tatos import wordpress/export/wordpress-import.json
 * (En ligne, WordPress peut aussi lire ces données directement depuis le site : bouton « Importer
 * les contenus du site » des réglages de l'extension.)
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { exportContent, exportProducts } from "../src/lib/server/wp-export";

const prisma = new PrismaClient();
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

async function main() {
  const { productCount, ...base } = await exportContent(prisma, SITE);
  const out = { ...base, products: await exportProducts(prisma, SITE) };
  const dest = path.join(process.cwd(), "wordpress/export/wordpress-import.json");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, JSON.stringify(out, null, 1));
  console.log(`Export WordPress : ${out.products.length}/${productCount} produits, ${out.categories.length} catégories, ${out.pages.length} pages, ${out.posts.length} articles -> ${path.relative(process.cwd(), dest)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
