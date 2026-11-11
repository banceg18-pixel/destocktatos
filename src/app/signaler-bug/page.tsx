import type { Metadata } from "next";
import { PageHeader } from "@/components/common/PageHeader";
import { TicketForm } from "@/components/forms/TicketForm";

export const metadata: Metadata = { title: "Problem melden", robots: { index: false, follow: true } };

const TIPS = [
  "Beschreiben Sie, was Sie kurz vor Auftreten des Problems getan haben.",
  "Geben Sie an, was angezeigt wurde und was Sie erwartet hatten.",
  "Ein Screenshot hilft uns sehr dabei, das Problem schnell zu beheben.",
];

export default function SignalerBugPage() {
  return (
    <>
      <PageHeader
        title="Problem melden"
        intro="Eine Seite lädt nicht, ein Button reagiert nicht oder Sie haben einen Verbesserungsvorschlag? Teilen Sie es uns mit – wir prüfen jede Meldung sorgfältig."
      />
      <div className="shell grid gap-12 pb-24 lg:grid-cols-[1.5fr_1fr] lg:gap-20">
        <section aria-label="Meldeformular" className="border-t border-ink pt-8">
          <TicketForm />
        </section>
        <aside className="self-start bg-mist p-6 lg:p-8">
          <h2 className="t-h3">Hilfreiche Hinweise</h2>
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
