import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductGallery } from "@/components/product/ProductGallery";
import { PurchasePanel } from "@/components/product/PurchasePanel";
import { ProductReviews } from "@/components/product/ProductReviews";
import { ProductCard } from "@/components/product/ProductCard";
import { Rail } from "@/components/home/Rail";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Accordion, Price, StockBadge, Stars, Tag } from "@/components/ui/Primitives";
import { Reveal } from "@/components/ui/Reveal";
import { IconLock, IconShield, IconTruck, IconWrench } from "@/components/ui/Icons";
import { getCategories, getProductBySlug, getSuggestions } from "@/lib/catalog/repository";
import { DeliveryRates } from "@/components/common/DeliveryRates";
import { discountPercent, formatEuros } from "@/lib/money";
import { OG_IMAGES, SITE_URL, TWITTER_CARD, jsonLd } from "@/lib/seo";
import { displayTitle } from "@/lib/text";
import { BIG_TICKET_OFFER, offerApplies, offerUnitEuros } from "@/lib/offers";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProductBySlug(decodeURIComponent(slug));
  if (!p) return { title: "Produit introuvable", robots: { index: false } };
  const title = `${displayTitle(p.titre, p.marque)} ${p.marque} ${p.modele}`.replace(/\s+/g, " ").trim();
  const description = (p.metaDescription || p.description).slice(0, 300);
  const images = p.imagePrincipale ? [p.imagePrincipale.url] : [OG_IMAGES[0].url];
  return {
    title,
    description,
    alternates: { canonical: `/boutique/${p.slug}` },
    openGraph: { title, description, url: `/boutique/${p.slug}`, images },
    twitter: { card: TWITTER_CARD, title, description, images },
  };
}

const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const p = await getProductBySlug(decodeURIComponent(slug));
  if (!p) notFound();

  const [categories, suggestions] = await Promise.all([getCategories(), getSuggestions(p._id, p.categorie, 10)]);
  const category = categories.find((c) => c.nom === p.categorie);
  const title = displayTitle(p.titre, p.marque);
  const pct = discountPercent(p.prix, p.promotionPrix);
  const price = pct ? p.promotionPrix! : p.prix;
  const note = p.resumeAvis?.noteMoyenne || 0;
  const nbAvis = p.resumeAvis?.nombreAvis || 0;
  const c = p.caracteristiques || {};
  const url = `${SITE_URL}/boutique/${p.slug}`;
  const images = [p.imagePrincipale, ...p.images].filter((i, idx, arr): i is NonNullable<typeof i> => !!i?.url && arr.findIndex((x) => x?.url === i.url) === idx);

  const specs: { label: string; value: string }[] = [
    { label: "Marke", value: p.marque },
    { label: "Modell", value: p.modele },
    { label: "Kategorie", value: capitalize(p.categorie) },
    ...(p.sousCategorie.length ? [{ label: "Typ", value: p.sousCategorie.map(capitalize).join(", ") }] : []),
    ...(c.largeur && c.hauteur && c.profondeur ? [{ label: "Abmessungen (B × T × H)", value: `${c.largeur} × ${c.profondeur} × ${c.hauteur} cm` }] : []),
    ...(c.poids ? [{ label: "Gewicht", value: `${String(c.poids).replace(".", ",")} kg` }] : []),
    ...(p.pose ? [{ label: "Aufstellung", value: capitalize(p.pose) }] : []),
    ...(p.couleur.length ? [{ label: "Farbe", value: p.couleur.map(capitalize).join(", ") }] : []),
    ...(p.sonore != null ? [{ label: "Geräuschpegel", value: `${p.sonore} dB` }] : []),
    { label: "Smart / Vernetzt", value: p.connecter ? "Ja" : "Nein" },
    ...(p.garantie ? [{ label: "Garantie", value: `${p.garantie.duree} Monate` }] : []),
    { label: "In Filiale ausgestellt", value: p.magasin ? "Ja" : "Nein" },
  ];

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: title,
    image: images.map((i) => abs(i.url)),
    description: p.description,
    brand: { "@type": "Brand", name: p.marque },
    sku: p._id,
    mpn: p.modele,
    category: p.categorie,
    ...(nbAvis > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: note, reviewCount: nbAvis } } : {}),
    offers: {
      "@type": "Offer",
      url,
      priceCurrency: "EUR",
      price,
      availability: p.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  };
  const crumbs: { label: string; href?: string }[] = [
    { label: "Startseite", href: "/" },
    { label: "Shop", href: "/boutique" },
    ...(category ? [{ label: capitalize(category.nom), href: `/categorie/${category.slug}` }] : []),
    { label: title },
  ];
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((cr, i) => ({ "@type": "ListItem", position: i + 1, name: cr.label, item: cr.href ? `${SITE_URL}${cr.href === "/" ? "" : cr.href}` : url })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(productLd)} />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd)} />

      <div className="shell grid gap-10 pb-20 pt-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16 lg:pt-8 xl:gap-24">
        <div className="min-w-0">
          <ProductGallery images={images} title={title} />
        </div>

        <div className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:self-start">
          <p className="t-spec text-graphite">
            {p.marque} · {p.modele}
          </p>
          <h1 className="t-h2 mt-3 !text-[clamp(1.9rem,3.2vw,3rem)]">{title}</h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
            {nbAvis > 0 ? (
              <a href="#avis" className="flex items-center gap-2 text-sm hover:underline">
                <Stars value={note} />
                <span>
                  {note.toFixed(1).replace(".", ",")} · {nbAvis} {nbAvis > 1 ? "Bewertungen" : "Bewertung"}
                </span>
              </a>
            ) : (
              <a href="#avis" className="text-sm text-graphite hover:underline">
                Noch keine Bewertungen
              </a>
            )}
            <StockBadge stock={p.stock} />
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Price prix={p.prix} promotionPrix={p.promotionPrix} size="xl" />
            {pct > 0 && <Tag tone="promo">-{pct} %</Tag>}
          </div>
          {pct > 0 && <p className="mt-2 text-sm text-graphite">Sie sparen {formatEuros(p.prix - price)} gegenüber der UVP des Herstellers.</p>}
          {offerApplies(price) && (
            <p className="mt-2 text-sm font-semibold text-promo">
              -{BIG_TICKET_OFFER.percent} % zusätzlicher Rabatt im Warenkorb (Geräte ab 1.000 €): {formatEuros(offerUnitEuros(price))}.
            </p>
          )}

          <div className="mt-8">
            <PurchasePanel product={p} />
          </div>

          <ul className="mt-8 grid grid-cols-2 gap-x-6 gap-y-5 border-y border-line py-6 text-sm">
            <li className="flex gap-3">
              <IconTruck className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium">Kostenlose Lieferung</span>
                <span className="text-graphite">in ganz Deutschland</span>
              </span>
            </li>
            <li className="flex gap-3">
              <IconWrench className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium">Montageservice</span>
                <span className="text-graphite">und Altgerätemitnahme</span>
              </span>
            </li>
            <li className="flex gap-3">
              <IconShield className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium">Persönliche Übergabe</span>
                <span className="text-graphite">durch eigene Serviceteams</span>
              </span>
            </li>
            <li className="flex gap-3">
              <IconLock className="mt-0.5 shrink-0" />
              <span>
                <span className="block font-medium">Sichere Zahlung</span>
                <span className="text-graphite">per Banküberweisung</span>
              </span>
            </li>
          </ul>

          <div className="mt-2">
            <Accordion title="Beschreibung" defaultOpen>
              <div className="space-y-3 whitespace-pre-line">{p.description}</div>
            </Accordion>
            <Accordion title="Technische Daten">
              <dl className="divide-y divide-line">
                {specs.map((s) => (
                  <div key={s.label} className="grid grid-cols-[1fr_1.2fr] gap-4 py-2.5">
                    <dt className="text-graphite">{s.label}</dt>
                    <dd className="t-price text-ink">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </Accordion>
            <Accordion title="Lieferung & Montage">
              <p className="mb-4">Kostenlose Lieferung in ganz Deutschland für alle Versandarten.</p>
              <DeliveryRates />
            </Accordion>
            {p.garantie && (
              <Accordion title="Garantie">
                <p className="flex gap-3">
                  <IconShield className="mt-1 shrink-0" />
                  <span>
                    <span className="font-medium">{p.garantie.duree} Monate.</span> {p.garantie.descriptif}
                  </span>
                </p>
              </Accordion>
            )}
            {p.etiquetteEnergie?.url && (
              <Accordion title="Energielabel">
                <div className="mx-auto max-w-[260px] bg-paper">
                  <ImageComponent img={p.etiquetteEnergie.url} alt={`Energielabel — ${title}`} size={520} className="h-auto w-full object-contain" />
                </div>
              </Accordion>
            )}
          </div>
        </div>
      </div>

      <section id="avis" className="border-t border-line py-20 lg:py-28">
        <div className="shell">
          <ProductReviews produitId={p._id} />
        </div>
      </section>

      {suggestions.length > 0 && (
        <section className="border-t border-line py-20 lg:py-28" aria-labelledby="suggestions">
          <div className="shell">
            <Reveal className="mb-12 flex flex-wrap items-end justify-between gap-6">
              <div>
                <h2 id="suggestions" className="t-h2">
                  Das könnte Ihnen auch gefallen
                </h2>
              </div>
              {category && (
                <Link href={`/categorie/${category.slug}`} className="t-eyebrow link-underline">
                  Alle Geräte in {category.nom}
                </Link>
              )}
            </Reveal>
            <Rail label="Ähnliche Produkte">
              {suggestions.map((s) => (
                <li key={s._id} className="w-[64vw] shrink-0 border border-line sm:w-[40vw] md:w-[30vw] lg:w-[23%]">
                  <ProductCard product={s} className="h-full" />
                </li>
              ))}
            </Rail>
          </div>
        </section>
      )}
    </>
  );
}
