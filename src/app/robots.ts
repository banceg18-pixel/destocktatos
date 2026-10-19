import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** robots.txt (mêmes règles que la source, domaine local). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/admin/", "/connexion", "/inscription", "/compte", "/paiement", "/panier", "/confirmation"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
