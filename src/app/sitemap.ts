import type { MetadataRoute } from "next";
import { getAllProductSlugs, getCategories } from "@/lib/catalog/repository";
import { SITE_URL } from "@/lib/seo";
import { getPosts } from "@/lib/cms";

export const revalidate = 3600;

/** Plan du site (mêmes pages et priorités que le sitemap source, domaine local). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const statics: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 0.9, "daily"],
    ["/boutique", 1, "daily"],
    ["/services", 0.4, "monthly"],
    ["/contact", 0.3, "yearly"],
    ["/faq", 0.3, "yearly"],
    ["/a-propos", 0.3, "yearly"],
    ["/mentions-legales", 0.2, "yearly"],
    ["/politique-confidentialite", 0.2, "yearly"],
    ["/cgv", 0.2, "yearly"],
    ["/promotions", 0.6, "weekly"],
    ["/conseils", 0.5, "weekly"],
  ];
  const [categories, products, posts] = await Promise.all([getCategories(), getAllProductSlugs(), getPosts()]);
  return [
    ...statics.map(([path, priority, changeFrequency]) => ({ url: `${SITE_URL}${path}`, lastModified: now, changeFrequency, priority })),
    ...categories.map((c) => ({ url: `${SITE_URL}/categorie/${c.slug}`, lastModified: now, changeFrequency: "weekly" as const, priority: 0.6 })),
    ...products.map((p) => ({ url: `${SITE_URL}/boutique/${p.slug}`, lastModified: p.updatedAt, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...posts.map((p) => ({ url: `${SITE_URL}/conseils/${p.slug}`, lastModified: new Date(p.modified ?? p.date), changeFrequency: "monthly" as const, priority: 0.5 })),
  ];
}
