import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { StoreLocation } from "@/components/common/StoreLocation";
import { ContactForm } from "@/components/forms/ContactForm";
import { Arrow } from "@/components/ui/Primitives";
import { IconClock, IconMail, IconPhone } from "@/components/ui/Icons";
import { getSiteSettings } from "@/lib/cms";

export const metadata: Metadata = {
  title: "Kontakt",
  description: "Fragen zu einem Gerät, einer Bestellung oder Lieferung? Schreiben Sie uns oder rufen Sie uns an.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const tel = settings.phone.replace(/\s/g, "");
  return (
    <>
      <PageHeader
        title="Lassen Sie uns über Ihr Vorhaben sprechen."
        intro="Ein passendes Gerät auswählen, eine Lieferung organisieren oder eine Frage zu Ihrer Bestellung: Wir antworten telefonisch oder per E-Mail."
      />
      <div className="shell grid gap-14 pb-24 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
        <section aria-labelledby="ecrire" className="border-t border-ink pt-6">
          <h2 id="ecrire" className="t-h3 mb-8">
            Schreiben Sie uns
          </h2>
          <ContactForm />
        </section>
        <aside aria-label="Direkt kontaktieren" className="flex flex-col gap-3 lg:pt-6">
          <a href={`tel:${tel}`} className="group flex gap-4 bg-mist p-6 transition-colors hover:bg-mist-deep">
            <IconPhone className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">{settings.phone}</span>
              <span className="text-sm text-graphite">{settings.hours}</span>
            </span>
          </a>
          <a href={`mailto:${settings.email}`} className="group flex gap-4 bg-mist p-6 transition-colors hover:bg-mist-deep">
            <IconMail className="mt-0.5 shrink-0" />
            <span className="min-w-0">
              <span className="block break-all font-medium">{settings.email}</span>
              <span className="text-sm text-graphite">Antwort in der Regel innerhalb von 24 Stunden</span>
            </span>
          </a>
          <div className="flex gap-4 bg-mist p-6">
            <IconClock className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">Filiale</span>
              <span className="text-sm text-graphite">{settings.storeHours}</span>
            </span>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 text-sm">
            <Link href="/faq" className="link-underline inline-flex items-center gap-2 self-start">
              Häufige Fragen ansehen <Arrow />
            </Link>
            <Link href="/signaler-bug" className="link-underline inline-flex items-center gap-2 self-start">
              Ein Problem auf der Website melden <Arrow />
            </Link>
          </div>
        </aside>
      </div>
      <StoreLocation settings={settings} />
    </>
  );
}
