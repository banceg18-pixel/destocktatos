import Image from "next/image";
import type { SiteSettings } from "@/lib/cms/types";
import { Reveal } from "@/components/ui/Reveal";
import { IconClock, IconMail, IconPhone, IconPin } from "@/components/ui/Icons";

/**
 * Coordonnées du magasin (réglages du site) et carte intégrée. La carte Google Maps est la seule
 * ressource tierce de ces pages ; elle n'est chargée qu'à l'approche de la section (lazy).
 */
export function StoreLocation({ settings, title = "Nous trouver" }: { settings: SiteSettings; title?: string }) {
  const tel = settings.phone.replace(/\s/g, "");
  const mapUrl = `https://www.google.com/maps?q=${encodeURIComponent(settings.mapQuery)}&output=embed`;
  return (
    <section className="border-t border-line py-20 lg:py-28" aria-labelledby="magasin-titre">
      <div className="shell grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:gap-20">
        <Reveal>
          <h2 id="magasin-titre" className="t-h2">
            {title}
          </h2>
          <ul className="mt-10 flex flex-col gap-5">
            <li className="flex gap-4">
              <IconPin className="mt-0.5 shrink-0" />
              <span>
                {settings.addressLine}
                <br />
                {settings.postalCode} {settings.city}
              </span>
            </li>
            <li className="flex gap-4">
              <IconClock className="mt-0.5 shrink-0" />
              <span>{settings.storeHours}</span>
            </li>
            <li className="flex gap-4">
              <IconPhone className="mt-0.5 shrink-0" />
              <a href={`tel:${tel}`} className="link-underline">
                {settings.phone}
              </a>
            </li>
            <li className="flex gap-4">
              <IconMail className="mt-0.5 shrink-0" />
              <a href={`mailto:${settings.email}`} className="link-underline break-all">
                {settings.email}
              </a>
            </li>
          </ul>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(settings.mapQuery)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="t-eyebrow link-underline mt-10 inline-block"
          >
            Itinéraire dans Google Maps ↗
          </a>
        </Reveal>
        <div className="relative aspect-[4/3] overflow-hidden bg-mist lg:aspect-auto lg:min-h-[420px]">
          {/* Photo affichée tant que le plan (chargé à l'approche de la section) n'est pas là. */}
          <Image src="/assets/images/libres/cuisine-equipee.jpg" alt="" fill sizes="(min-width: 1024px) 60vw, 100vw" className="object-cover" />
          <iframe
            src={mapUrl}
            title={`Plan d'accès — ${settings.addressLine}, ${settings.city}`}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="absolute inset-0 size-full border-0 grayscale-[0.85]"
          />
        </div>
      </div>
    </section>
  );
}
