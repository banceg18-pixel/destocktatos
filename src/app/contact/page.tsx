import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/common/PageHeader";
import { StoreLocation } from "@/components/common/StoreLocation";
import { ContactForm } from "@/components/forms/ContactForm";
import { Arrow } from "@/components/ui/Primitives";
import { IconClock, IconMail, IconPhone } from "@/components/ui/Icons";
import { getSiteSettings } from "@/lib/cms";

export const revalidate = 300;
export const metadata: Metadata = {
  title: "Contact",
  description: "Une question sur un appareil, une commande ou une livraison ? Écrivez-nous ou appelez le magasin.",
  alternates: { canonical: "/contact" },
};

export default async function ContactPage() {
  const settings = await getSiteSettings();
  const tel = settings.phone.replace(/\s/g, "");
  return (
    <>
      <PageHeader
        title="Parlons de votre projet."
        intro="Un appareil à choisir, une livraison à organiser, une question sur une commande : nous répondons par téléphone ou par email."
      />
      <div className="shell grid gap-14 pb-24 lg:grid-cols-[1.4fr_1fr] lg:gap-20">
        <section aria-labelledby="ecrire" className="border-t border-ink pt-6">
          <h2 id="ecrire" className="t-h3 mb-8">
            Nous écrire
          </h2>
          <ContactForm />
        </section>
        <aside aria-label="Nous joindre directement" className="flex flex-col gap-3 lg:pt-6">
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
              <span className="text-sm text-graphite">Réponse en général sous 24 heures</span>
            </span>
          </a>
          <div className="flex gap-4 bg-mist p-6">
            <IconClock className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">Magasin</span>
              <span className="text-sm text-graphite">{settings.storeHours}</span>
            </span>
          </div>
          <div className="mt-6 flex flex-col gap-3 border-t border-line pt-6 text-sm">
            <Link href="/faq" className="link-underline inline-flex items-center gap-2 self-start">
              Consulter les questions fréquentes <Arrow />
            </Link>
            <Link href="/signaler-bug" className="link-underline inline-flex items-center gap-2 self-start">
              Signaler un problème sur le site <Arrow />
            </Link>
          </div>
        </aside>
      </div>
      <StoreLocation settings={settings} />
    </>
  );
}
