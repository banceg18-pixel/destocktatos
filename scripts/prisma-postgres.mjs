/**
 * Schéma PostgreSQL de production (Vercel + Neon), dérivé de prisma/schema.prisma (SQLite, local).
 * Seule la source de données change ; les modèles restent identiques.
 *
 *   node scripts/prisma-postgres.mjs          # régénère prisma/postgres/schema.prisma
 *   node scripts/prisma-postgres.mjs --check  # échoue si le fichier n'est pas à jour
 *
 * Après un changement de modèle : régénérez ce schéma puis créez la migration PostgreSQL
 * (voir docs/installation-deploiement.md, « Vercel »).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");
const datasource = /datasource db \{[^}]*\}/;
if (!datasource.test(src)) throw new Error("Bloc datasource introuvable dans prisma/schema.prisma");
const out =
  "// FICHIER GÉNÉRÉ par scripts/prisma-postgres.mjs depuis prisma/schema.prisma : ne pas modifier à la main.\n" +
  src.replace(
    datasource,
    'datasource db {\n  provider  = "postgresql"\n  url       = env("DATABASE_URL")\n  // Connexion directe (sans pool) pour les migrations.\n  directUrl = env("DATABASE_URL_UNPOOLED")\n}',
  );
const target = path.join(root, "prisma/postgres/schema.prisma");
if (process.argv.includes("--check")) {
  // Fins de ligne ignorées : un dépôt extrait sous Windows (CRLF) reste à jour.
  const lf = (s) => s.replace(/\r\n/g, "\n");
  if (!existsSync(target) || lf(readFileSync(target, "utf8")) !== lf(out)) {
    console.error("prisma/postgres/schema.prisma n'est pas à jour : lancez node scripts/prisma-postgres.mjs");
    process.exit(1);
  }
  console.log("Schéma PostgreSQL à jour.");
} else {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, out);
  console.log("prisma/postgres/schema.prisma généré.");
}
