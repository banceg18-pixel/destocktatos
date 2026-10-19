import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Accordion, Arrow } from "@/components/ui/Primitives";
import { Reveal } from "@/components/ui/Reveal";
import { getFaq } from "@/lib/cms";
import { jsonLd } from "@/lib/seo";
import { slugify } from "@/lib/text";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Questions fréquentes",
  description: "Commandes, livraison, installation, paiement, garantie : les réponses aux questions les plus courantes.",
  alternates: { canonical: "/faq" },
};

export default async function FaqPage() {
  const categories = await getFaq();
  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: categories.flatMap((c) => c.items.map((i) => ({ "@type": "Question", name: i.question, acceptedAnswer: { "@type": "Answer", text: i.answer } }))),
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd)} />
      <PageHeader title="Questions fréquentes" intro="Les réponses aux questions que l'on nous pose le plus souvent. Vous ne trouvez pas la vôtre ? Écrivez-nous." />
      <div className="shell grid gap-12 pb-24 lg:grid-cols-[240px_1fr] lg:gap-20">
        <nav aria-label="Thèmes" className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:self-start">
          <ul className="scroll-x -mx-[clamp(20px,3.4vw,48px)] flex gap-2 px-[clamp(20px,3.4vw,48px)] lg:mx-0 lg:flex-col lg:gap-0 lg:px-0">
            {categories.map((c) => (
              <li key={c.title} className="shrink-0">
                <a href={`#${slugify(c.title)}`} className="block whitespace-nowrap rounded-full border border-line px-4 py-2 text-sm transition-colors hover:border-ink lg:rounded-none lg:border-0 lg:border-l-2 lg:border-transparent lg:py-2.5 lg:text-graphite lg:hover:border-ink lg:hover:text-ink">
                  {c.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex min-w-0 flex-col gap-16">
          {categories.map((c) => (
            <Reveal as="section" key={c.title} id={slugify(c.title)} className="scroll-mt-28" aria-labelledby={`${slugify(c.title)}-titre`}>
              <h2 id={`${slugify(c.title)}-titre`} className="t-h3 border-b border-ink pb-4">
                {c.title}
              </h2>
              {c.items.map((it) => (
                <Accordion key={it.question} title={it.question} name={slugify(c.title)}>
                  {it.answer}
                </Accordion>
              ))}
            </Reveal>
          ))}
          <div className="flex flex-col items-start gap-6 bg-mist p-8 lg:p-10">
            <p className="t-h3">Toujours une question ?</p>
            <p className="text-graphite">Un conseiller vous répond par téléphone ou par email, 7 jours sur 7.</p>
            <ButtonLink href="/contact" icon={<Arrow />}>
              Nous contacter
            </ButtonLink>
          </div>
        </div>
      </div>
    </>
  );
}
