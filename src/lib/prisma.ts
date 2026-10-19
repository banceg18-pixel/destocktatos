import { PrismaClient } from "@prisma/client";

// Un seul client Prisma par processus (le rechargement à chaud de Next.js recrée les modules).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// SQLite : journal WAL (réglage conservé dans le fichier de base) pour que les lectures ne soient pas
// bloquées pendant une écriture (commande, avis) quand beaucoup de visiteurs consultent le site.
// Sans effet sur une autre base (PostgreSQL, MySQL) : la requête échoue silencieusement.
const globalForWal = globalThis as unknown as { walRequested?: boolean };
if (!globalForWal.walRequested && process.env.DATABASE_URL?.startsWith("file:")) {
  globalForWal.walRequested = true;
  prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
}
