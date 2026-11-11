"use client";

import Link from "next/link";
import { useCart } from "@/context/CartProvider";

/**
 * Bandeau de consentement. Le panier est conservé dans tous les cas (stockage nécessaire au
 * service) ; seul le choix sur la mesure d'audience est demandé.
 */
export function CookieConsentModal() {
  const { cookieConsentShown, acceptTerms, rejectTerms } = useCart();
  if (cookieConsentShown) return null;
  return (
    <div
      role="dialog"
      aria-label="Cookies und Reichweitenmessung"
      className="on-dark fixed inset-x-3 bottom-3 z-[250] animate-[slide-up_0.6s_var(--ease-out-expo)_both] rounded-md bg-ink p-5 text-paper shadow-2xl sm:inset-x-auto sm:left-5 sm:bottom-5 sm:max-w-[420px]"
    >
      <p className="text-sm leading-relaxed text-white/85">
        Ihr Warenkorb wird auf diesem Gerät gespeichert. Mit Ihrer Zustimmung erfassen wir zudem anonyme Nutzungsdaten zur Verbesserung unseres Angebots.{" "}
        <Link href="/politique-confidentialite" className="underline underline-offset-4 hover:text-paper">
          Mehr erfahren
        </Link>
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={rejectTerms} className="h-11 rounded-sm border border-white/30 text-xs font-medium uppercase tracking-[0.09em] transition-colors hover:border-paper">
          Ablehnen
        </button>
        <button type="button" onClick={acceptTerms} className="h-11 rounded-sm bg-paper text-xs font-medium uppercase tracking-[0.09em] text-ink transition-colors hover:bg-mist">
          Akzeptieren
        </button>
      </div>
    </div>
  );
}

export default CookieConsentModal;
