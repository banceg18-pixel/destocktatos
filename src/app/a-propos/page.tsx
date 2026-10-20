import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/common/PageHeader";
import { StoreLocation } from "@/components/common/StoreLocation";
import { Reveal } from "@/components/ui/Reveal";
import { TextReveal } from "@/components/ui/Motion";
import { getPage, getSiteSettings } from "@/lib/cms";


type Item = { icon?: string; title: string; text: string };
interface AboutContent {
  intro: string;
  history: { title: string; paragraphs: string[]; image: string; imageAlt: string };
  mission: { title: string; items: Item[] };
  commitments: { title: string; columns: Item[][] };
  values: { title: string; items: Item[] };
}

export async function generateMetadata(): Promise<Metadata> {
  const [page, settings] = await Promise.all([getPage<AboutContent>("a-propos"), getSiteSettings()]);
  return {
    title: page?.metaTitle ?? `À propos de ${settings.siteName}`,
    description: page?.data?.intro.slice(0, 160),
    alternates: { canonical: "/a-propos" },
  };
}

function ItemGrid({ items }: { items: Item[] }) {
  return (
    <ul className="grid border-t border-line md:grid-cols-3">
      {items.map((it, i) => (
        <Reveal as="li" key={it.title} delay={i * 80} className="border-b border-line py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0">
          <h3 className="t-h3">{it.title}</h3>
          <p className="mt-4 text-graphite">{it.text}</p>
        </Reveal>
      ))}
    </ul>
  );
}

export default async function AboutPage() {
  const [page, settings] = await Promise.all([getPage<AboutContent>("a-propos"), getSiteSettings()]);
  const c = page!.data!;
  const commitments = c.commitments.columns.flat();

  return (
    <>
      <PageHeader title={settings.siteName} />

      <section className="shell pb-20 lg:pb-28">
        <TextReveal text={c.intro} className="max-w-5xl font-display text-[clamp(1.6rem,3.2vw,3rem)] leading-[1.15] tracking-[-0.02em] [font-stretch:108%]" />
      </section>

      <section className="border-t border-line py-20 lg:py-28" aria-labelledby="histoire">
        <div className="shell grid items-start gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
          <Reveal mask className="relative aspect-[3/4] overflow-hidden bg-mist lg:sticky lg:top-[calc(var(--header-h)+28px)]">
            <Image src={c.history.image} alt={c.history.imageAlt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
          </Reveal>
          <div>
            <h2 id="histoire" className="t-h2">
              {c.history.title}
            </h2>
            <div className="mt-8 flex flex-col gap-5 text-[1.05rem] leading-relaxed text-ink-soft">
              {c.history.paragraphs.map((p, i) => (
                <Reveal as="p" key={i} delay={i * 60}>
                  {p}
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20 lg:py-28" aria-labelledby="mission">
        <div className="shell">
          <h2 id="mission" className="t-h2 mb-12">
            {c.mission.title}
          </h2>
          <ItemGrid items={c.mission.items} />
        </div>
      </section>

      <section className="on-dark bg-ink py-20 text-paper lg:py-28" aria-labelledby="engagements">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
          <div>
            <h2 id="engagements" className="t-h2">
              {c.commitments.title}
            </h2>
          </div>
          <ul className="flex flex-col">
            {commitments.map((it, i) => (
              <Reveal as="li" key={it.title} delay={i * 60} className="border-t border-white/15 py-7 first:border-t-0 first:pt-0">
                <h3 className="t-h3">{it.title}</h3>
                <p className="mt-3 text-white/65">{it.text}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="py-20 lg:py-28" aria-labelledby="valeurs">
        <div className="shell">
          <h2 id="valeurs" className="t-h2 mb-12">
            {c.values.title}
          </h2>
          <ItemGrid items={c.values.items} />
        </div>
      </section>

      <StoreLocation settings={settings} title="Venir au magasin" />
    </>
  );
}
