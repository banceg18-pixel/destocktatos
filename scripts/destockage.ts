/**
 * Opération déstockage : prix de déstockage et stock de 3 à 7 pièces.
 *
 * - Prix : le prix du produit (`prixCents`, affiché barré comme « prix conseillé fabricant ») ne
 *   change pas ; le prix de vente (`promotionPrixCents`) reçoit la remise de sa tranche (voir
 *   `src/lib/destockage.ts`), stable d'une exécution à l'autre, arrondie à ,99.
 * - Stock : dans chaque catégorie, environ un tiers des produits (au moins 2) passent à 3 à 7
 *   pièces ; les autres gardent leur stock. Valeurs provisoires, en attendant le fichier de stock.
 *
 * Avant toute écriture, les valeurs actuelles sont sauvegardées dans `backups/` (non versionné).
 *
 *   npx tsx scripts/destockage.ts --dry-run        # aperçu, aucune écriture
 *   npx tsx scripts/destockage.ts                  # applique sur la base de DATABASE_URL (.env)
 *   npx tsx scripts/destockage.ts --restore <fichier.json>   # remet les valeurs sauvegardées
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { between, destockagePriceCents, stableUnit as unit } from "../src/lib/destockage";

const STOCK_MIN = 3;
const STOCK_MAX = 7;
const STOCK_SHARE = 1 / 3;
const STOCK_MIN_PER_CATEGORY = 2;

const prisma = new PrismaClient();
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

interface Saved {
  id: string;
  prixCents: number;
  promotionPrixCents: number | null;
  stock: number;
}

async function apply() {
  const products = await prisma.product.findMany({
    select: { id: true, slug: true, prixCents: true, promotionPrixCents: true, stock: true, categoryId: true },
    orderBy: { id: "asc" },
  });

  // Stock : environ un tiers de chaque catégorie, choisi de façon stable.
  const byCategory = new Map<string, typeof products>();
  for (const p of products) byCategory.set(p.categoryId, [...(byCategory.get(p.categoryId) ?? []), p]);
  const stocked = new Set<string>();
  for (const list of byCategory.values()) {
    const count = Math.min(list.length, Math.max(STOCK_MIN_PER_CATEGORY, Math.round(list.length * STOCK_SHARE)));
    [...list].sort((a, b) => unit(a.id, "stock") - unit(b.id, "stock")).slice(0, count).forEach((p) => stocked.add(p.id));
  }

  const updates = products.map((p) => ({
    id: p.id,
    slug: p.slug,
    before: { prix: p.prixCents, promo: p.promotionPrixCents, stock: p.stock },
    promotionPrixCents: destockagePriceCents(p.id, p.prixCents),
    stock: stocked.has(p.id) ? between(unit(p.id, "quantite"), STOCK_MIN, STOCK_MAX) : p.stock,
  }));

  for (const u of updates.slice(0, 8)) {
    const pct = Math.round((1 - u.promotionPrixCents / u.before.prix) * 100);
    console.log(`${u.slug.slice(0, 48).padEnd(48)} ${(u.before.prix / 100).toFixed(2).padStart(9)} € -> ${(u.promotionPrixCents / 100).toFixed(2).padStart(9)} € (-${pct} %)  stock ${u.before.stock} -> ${u.stock}`);
  }
  console.log(`… ${updates.length} produits, ${stocked.size} passent à ${STOCK_MIN}-${STOCK_MAX} pièces, ${byCategory.size} catégories.`);
  if (dryRun) return console.log("Aperçu seulement (--dry-run) : aucune écriture.");

  const saved: Saved[] = products.map((p) => ({ id: p.id, prixCents: p.prixCents, promotionPrixCents: p.promotionPrixCents, stock: p.stock }));
  const dir = path.join(process.cwd(), "backups");
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `destockage-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  await writeFile(file, JSON.stringify(saved, null, 1));
  console.log(`Sauvegarde : ${file}`);

  await prisma.$transaction(
    updates.map((u) => prisma.product.update({ where: { id: u.id }, data: { promotionPrixCents: u.promotionPrixCents, stock: u.stock } })),
  );
  console.log("Prix de déstockage et stocks appliqués.");
}

async function restore(file: string) {
  const saved = JSON.parse(await readFile(file, "utf8")) as Saved[];
  if (dryRun) return console.log(`Aperçu : ${saved.length} produits seraient restaurés depuis ${file}.`);
  await prisma.$transaction(
    saved.map((s) => prisma.product.updateMany({ where: { id: s.id }, data: { promotionPrixCents: s.promotionPrixCents, stock: s.stock } })),
  );
  console.log(`${saved.length} produits restaurés depuis ${file}.`);
}

const restoreIndex = args.indexOf("--restore");
(restoreIndex >= 0 ? restore(args[restoreIndex + 1]) : apply())
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
