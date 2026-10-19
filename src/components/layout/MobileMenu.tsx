"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import type { CSSProperties } from "react";
import type { MenuItem, SiteSettings } from "@/lib/cms/types";
import type { Category } from "@/types/catalog";
import { cn } from "@/lib/client/cn";
import { Drawer } from "@/components/ui/Drawer";
import { Accordion } from "@/components/ui/Primitives";
import { IconMail, IconPhone, IconUser } from "@/components/ui/Icons";

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Menu mobile plein écran (fond encre) : liens principaux, catégories, compte, contact. */
export function MobileMenu({
  open,
  onClose,
  menu,
  categories,
  settings,
}: {
  open: boolean;
  onClose: () => void;
  menu: MenuItem[];
  categories: Category[];
  settings: SiteSettings;
}) {
  const { status } = useSession();
  const tel = settings.phone.replace(/\s/g, "");
  return (
    <Drawer open={open} onClose={onClose} title="Menu" id="menu-mobile" closeLabel="Fermer le menu" tone="ink" side="right" className="max-w-none sm:max-w-[520px]">
      <nav aria-label="Menu mobile" className="px-6 pb-10 pt-4">
        <ul>
          {menu.map((item, i) => (
            <li key={item.href} className="border-b border-white/10">
              <Link
                href={item.href}
                data-cy={item.dataCy}
                onClick={onClose}
                className={cn("block py-4 font-display text-[2rem] leading-none tracking-tight [font-stretch:115%]", open && "animate-[slide-up_0.7s_var(--ease-out-expo)_both]")}
                style={{ animationDelay: `${120 + i * 60}ms` } as CSSProperties}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>

        <Accordion title={<span className="t-eyebrow">Toutes les catégories</span>} className="mt-4 border-white/10 [&_.text-ink-soft]:text-white/80">
          <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link href={`/categorie/${c.slug}`} onClick={onClose} className="flex items-baseline justify-between gap-2 text-sm text-white/85 hover:text-paper">
                  <span>{capitalize(c.nom)}</span>
                  <span className="t-spec text-white/45">{c.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Accordion>

        <div className="mt-10 flex flex-col gap-4 text-sm text-white/80">
          <Link href={status === "authenticated" ? "/compte" : "/connexion"} onClick={onClose} className="inline-flex items-center gap-3 hover:text-paper">
            <IconUser /> {status === "authenticated" ? "Mon compte" : "Se connecter ou créer un compte"}
          </Link>
          <a href={`tel:${tel}`} className="inline-flex items-center gap-3 hover:text-paper">
            <IconPhone /> {settings.phone}
          </a>
          <a href={`mailto:${settings.email}`} className="inline-flex items-center gap-3 break-all hover:text-paper">
            <IconMail /> {settings.email}
          </a>
          <p className="t-spec mt-2 text-white/45">{settings.storeHours}</p>
        </div>
      </nav>
    </Drawer>
  );
}
