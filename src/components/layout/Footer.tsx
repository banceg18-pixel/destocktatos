import Link from "next/link";
import type { MenuItem, SiteSettings } from "@/lib/cms/types";
import type { Category } from "@/types/catalog";
import { IconChevron, IconClock, IconMail, IconPhone, IconPin } from "@/components/ui/Icons";
import { FooterNewsletter, CookiePreferencesButton } from "./FooterClient";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const HELP: MenuItem[] = [
  { label: "Livraison et installation", href: "/services" },
  { label: "Conseils", href: "/conseils" },
  { label: "Questions fréquentes", href: "/faq" },
  { label: "Suivre une commande", href: "/compte/commandes" },
  { label: "Signaler un problème", href: "/signaler-bug" },
  { label: "Nous contacter", href: "/contact" },
];
const STORE: MenuItem[] = [
  { label: "Le magasin", href: "/a-propos" },
  { label: "Promotions", href: "/promotions" },
  { label: "Tout le catalogue", href: "/boutique" },
  { label: "Mon compte", href: "/compte" },
];

const linkClass = "link-underline text-[0.95rem] text-white/85 hover:text-paper";

/**
 * Rubrique de liens : accordéon sur mobile (titre et flèche, liste dépliée au toucher),
 * colonne de liens à partir de la tablette.
 */
function Group({ title, items }: { title: string; items: MenuItem[] }) {
  const list = (cls: string) => (
    <ul className={cls}>
      {items.map((it) => (
        <li key={it.href + it.label}>
          <Link href={it.href} className={linkClass}>
            {it.label}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      <details className="group border-b border-white/10 md:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 text-[0.95rem] font-medium [&::-webkit-details-marker]:hidden">
          {title}
          <IconChevron size={16} className="text-white/60 transition-transform duration-300 group-open:rotate-180" />
        </summary>
        {list("grid grid-cols-2 gap-x-4 gap-y-2.5 pb-4")}
      </details>
      <div className="hidden min-w-0 md:block">
        <h2 className="t-eyebrow mb-4 text-white/50 lg:mb-5">{title}</h2>
        {list("flex flex-col gap-2 lg:gap-2.5")}
      </div>
    </>
  );
}

/**
 * Pied de page : newsletter, rubriques, coordonnées et mentions. Il occupe la hauteur de l'écran
 * sous l'en-tête : arrivé en bas de page, tout est visible sans défiler davantage.
 */
export function Footer({ settings, legal, categories }: { settings: SiteSettings; legal: MenuItem[]; categories: Category[] }) {
  const tel = settings.phone.replace(/\s/g, "");
  const topCategories = [...categories]
    .filter((c) => (c.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, 6)
    .map((c) => ({ label: capitalize(c.nom), href: `/categorie/${c.slug}` }));

  return (
    <footer className="on-dark flex min-h-[calc(100svh-var(--header-h))] flex-col overflow-hidden bg-ink text-paper">
      <div className="shell grid gap-4 border-b border-white/10 py-6 md:gap-5 md:py-8 lg:grid-cols-[1.1fr_1fr] lg:items-end lg:gap-14 lg:py-12">
        <div className="max-w-md">
          <p className="font-display text-[clamp(1.45rem,2.6vw,2.4rem)] font-medium leading-[1.05] tracking-[-0.025em] [font-stretch:115%]">Les bonnes affaires, avant tout le monde.</p>
          <p className="mt-3 hidden text-white/65 sm:block">Une lettre par mois : arrivages, prix réduits et conseils d&apos;entretien. Désinscription en un clic.</p>
        </div>
        <FooterNewsletter />
      </div>

      <div className="shell flex flex-1 flex-col justify-center py-4 md:grid md:grid-cols-4 md:content-center md:gap-x-6 md:gap-y-8 md:py-8 lg:gap-x-8 lg:py-10">
        <Group title="Catégories" items={topCategories} />
        <Group title="Aide" items={HELP} />
        <Group title="Magasin" items={STORE} />
        <div className="min-w-0 pt-5 md:pt-0">
          <h2 className="t-eyebrow mb-3 text-white/50 md:mb-4 lg:mb-5">Nous trouver</h2>
          <ul className="flex flex-col gap-2.5 text-[0.9rem] text-white/85 lg:gap-3.5 lg:text-[0.95rem]">
            <li className="flex gap-3">
              <IconPin className="mt-0.5 shrink-0 text-white/50" />
              <span>
                {settings.addressLine}, <br className="hidden md:inline" />
                {settings.postalCode} {settings.city}
              </span>
            </li>
            <li className="flex gap-3">
              <IconPhone className="mt-0.5 shrink-0 text-white/50" />
              <a href={`tel:${tel}`} className="link-underline hover:text-paper">
                {settings.phone}
              </a>
            </li>
            <li className="flex gap-3">
              <IconMail className="mt-0.5 shrink-0 text-white/50" />
              <a href={`mailto:${settings.email}`} className="link-underline break-all hover:text-paper">
                {settings.email}
              </a>
            </li>
            <li className="flex gap-3">
              <IconClock className="mt-0.5 shrink-0 text-white/50" />
              <span>{settings.storeHours}</span>
            </li>
          </ul>
        </div>
      </div>

      <div className="shell flex flex-col gap-3 border-t border-white/10 py-5 text-[0.8rem] text-white/55 md:flex-row md:items-center md:justify-between md:text-sm">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-2 md:order-2 md:flex md:flex-wrap md:gap-x-5">
          {legal.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="link-underline hover:text-paper">
                {item.label}
              </Link>
            </li>
          ))}
          <li>
            <CookiePreferencesButton />
          </li>
        </ul>
        <p className="md:order-1">
          © {new Date().getFullYear()} {settings.siteName}. Tous droits réservés.
        </p>
      </div>
    </footer>
  );
}

export default Footer;
