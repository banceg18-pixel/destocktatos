import type { Metadata } from "next";
import Image from "next/image";
import { PageHeader } from "@/components/common/PageHeader";
import { DeliveryRates } from "@/components/common/DeliveryRates";
import { StoreLocation } from "@/components/common/StoreLocation";
import { ContactServicesForm } from "@/components/forms/ContactServicesForm";
import { Reveal } from "@/components/ui/Reveal";
import { IconCheck } from "@/components/ui/Icons";
import { cn } from "@/lib/client/cn";
import { getPage, getSiteSettings } from "@/lib/cms";

export const revalidate = 300;

interface ServicesContent {
  intro: string;
  services: { id: string; image: string; imageAlt: string; title: string; text: string; points: string[] }[];
  rates: { title: string; text: string };
  quote: { title: string; text: string };
  location: { title: string };
}

export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage<ServicesContent>("services");
  return { title: page?.metaTitle ?? "Services", description: page?.metaDescription, alternates: { canonical: "/services" } };
}

export default async function ServicesPage() {
  const [page, settings] = await Promise.all([getPage<ServicesContent>("services"), getSiteSettings()]);
  const c = page!.data!;

  return (
    <>
      <PageHeader title="Livré, installé, suivi." intro={c.intro} />

      <div className="shell flex flex-col gap-20 pb-24 lg:gap-32">
        {c.services.map((s, i) => (
          <section key={s.id} id={s.id} className="grid scroll-mt-28 items-center gap-10 lg:grid-cols-2 lg:gap-20" aria-labelledby={`svc-${s.id}`}>
            <Reveal mask className={cn("relative aspect-[4/3] overflow-hidden bg-mist", i % 2 === 1 && "lg:order-2")}>
              <Image src={s.image} alt={s.imageAlt} fill sizes="(min-width: 1024px) 45vw, 100vw" className="object-cover" />
            </Reveal>
            <Reveal delay={120}>
              <p className="t-spec mb-5 text-graphite">{String(i + 1).padStart(2, "0")}</p>
              <h2 id={`svc-${s.id}`} className="t-h2">
                {s.title}
              </h2>
              <p className="t-lead mt-6 text-graphite">{s.text}</p>
              <ul className="mt-8 flex flex-col gap-3 border-t border-line pt-6">
                {s.points.map((p) => (
                  <li key={p} className="flex gap-3">
                    <IconCheck size={18} className="mt-0.5 shrink-0" /> {p}
                  </li>
                ))}
              </ul>
            </Reveal>
          </section>
        ))}
      </div>

      <section id="tarifs" className="scroll-mt-28 border-t border-line py-20 lg:py-28" aria-labelledby="tarifs-titre">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <Reveal className="min-w-0">
            <h2 id="tarifs-titre" className="t-h2">
              {c.rates.title}
            </h2>
            <p className="mt-6 text-graphite">{c.rates.text}</p>
          </Reveal>
          <Reveal delay={100} className="min-w-0">
            <DeliveryRates />
          </Reveal>
        </div>
      </section>

      <section id="rendez-vous" className="scroll-mt-28 bg-mist py-20 lg:py-28" aria-labelledby="rdv-titre">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <h2 id="rdv-titre" className="t-h2">
              {c.quote.title}
            </h2>
            <p className="mt-6 text-graphite">{c.quote.text}</p>
          </div>
          <div className="min-w-0 bg-paper p-6 sm:p-10">
            <ContactServicesForm />
          </div>
        </div>
      </section>

      <StoreLocation settings={settings} title={c.location.title} />
    </>
  );
}
