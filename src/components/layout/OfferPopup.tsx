"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { BIG_TICKET_OFFER } from "@/lib/offers";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { IconClose } from "@/components/ui/Icons";
import { lockScroll } from "@/components/ui/Drawer";

const SEEN_KEY = "offre10Vue";
const DELAY_MS = 10_000;
/** Pas d'interruption pendant la commande ni sur les pages de compte. */
const QUIET = ["/panier", "/paiement", "/confirmation", "/connexion", "/inscription", "/compte"];

/**
 * Popup de l'offre -10 % sur les produits de plus de 1 000 € : il apparaît 10 s après que le
 * visiteur a commencé à faire défiler le site, une seule fois (mémorisé sur l'appareil).
 * L'offre est réellement appliquée au panier et à la commande (`lib/offers`).
 */
export function OfferPopup() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const quietRef = useRef(quiet);
  quietRef.current = quiet;

  useEffect(() => {
    try {
      if (localStorage.getItem(SEEN_KEY)) return;
    } catch {
      /* stockage indisponible : le popup peut s'afficher, sans mémorisation */
    }
    let timer: number | undefined;
    const start = () => {
      window.removeEventListener("scroll", start);
      timer = window.setTimeout(() => !quietRef.current && setOpen(true), DELAY_MS);
    };
    window.addEventListener("scroll", start, { passive: true });
    return () => {
      window.removeEventListener("scroll", start);
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* rien à mémoriser */
    }
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("a[href]")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlock();
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4">
      <button type="button" aria-label="Fermer l'offre" className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" onClick={() => setOpen(false)} tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-[420px] animate-[slide-up_0.6s_var(--ease-out-expo)_both] bg-paper p-7 text-center shadow-2xl sm:p-9"
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Fermer"
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-graphite hover:bg-mist hover:text-ink"
        >
          <IconClose size={18} />
        </button>
        <p className="t-eyebrow text-graphite">Offre spéciale déstockage</p>
        <p className="mt-4 font-display text-[clamp(3.5rem,14vw,5rem)] font-semibold leading-none tracking-[-0.04em] text-promo [font-stretch:120%]">
          -{BIG_TICKET_OFFER.percent} %
        </p>
        <h2 id={titleId} className="t-h3 mt-4">
          sur tous les produits de plus de 1 000 €
        </h2>
        <p className="mt-3 text-sm text-graphite">
          En plus des prix de déstockage. La réduction s&apos;applique automatiquement dans votre panier, sans code à saisir.
        </p>
        <ButtonLink href="/boutique?prixMin=1000&tri=prix-asc" size="lg" block className="mt-7" icon={<Arrow />} onClick={() => setOpen(false)}>
          Voir les produits concernés
        </ButtonLink>
        <button type="button" onClick={() => setOpen(false)} className="mt-4 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline">
          Continuer ma visite
        </button>
      </div>
    </div>
  );
}
