import type { Metadata } from "next";

/** URL publique du site (jamais celle du site source) — sert aux canonicals et à Open Graph. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const DEFAULT_TITLE = "Destocktatos - Électromenager de qualité au meilleur prix";
export const DEFAULT_DESCRIPTION = "Produit électroménager de qualité au meilleur prix pour votre maison et votre entreprise.";
/** Visuel de partage (1200 × 630) et icône carrée (onglet, écran d'accueil, logo des moteurs de recherche). */
export const LOGO_PATH = "/assets/images/branding/logo-destocktatos.png";
export const ICON_PATH = "/assets/images/branding/icon-destocktatos.png";

/** Métadonnées racine (reprises du site source, domaine remplacé par SITE_URL). */
export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s | Destocktatos" },
  description: DEFAULT_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  keywords: ["Electromenager", "qualité", "prix", "maison", "entreprise"],
  creator: "Destocktatos",
  publisher: "Destocktatos",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-video-preview": -1, "max-image-preview": "large", "max-snippet": -1 },
  },
  alternates: { canonical: "/" },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? { google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION }
    : undefined,
  openGraph: {
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    url: "/",
    siteName: "Destocktatos",
    locale: "fr_FR",
    images: [{ url: LOGO_PATH, width: 1200, height: 630, alt: "Destocktatos" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [LOGO_PATH],
  },
  icons: { icon: ICON_PATH, shortcut: ICON_PATH, apple: ICON_PATH },
};

export function organizationJsonLd(phoneIntl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Destocktatos",
    url: SITE_URL,
    logo: `${SITE_URL}${ICON_PATH}`,
    description: "Électroménager de qualité au meilleur prix",
    address: { "@type": "PostalAddress", addressLocality: "France", addressCountry: "FR" },
    contactPoint: { "@type": "ContactPoint", telephone: phoneIntl, contactType: "customer service", availableLanguage: ["Français"] },
  };
}

/** Sérialisation JSON-LD sûre (pas d'injection de balise </script>). */
export function jsonLd(data: unknown) {
  return { __html: JSON.stringify(data).replace(/</g, "\\u003c") };
}
