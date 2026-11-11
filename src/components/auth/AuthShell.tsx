import Link from "next/link";
import type { ReactNode } from "react";
import { fieldClasses } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";

const BENEFITS = [
  "Bestellungen verfolgen und Rechnungen herunterladen",
  "Lieferadressen bequem speichern",
  "Bewertungen zu Ihren Einkäufen abgeben",
  "Von Treuegutscheinen und Rabatten profitieren",
];

/**
 * Mise en page des écrans d'authentification : panneau encre (avantages du compte) et formulaire.
 * Sur mobile, seul le formulaire est affiché sous le titre.
 */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-[calc(100dvh-var(--header-h))] lg:grid-cols-[1fr_1.1fr]">
      <aside className="on-dark relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-paper lg:flex xl:p-16">
        <div>
          <p className="t-h2 max-w-md">Ihre Haushaltsgeräte an einem Ort.</p>
          <ul className="mt-10 flex flex-col gap-4 text-white/80">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <IconCheck size={18} className="mt-0.5 shrink-0" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm text-white/45">
          Brauchen Sie Hilfe?{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-paper">
            Kontaktieren Sie uns
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
