import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HeroSlider } from "@/components/home/HeroSlider";
import { Rail } from "@/components/home/Rail";
import { ProductCard } from "@/components/product/ProductCard";
import { ButtonLink } from "@/components/ui/Button";
import { Counter, TextReveal } from "@/components/ui/Motion";
import { Reveal } from "@/components/ui/Reveal";
import { Arrow, Price, SectionHeading, Tag } from "@/components/ui/Primitives";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { IconRecycle, IconShield, IconStore, IconTruck, IconWrench } from "@/components/ui/Icons";
import { getCatalogStats, getCategories, getFeaturedProducts, getPromotionProducts } from "@/lib/catalog/repository";
import { getPage, getSiteSettings } from "@/lib/cms";
import { MAX_DELIVERY_DISTANCE } from "@/lib/delivery";
import { discountPercent, formatEuros } from "@/lib/money";
import type { HomeContent, ServiceIcon } from "@/types/home";

export const revalidate = 300;

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage<HomeContent>("accueil");
  const title = page?.metaTitle ?? "TATOS | Électroménager livré, installé et garanti";
  const description = page?.metaDescription;
  return {
    title: { absolute: title },
    description,
    openGraph: { title, description },
    twitter: { title, description },
  };
}

const ICONS: Record<ServiceIcon, typeof IconTruck> = { truck: IconTruck, wrench: IconWrench, store: IconStore, shield: IconShield, recycle: IconRecycle };
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function HomePage() {
  const [page, settings, categories, featured, promos, stats] = await Promise.all([
    getPage<HomeContent>("accueil"),
    getSiteSettings(),
    getCategories(),
    getFeaturedProducts(8, true),
    getPromotionProducts(undefined, true),
    getCatalogStats(),
  ]);
  const c = page!.data!;
  const shelves = categories.filter((cat) => (cat.count ?? 0) > 0 && cat.image);
  const bestPromo = [...promos].sort((a, b) => discountPercent(b.prix, b.promotionPrix) - discountPercent(a.prix, a.promotionPrix))[0];
  const maxPct = bestPromo ? discountPercent(bestPromo.prix, bestPromo.promotionPrix) : 0;

  return (
    <>
      <HeroSlider slides={c.hero.slides} siteName={settings.siteName} />


      {/* Rayons */}
      <section className="py-24 lg:py-32" aria-labelledby="rayons">
        <div className="shell">
          <Reveal>
            <SectionHeading
              title={<span id="rayons">{c.categories.title}</span>}
              intro={c.categories.intro}
              action={
                <ButtonLink href="/boutique" variant="outline" icon={<Arrow />}>
                  Tout le catalogue
                </ButtonLink>
              }
            />
          </Reveal>
          <Reveal delay={120}>
            <Rail label="Rayons" className="mt-14">
              {shelves.map((cat) => (
                <li key={cat.slug} className="w-[72vw] shrink-0 sm:w-[44vw] md:w-[31vw] lg:w-[23%]">
                  <Link href={`/categorie/${cat.slug}`} className="group block">
                    <div className="relative aspect-[4/5] overflow-hidden bg-mist">
                      <ImageComponent
                        img={cat.image}
                        alt={cat.imageAlt ?? cat.nom}
                        size={520}
                        sizes="(min-width: 1024px) 23vw, (min-width: 640px) 44vw, 72vw"
                        className="size-full object-contain p-[14%] mix-blend-multiply transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-105"
                      />
                      <span className="t-spec absolute left-4 top-4 text-graphite">{cat.count} produits</span>
                    </div>
                    <div className="flex items-end justify-between gap-3 pt-4">
                      <div>
                        <h3 className="t-h3">{capitalize(cat.nom)}</h3>
                        {cat.prixMin != null && <p className="t-spec mt-1.5 text-graphite">Dès {formatEuros(cat.prixMin)}</p>}
                      </div>
                      <span className="mb-1 flex size-9 shrink-0 items-center justify-center rounded-full border border-line transition-colors duration-300 group-hover:border-ink group-hover:bg-ink group-hover:text-paper">
                        <Arrow />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </Rail>
          </Reveal>
        </div>
      </section>

      {/* Engagement + services */}
      <section className="border-t border-line py-24 lg:py-32">
        <div className="shell grid gap-16 lg:grid-cols-[1.25fr_1fr] lg:gap-24">
          <Reveal>
            <p className="t-h2 max-w-[18ch] lg:max-w-[20ch]">{c.statement.title}</p>
            <Link href={c.statement.href} className="t-eyebrow link-underline mt-10 inline-flex items-center gap-2">
              {c.statement.cta} <Arrow />
            </Link>
          </Reveal>
          <ul className="flex flex-col">
            {c.services.map((s, i) => {
              const Icon = ICONS[s.icon] ?? IconTruck;
              return (
                <Reveal as="li" key={s.title} delay={i * 90} className="flex gap-5 border-t border-line py-7 first:border-t-0 first:pt-0 lg:first:pt-2">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-mist">
                    <Icon size={20} />
                  </span>
                  <div>
                    <h3 className="t-h3">{s.title}</h3>
                    <p className="mt-2 text-graphite">{s.text}</p>
                  </div>
                </Reveal>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Promotions */}
      {bestPromo && (
        <section className="grid lg:grid-cols-[1fr_1.15fr]" aria-labelledby="promos">
          <Link href={`/boutique/${bestPromo.slug}`} className="group relative flex min-h-[460px] min-w-0 flex-col bg-mist p-8 lg:min-h-[640px] lg:p-12">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="t-spec text-graphite">
                  {bestPromo.marque} · {bestPromo.modele}
                </p>
                <p className="t-h3 mt-2 max-w-[22ch]">{bestPromo.titre}</p>
                <Price prix={bestPromo.prix} promotionPrix={bestPromo.promotionPrix} size="lg" className="mt-3" />
              </div>
              <Tag tone="ink">-{maxPct} %</Tag>
            </div>
            <div className="relative mx-auto mt-6 w-full max-w-[420px] flex-1">
              <ImageComponent
                img={bestPromo.imagePrincipale?.url}
                alt={bestPromo.titre}
                size={640}
                sizes="(min-width: 1024px) 34vw, 90vw"
                className="absolute inset-0 size-full object-contain mix-blend-multiply transition-transform duration-1000 ease-[var(--ease-out-expo)] group-hover:scale-105"
              />
            </div>
          </Link>
          <div className="on-dark flex min-w-0 flex-col justify-between gap-12 bg-ink p-8 text-paper lg:p-12">
            <Reveal>
              <h2 id="promos" className="t-display">
                Jusqu&apos;à −{maxPct} %
              </h2>
              <p className="t-lead mt-6 max-w-md !text-white/75">
                {promos.length} appareils à prix réduit, livrables ou à retirer en magasin, dans la limite des stocks.
              </p>
              <div className="mt-10">
                <ButtonLink href="/promotions" variant="light" size="lg" icon={<Arrow />}>
                  {c.promo.cta}
                </ButtonLink>
              </div>
            </Reveal>
          </div>
        </section>
      )}

      {/* Sélection */}
      <section className="py-24 lg:py-32" aria-labelledby="selection">
        <div className="shell">
          <Reveal>
            <SectionHeading
              title={<span id="selection">{c.selection.title}</span>}
              action={
                <ButtonLink href="/boutique" variant="outline" icon={<Arrow />}>
                  {c.selection.cta}
                </ButtonLink>
              }
            />
          </Reveal>
          <Reveal delay={100} className="hairline-grid mt-14 grid-cols-2 lg:grid-cols-4">
            {featured.map((p) => (
              <ProductCard key={p._id} product={p} />
            ))}
          </Reveal>
        </div>
      </section>

      {/* Pourquoi nous */}
      <section className="border-t border-line py-24 lg:py-36">
        <div className="shell">
          <TextReveal text={c.why.text} className="mx-auto max-w-5xl text-center font-display text-[clamp(1.6rem,3.2vw,3rem)] leading-[1.18] tracking-[-0.02em] [font-stretch:108%]" />
          <dl className="mx-auto mt-20 grid max-w-5xl grid-cols-1 gap-12 text-center sm:grid-cols-3">
            {[
              { value: stats.available, label: c.why.stats.products },
              { value: stats.brands, label: c.why.stats.brands },
              { value: MAX_DELIVERY_DISTANCE, label: c.why.stats.radius },
            ].map((s) => (
              <div key={s.label} className="flex flex-col items-center">
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-[clamp(3rem,6vw,5.5rem)] font-medium leading-none tracking-[-0.04em] [font-stretch:120%]">
                  <Counter value={s.value} />
                </dd>
                <dd className="mt-4 text-graphite">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Bandeau services */}
      <section className="on-dark relative isolate overflow-hidden bg-ink text-paper">
        <Image src={c.band.image} alt={c.band.imageAlt} fill sizes="100vw" className="-z-10 object-cover opacity-55" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-ink/90 via-ink/55 to-transparent" aria-hidden="true" />
        <div className="shell py-28 lg:py-40">
          <Reveal className="max-w-xl">
            <h2 className="t-h2">{c.band.title}</h2>
            <p className="mt-6 text-white/75">{c.band.text}</p>
            <div className="mt-10">
              <ButtonLink href={c.band.href} variant="light" size="lg" icon={<Arrow />}>
                {c.band.cta}
              </ButtonLink>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
