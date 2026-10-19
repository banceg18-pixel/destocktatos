import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/shop/CatalogView";
import { PageHeader } from "@/components/common/PageHeader";
import { ContentBlocks } from "@/components/common/ContentBlocks";
import { Accordion } from "@/components/ui/Primitives";
import { Reveal } from "@/components/ui/Reveal";
import { getCategories, getSousCategories, listProducts } from "@/lib/catalog/repository";
import { parseCatalogQuery } from "@/lib/catalog/query";
import { formatEuros } from "@/lib/money";
import { getPage } from "@/lib/cms";
import type { ContentBlock, FaqItem } from "@/lib/cms/types";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

interface CategoryTemplate {
  descriptions: Record<string, string | null>;
  guide: ContentBlock[];
  faq: FaqItem[];
  metaDescriptionTemplate: string;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

async function findCategory(slug: string) {
  const categories = await getCategories();
  return { categories, category: categories.find((c) => c.slug === slug) };
}

export async function generateMetadata({ params, searchParams }: { params: Params; searchParams: SearchParams }): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [{ category }, page] = await Promise.all([findCategory(slug), getPage<CategoryTemplate>("categorie")]);
  if (!category) return { title: "Catégorie introuvable", robots: { index: false } };
  const name = capitalize(category.nom);
  const description = (page?.data?.metaDescriptionTemplate ?? "").replace("{nom}", name) || `${name} : tous les modèles disponibles, livraison et installation.`;
  const filtered = Object.keys(sp).length > 0;
  return {
    title: name,
    description,
    alternates: { canonical: `/categorie/${slug}` },
    openGraph: { title: name, description, url: `/categorie/${slug}` },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function CategoryPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [{ categories, category }, page] = await Promise.all([findCategory(slug), getPage<CategoryTemplate>("categorie")]);
  if (!category) notFound();
  const q = { ...parseCatalogQuery(sp), categorie: category.nom };
  const result = await listProducts({
    page: q.page,
    categorie: category.nom,
    sousCategorie: q.sousCategorie || undefined,
    prixMin: q.prixMin,
    prixMax: q.prixMax,
    promotions: q.promotions,
    tri: q.tri,
  });
  const tpl = page?.data;
  const name = capitalize(category.nom);
  const description = tpl?.descriptions[slug];

  return (
    <>
      <PageHeader
        title={name}
        intro={description ?? `Tous nos modèles de ${category.nom} disponibles, livrés et installés chez vous ou à retirer en magasin.`}
        meta={
          <p className="t-spec text-graphite">
            {category.count} modèle{(category.count ?? 0) > 1 ? "s" : ""} disponible{(category.count ?? 0) > 1 ? "s" : ""}
            {category.prixMin != null && ` · dès ${formatEuros(category.prixMin)}`}
          </p>
        }
        image={category.image}
        imageAlt={category.imageAlt}
      />
      <CatalogView
        basePath={`/categorie/${slug}`}
        query={q}
        products={result.produits}
        total={result.total}
        totalPages={result.totalPages}
        categories={categories}
        lockedCategory={category}
        sousCategories={getSousCategories()}
      />

      {tpl && (
        <section className="border-t border-line py-20 lg:py-28">
          <div className="shell grid gap-14 lg:grid-cols-2 lg:gap-24">
            <Reveal>
              <h2 className="t-h2">Bien choisir son {category.nom}</h2>
              <div className="mt-8 space-y-4 text-ink-soft [&_h3]:mt-8 [&_h3]:font-sans [&_h3]:text-base [&_h3]:font-semibold [&_h3]:tracking-normal [&_h3]:[font-stretch:100%] [&_li]:mb-2 [&_ul]:list-disc [&_ul]:pl-5">
                <ContentBlocks blocks={tpl.guide} />
              </div>
            </Reveal>
            <Reveal delay={100}>
              <h2 className="t-h2 mb-8">Avant d&apos;acheter</h2>
              {tpl.faq.map((f) => (
                <Accordion key={f.question} title={f.question} name="faq-categorie">
                  {f.answer}
                </Accordion>
              ))}
            </Reveal>
          </div>
        </section>
      )}
    </>
  );
}
