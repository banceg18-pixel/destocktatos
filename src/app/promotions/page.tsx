import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { ProductCard } from "@/components/product/ProductCard";
import { NewsletterForm } from "@/components/forms/NewsletterForm";
import { ButtonLink } from "@/components/ui/Button";
import { Reveal } from "@/components/ui/Reveal";
import { Arrow } from "@/components/ui/Primitives";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { getCategories, getPromotionProducts } from "@/lib/catalog/repository";
import { discountPercent } from "@/lib/money";

export const metadata: Metadata = {
  title: "Promotions",
  description: "Tous les appareils électroménagers à prix réduit, livrés gratuitement partout en France, avec installation sur demande.",
  alternates: { canonical: "/promotions" },
};

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function PromotionsPage() {
  const [promos, categories] = await Promise.all([getPromotionProducts(undefined, true), getCategories()]);
  const sorted = [...promos].sort((a, b) => discountPercent(b.prix, b.promotionPrix) - discountPercent(a.prix, a.promotionPrix));
  const maxPct = sorted[0] ? discountPercent(sorted[0].prix, sorted[0].promotionPrix) : 0;
  const byCategory = categories
    .map((c) => {
      const items = sorted.filter((p) => p.categorie === c.nom);
      return { c, count: items.length, best: items[0], max: items[0] ? discountPercent(items[0].prix, items[0].promotionPrix) : 0 };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <PageHeader
        title={maxPct ? `Jusqu'à −${maxPct} %` : "Promotions"}
        intro={
          promos.length
            ? `${promos.length} appareils à prix réduit en ce moment, dans la limite des stocks. Livraison offerte partout en France et installation sur demande, comme pour tout le catalogue.`
            : "Aucune promotion en cours. Inscrivez-vous à la newsletter pour être prévenu des prochaines offres."
        }
      />

      {byCategory.length > 0 && (
        <section className="pb-20" aria-labelledby="promo-rayons">
          <div className="shell">
            <h2 id="promo-rayons" className="t-h3 mb-6">
              Par rayon
            </h2>
            <ul className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {byCategory.map(({ c, count, best, max }, i) => (
                <Reveal as="li" key={c.slug} delay={Math.min(i, 6) * 60}>
                  <Link href={`/categorie/${c.slug}?promotions=1`} className="group flex h-full flex-col items-start gap-3 bg-mist p-4 transition-colors hover:bg-mist-deep sm:flex-row sm:items-center sm:gap-4">
                    <div className="size-16 shrink-0 sm:size-20">
                      <ImageComponent img={best?.imagePrincipale?.url ?? c.image} alt="" size={80} className="size-full object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105" />
                    </div>
                    <div className="min-w-0">
                      <p className="t-h3 !text-lg [overflow-wrap:anywhere]">{capitalize(c.nom)}</p>
                      <p className="t-spec mt-1 text-graphite">
                        {count} offre{count > 1 ? "s" : ""} · jusqu&apos;à −{max} %
                      </p>
                    </div>
                  </Link>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sorted.length > 0 && (
        <section className="border-t border-line py-20 lg:py-24" aria-labelledby="promo-meilleures">
          <div className="shell">
            <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 id="promo-meilleures" className="t-h2">
                  À saisir maintenant
                </h2>
              </div>
              <ButtonLink href="/boutique?promotions=1&tri=remise" variant="outline" icon={<Arrow />}>
                Toutes les promotions
              </ButtonLink>
            </Reveal>
            <div className="hairline-grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
              {sorted.slice(0, 12).map((p, i) => (
                <ProductCard key={p._id} product={p} priority={i < 4} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="on-dark bg-ink py-20 text-paper lg:py-28">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div className="min-w-0">
            <h2 className="t-h2 max-w-md">Soyez prévenu des prochaines offres.</h2>
            <p className="mt-6 max-w-md text-white/65">Une lettre par mois, pas davantage. Désinscription en un clic.</p>
          </div>
          <NewsletterForm tone="ink" />
        </div>
      </section>
    </>
  );
}
