import type { Metadata } from "next";
import { CatalogView } from "@/components/shop/CatalogView";
import { PageHeader } from "@/components/common/PageHeader";
import { getCategories, getSousCategories, listProducts } from "@/lib/catalog/repository";
import { parseCatalogQuery } from "@/lib/catalog/query";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const q = parseCatalogQuery(await searchParams);
  const title = q.recherche ? `Recherche « ${q.recherche} »` : "Boutique";
  return {
    title,
    description: "Tout le catalogue d'électroménager disponible : réfrigérateurs, lave-linge, fours, plaques, petit électroménager. Livraison, installation ou retrait en magasin.",
    alternates: { canonical: "/boutique" },
    // Les combinaisons de filtres ne sont pas indexées (contenu dupliqué) ; la boutique l'est.
    robots: q.recherche || q.categorie || q.page > 1 ? { index: false, follow: true } : undefined,
  };
}

export default async function BoutiquePage({ searchParams }: { searchParams: SearchParams }) {
  const q = parseCatalogQuery(await searchParams);
  const [result, categories] = await Promise.all([
    listProducts({
      page: q.page,
      categorie: q.categorie || undefined,
      sousCategorie: q.sousCategorie || undefined,
      prixMin: q.prixMin,
      prixMax: q.prixMax,
      recherche: q.recherche || undefined,
      promotions: q.promotions,
      tri: q.tri,
    }),
    getCategories(),
  ]);

  return (
    <>
      <PageHeader
        title={q.recherche ? `« ${q.recherche} »` : "Boutique"}
        intro={
          q.recherche
            ? `${result.total} résultat${result.total > 1 ? "s" : ""} parmi les appareils disponibles.`
            : "Tous les appareils disponibles, livrés gratuitement partout en France, à installer chez vous ou à retirer en magasin."
        }
      />
      <CatalogView
        basePath="/boutique"
        query={q}
        products={result.produits}
        total={result.total}
        totalPages={result.totalPages}
        categories={categories}
        sousCategories={getSousCategories()}
      />
    </>
  );
}
