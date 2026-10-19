import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { TicketForm } from "@/components/forms/TicketForm";

export const metadata: Metadata = { title: "Signaler un problème", robots: { index: false, follow: true } };

const TIPS = [
  "Décrivez ce que vous faisiez juste avant le problème.",
  "Indiquez ce qui s'est affiché, et ce que vous attendiez.",
  "Une capture d'écran nous fait gagner beaucoup de temps.",
];

export default function SignalerBugPage() {
  return (
    <>
      <PageHeader
        title="Signaler un problème"
        intro="Une page qui ne s'affiche pas, un bouton qui ne répond pas, une idée d'amélioration : dites-le-nous, nous lisons chaque signalement."
      />
      <div className="shell grid gap-12 pb-24 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
        <section aria-label="Formulaire de signalement" className="border-t border-ink pt-8">
          <TicketForm />
        </section>
        <aside className="self-start bg-mist p-6 lg:p-8">
          <h2 className="t-h3">Ce qui nous aide</h2>
          <ul className="mt-6 flex flex-col gap-4 text-sm text-ink-soft">
            {TIPS.map((t) => (
              <li key={t} className="border-t border-line pt-4 first:border-t-0 first:pt-0">
                {t}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
