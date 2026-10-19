import Link from "next/link";
import type { ReactNode } from "react";
import { fieldClasses } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";

const BENEFITS = ["Suivez vos commandes et téléchargez vos factures", "Enregistrez vos adresses de livraison", "Donnez votre avis sur vos achats", "Profitez des codes de fidélité"];

/**
 * Mise en page des écrans d'authentification : panneau encre (avantages du compte) et formulaire.
 * Sur mobile, seul le formulaire est affiché sous le titre.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-[1fr_1.1fr]">
      <aside className="on-dark relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex xl:p-16">
        <div>
          <p className="t-h2 max-w-md">Tout votre équipement, au même endroit.</p>
          <ul className="mt-10 flex flex-col gap-4 text-white/80">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <IconCheck size={18} className="mt-0.5 shrink-0" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/45">
          Besoin d&apos;aide ?{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-paper">
            Contactez le magasin
          </Link>
        </p>
      </aside>
      <div className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="w-full max-w-md">
          <h1 className="t-h2 animate-[slide-up_0.8s_var(--ease-out-expo)_both]">{title}</h1>
          {subtitle && <p className="mt-4 text-graphite">{subtitle}</p>}
          <div className="mt-10">{children}</div>
          {footer && <div className="mt-10 border-t border-line pt-6 text-sm">{footer}</div>}
        </div>
      </div>
    </div>
  );
}

export const authInputClass = `${fieldClasses()} h-12`;
