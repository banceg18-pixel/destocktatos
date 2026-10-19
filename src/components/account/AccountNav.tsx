"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";
import { LogoutButton } from "./LogoutButton";

const ITEMS = [
  { href: "/compte", label: "Tableau de bord" },
  { href: "/compte/commandes", label: "Mes commandes" },
  { href: "/compte/ajouter-adresse", label: "Ajouter une adresse" },
  { href: "/compte/profil", label: "Mon profil" },
];

/**
 * Navigation de l'espace client : grille de 2 × 2 onglets sur mobile (tout est visible, sans
 * défilement horizontal), colonne sur ordinateur.
 */
export function AccountNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Espace client" className="min-w-0 lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:self-start">
      <ul className="grid grid-cols-2 gap-2 lg:flex lg:flex-col lg:gap-0">
        {ITEMS.map((it) => {
          const active = pathname === it.href;
          return (
            <li key={it.href} className="min-w-0">
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full items-center justify-center rounded-sm border px-3 py-2.5 text-center text-sm leading-tight transition-colors lg:justify-start lg:rounded-none lg:border-0 lg:border-l-2 lg:px-4 lg:py-3 lg:text-left",
                  active ? "border-ink bg-ink text-paper lg:bg-transparent lg:font-medium lg:text-ink" : "border-line hover:border-ink lg:border-transparent lg:text-graphite lg:hover:text-ink",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="mt-8 hidden border-t border-line pt-6 lg:block">
        <LogoutButton />
      </div>
    </nav>
  );
}
