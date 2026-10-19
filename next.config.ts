import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

/** Médias WordPress (bibliothèque wp-content/uploads), déduits de WORDPRESS_API_URL. */
function wordpressMedia(): NonNullable<NonNullable<NextConfig["images"]>["remotePatterns"]> {
  try {
    const u = new URL(process.env.WORDPRESS_API_URL || "");
    return [{ protocol: u.protocol === "http:" ? "http" : "https", hostname: u.hostname, port: u.port, pathname: "/wp-content/uploads/**" }];
  } catch {
    return [];
  }
}

const nextConfig: NextConfig = {
  // Dossier de build séparable (ex. NEXT_DIST_DIR=.next-dev pour un serveur de dev à côté d'un serveur de production).
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  // Contenus éditoriaux lus à l'exécution (fournisseur « local », export WordPress) : inclus dans les fonctions serveur.
  outputFileTracingIncludes: { "/**": ["./data/content/**/*"] },
  // Métadonnées (titre, description, aperçus) toujours envoyées dans le <head> de la page, et non en
  // flux en fin de document : forme la plus sûre pour les moteurs de recherche et les aperçus de liens.
  htmlLimitedBots: /.*/,
  // Un seul processus de build pour la collecte et la génération des pages : par défaut Next.js en lance
  // un par processeur annoncé, ce qui dépasse la limite de processus d'un hébergement mutualisé (Hostinger).
  experimental: { cpus: 1 },
  images: {
    // Variantes WebP générées une fois puis gardées 30 jours (les visuels produits changent rarement) ;
    // pas de largeur au-delà de 1920 px : inutile pour ce site et coûteux à produire.
    minimumCacheTTL: 2_592_000,
    deviceSizes: [640, 750, 828, 1080, 1280, 1600, 1920],
    // Toutes les images sont locales (/public/assets) ; ajoutez ici l'hôte des médias WordPress si besoin.
    remotePatterns: [...wordpressMedia(), ...(process.env.WORDPRESS_MEDIA_HOST ? [{ protocol: "https" as const, hostname: process.env.WORDPRESS_MEDIA_HOST }] : [])],
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Images et documents de /public : mis en cache par le navigateur et les CDN (7 jours, puis revalidation).
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
