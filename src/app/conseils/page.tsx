import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { PageHeader } from "@/components/common/PageHeader";
import { Reveal } from "@/components/ui/Reveal";
import { Arrow } from "@/components/ui/Primitives";
import { getPosts } from "@/lib/cms";
import { readingMinutes } from "@/lib/cms/sanitize";

export const metadata: Metadata = {
  title: "Ratgeber",
  description: "Kaufratgeber, Pflegetipps und Services: unsere Empfehlungen für eine gute Wahl und lange Lebensdauer Ihrer Haushaltsgeräte.",
  alternates: { canonical: "/conseils" },
};

const dateDe = (iso: string) => new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });

/** Liste des articles (publiés depuis WordPress, ou fichiers locaux). */
export default async function ConseilsPage() {
  const posts = await getPosts();
  const [first, ...rest] = posts;
  return (
    <>
      <PageHeader
        title="Gut wählen, gut pflegen."
        intro="Kaufratgeber, Pflegetipps und Liefervorbereitung: was unsere Verkäufer und Techniker täglich im Laden erklären."
      />
      <div className="shell pb-24">
        {!first && <p className="t-lead text-graphite">Noch keine Artikel veröffentlicht.</p>}
        {first && (
          <Reveal>
            <Link href={`/conseils/${first.slug}`} className="group grid gap-8 border-t border-ink pt-8 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
              <div className="relative aspect-[16/10] overflow-hidden bg-mist">
                {first.image && <Image src={first.image} alt={first.imageAlt ?? ""} fill priority sizes="(min-width: 1024px) 55vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
              </div>
              <div className="flex flex-col justify-center">
                <p className="t-spec text-graphite">
                  {[first.category, dateDe(first.date), `${readingMinutes(first.content)} Min. Lesezeit`].filter(Boolean).join(" · ")}
                </p>
                <h2 className="t-h2 mt-5">{first.title}</h2>
                <p className="t-lead mt-5 text-graphite">{first.excerpt}</p>
                <span className="t-eyebrow mt-8 inline-flex items-center gap-3">
                  Artikel lesen <Arrow />
                </span>
              </div>
            </Link>
          </Reveal>
        )}
        {rest.length > 0 && (
          <ul className="mt-16 grid gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((p, i) => (
              <Reveal as="li" key={p.slug} delay={Math.min(i, 5) * 80}>
                <Link href={`/conseils/${p.slug}`} className="group block">
                  <div className="relative aspect-[4/3] overflow-hidden bg-mist">
                    {p.image && <Image src={p.image} alt={p.imageAlt ?? ""} fill sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />}
                  </div>
                  <p className="t-spec mt-5 text-graphite">{[p.category, dateDe(p.date)].filter(Boolean).join(" · ")}</p>
                  <h2 className="t-h3 mt-3">{p.title}</h2>
                  <p className="mt-3 text-graphite">{p.excerpt}</p>
                </Link>
              </Reveal>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
