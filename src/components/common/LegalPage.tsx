import { slugify } from "@/lib/text";
import type { PageContent } from "@/lib/cms/types";
import { ContentBlocks } from "./ContentBlocks";
import { PageHeader } from "./PageHeader";

export interface LegalData {
  titlePrefix: string;
  titleHighlight: string;
}

/**
 * Gabarit des pages légales (CGV, mentions, confidentialité) alimenté par le CMS : sommaire
 * cliquable, sections numérotées par le contenu lui-même, date de mise à jour seulement si le CMS
 * en fournit une.
 */
export function LegalPage({ page }: { page: PageContent<LegalData> }) {
  const sections = page.sections ?? [];
  const title = [page.data?.titlePrefix, page.data?.titleHighlight].filter(Boolean).join(" ") || page.title;
  const updated = page.updatedAt ? new Date(page.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : null;
  return (
    <>
      <PageHeader title={title} meta={updated ? <p className="t-spec text-graphite">Mise à jour le {updated}</p> : undefined} />
      <div className="shell grid gap-12 pb-24 lg:grid-cols-[260px_minmax(0,1fr)] lg:gap-20">
        <nav aria-label="Sommaire" className="hidden lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:block lg:max-h-[calc(100dvh-var(--header-h)-56px)] lg:self-start lg:overflow-y-auto">
          <ol className="flex flex-col gap-2 text-sm">
            {sections.map((s) => (
              <li key={s.title}>
                <a href={`#${slugify(s.title)}`} className="text-graphite hover:text-ink hover:underline">
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <div className="max-w-3xl">
          {sections.map((s) => (
            <section key={s.title} id={slugify(s.title)} className="scroll-mt-28 border-t border-line py-8 first:border-t-0 first:pt-0">
              <h2 className="t-h3 mb-5">{s.title}</h2>
              <div className="prose-legal">
                <ContentBlocks blocks={s.blocks} classes={{ h3: "mb-3 mt-6 font-sans text-base font-semibold tracking-normal [font-stretch:100%]" }} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </>
  );
}

export default LegalPage;
