/**
 * Build de production, valable sur tout hébergeur (Hostinger, Vercel, VPS…).
 *
 * - DATABASE_URL PostgreSQL (en ligne, base Neon) : vérifie le schéma PostgreSQL dérivé, génère son
 *   client Prisma, applique les migrations en attente, puis lance `next build`.
 * - Sinon (SQLite en local) : `next build` seul, avec le client Prisma déjà généré.
 *
 *   npm run build
 */
import { spawnSync } from "node:child_process";

const POSTGRES_SCHEMA = "prisma/postgres/schema.prisma";

function run(command) {
  console.log(`\n> ${command}`);
  const { status } = spawnSync(command, { stdio: "inherit", shell: true });
  if (status !== 0) process.exit(status ?? 1);
}

const url = (process.env.DATABASE_URL || "").trim().replace(/^["']|["']$/g, "");
if (/^postgres(ql)?:\/\//.test(url)) {
  if (!process.env.DATABASE_URL_UNPOOLED) {
    console.error("DATABASE_URL_UNPOOLED manquant : connexion directe à la base, requise pour les migrations.");
    process.exit(1);
  }
  run("node scripts/prisma-postgres.mjs --check");
  run(`npx prisma generate --schema ${POSTGRES_SCHEMA}`);
  run(`npx prisma migrate deploy --schema ${POSTGRES_SCHEMA}`);
}
run("npx next build");
