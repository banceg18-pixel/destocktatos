"use client";

import { useCart } from "@/context/CartProvider";
import { NewsletterForm } from "@/components/forms/NewsletterForm";

/** Newsletter du pied de page (composant commun, fond encre). */
export function FooterNewsletter() {
  return <NewsletterForm tone="ink" compact />;
}

/** Rouvre le bandeau de consentement pour modifier son choix. */
export function CookiePreferencesButton() {
  const { resetCookieConsent } = useCart();
  return (
    <button type="button" onClick={resetCookieConsent} className="link-underline hover:text-paper">
      Préférences cookies
    </button>
  );
}
