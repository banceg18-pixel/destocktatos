import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Tests unitaires (logique pure) et d'intégration (services + base SQLite dédiée `prisma/test.db`,
 * recréée à chaque exécution par tests/support/global-setup.ts). La base de développement n'est
 * jamais touchée. Les tests API/E2E (serveur en marche) sont dans tests/e2e (Playwright).
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      // Garde-fou Next.js sans objet hors du bundler (les modules serveur sont testés directement).
      "server-only": path.resolve(__dirname, "tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    environment: "node",
    globalSetup: ["tests/support/global-setup.ts"],
    env: {
      DATABASE_URL: "file:./test.db",
      MAIL_OUTBOX_DIR: path.resolve(__dirname, "tests/.tmp/outbox"),
      STRIPE_SECRET_KEY: "",
      NEXTAUTH_SECRET: "test-secret-not-used-in-production",
      // Contenus locaux et cache du catalogue coupé : les tests écrivent directement en base.
      CMS_PROVIDER: "local",
      CATALOG_CACHE_TTL_MS: "0",
      // Les commandes de test utilisent le retrait (pas de géocodage) ; il est fermé en production.
      STORE_PICKUP_ENABLED: "true",
    },
    // Une seule base SQLite partagée : les fichiers s'exécutent l'un après l'autre.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
