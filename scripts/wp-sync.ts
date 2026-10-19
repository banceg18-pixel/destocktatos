/** Synchronise le catalogue depuis WordPress (CLI) : `npm run wp:sync`. */
import { syncCatalogFromWordPress } from "../src/lib/cms/wordpress-sync";

syncCatalogFromWordPress()
  .then((r) => {
    console.log(`Synchronisation WordPress terminée : ${r.categories} catégories, ${r.products} produits`);
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
