import "server-only";
import { memo } from "@/lib/server/memo";
import { currentVersion, syncCaches } from "@/lib/server/sync-version";
import { localProvider } from "./local";
import type { ContentBlock, ContentProvider, ContentSection, FaqCategory, MenuSet, PageContent, Post, SiteSettings } from "./types";

/**
 * Fournisseur WordPress Headless (REST API).
 *
 * Endpoints attendus (fournis par le plugin `wordpress/tatos-headless`) :
 *   GET /tatos/v1/settings          réglages du site (coordonnées, horaires)
 *   GET /tatos/v1/menus             menus "header" et "footer-legal"
 *   GET /tatos/v1/faq               FAQ groupée par catégorie
 *   GET /tatos/v1/pages/<slug>      page brute (HTML non filtré + `data` JSON + méta SEO)
 *   GET /wp/v2/posts?_embed         articles
 * Les réponses sont gardées en mémoire 5 min au plus, et oubliées dès qu'une modification est
 * signalée par le webhook `/api/webhooks/wordpress` (version « content » partagée entre toutes les
 * copies du site, voir sync-version.ts). En cas d'indisponibilité, on retombe sur les contenus
 * locaux afin de ne jamais casser le rendu.
 */

const API = (process.env.WORDPRESS_API_URL || "").replace(/\/$/, "");
export const WP_CACHE_TAG = "wordpress";

class NotFound extends Error {}

interface WpPost {
  slug: string;
  date_gmt: string;
  modified_gmt: string;
  title: { rendered: string };
  excerpt: { rendered: string };
  content: { rendered: string };
  meta?: { tatos_image?: string; tatos_image_alt?: string };
  _embedded?: { "wp:featuredmedia"?: { source_url?: string; alt_text?: string }[]; "wp:term"?: { taxonomy: string; name: string }[][] };
}

function mapPost(p: WpPost): Post {
  const media = p._embedded?.["wp:featuredmedia"]?.[0];
  const category = p._embedded?.["wp:term"]?.flat().find((t) => t.taxonomy === "category" && t.name !== "Non classé" && t.name !== "Uncategorized");
  return {
    slug: p.slug,
    title: decode(p.title.rendered),
    excerpt: decode(p.excerpt.rendered).replace(/\s*\[…\]\s*$/, "…").trim(),
    content: p.content.rendered,
    date: `${p.date_gmt}Z`,
    modified: `${p.modified_gmt}Z`,
    // Image à la une choisie dans WordPress, sinon image d'origine (article importé).
    image: media?.source_url || p.meta?.tatos_image || null,
    imageAlt: (media?.source_url ? media.alt_text : p.meta?.tatos_image_alt) || undefined,
    category: category?.name ?? null,
  };
}

function authHeader(): Record<string, string> {
  const user = process.env.WORDPRESS_APPLICATION_USER;
  const pass = process.env.WORDPRESS_APPLICATION_PASSWORD;
  return user && pass ? { Authorization: `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}` } : {};
}

const WP_TTL_MS = 5 * 60 * 1000;

/**
 * Lecture brute de l'API REST, sans aucun cache HTTP : l'adresse porte la version des contenus (et
 * change toutes les 5 min), si bien que LiteSpeed Cache ou le CDN de l'hébergeur de WordPress ne
 * peuvent jamais renvoyer une ancienne réponse après une modification.
 */
async function wpGet(endpoint: string): Promise<{ status: 404 } | { status: 200; data: unknown }> {
  const fresh = `_tatos=${currentVersion("content")}-${Math.floor(Date.now() / WP_TTL_MS)}`;
  const res = await fetch(`${API}${endpoint}${endpoint.includes("?") ? "&" : "?"}${fresh}`, {
    headers: { Accept: "application/json", "Cache-Control": "no-cache", Pragma: "no-cache", ...authHeader() },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) return { status: 404 };
  if (!res.ok) throw new Error(`WordPress ${endpoint} -> HTTP ${res.status}`);
  return { status: 200, data: await res.json() };
}

export async function wpFetch<T>(endpoint: string): Promise<T> {
  if (!API) throw new Error("WORDPRESS_API_URL non défini");
  await syncCaches();
  const r = await memo(`wp:${endpoint}`, WP_TTL_MS, () => wpGet(endpoint));
  if (r.status === 404) throw new NotFound(`WordPress ${endpoint} -> HTTP 404`);
  return r.data as T;
}

async function withFallback<T>(label: string, fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.error(`[cms:wordpress] ${label} indisponible, contenu local utilisé :`, (e as Error).message);
    return fallback();
  }
}

const NAMED: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  euro: "€",
};

/** Texte brut : balises retirées, entités HTML (nommées courantes et numériques) décodées. */
export const decode = (s: string) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === "#") return String.fromCodePoint(e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
      return NAMED[e.toLowerCase()] ?? m;
    })
    .trim();

/**
 * Découpe le HTML d'une page en sections à partir des titres <h2> : le titre devient le titre
 * de section et le reste est conservé tel quel dans un bloc HTML (mêmes balises et classes que
 * le contenu local, donc rendu identique).
 */
export function htmlToSections(html: string): ContentSection[] {
  const parts = html.split(/<h2[^>]*>/i).slice(1);
  return parts.map((part) => {
    const [titleHtml, rest = ""] = part.split(/<\/h2>/i);
    const body = rest.trim();
    const blocks: ContentBlock[] = body ? [{ type: "html", html: body }] : [];
    return { title: decode(titleHtml), blocks };
  });
}

interface WpPage {
  slug: string;
  title: string;
  content: string;
  metaTitle: string | null;
  metaDescription: string | null;
  data: unknown;
  modified: string;
}

export const wordpressProvider: ContentProvider = {
  name: "wordpress",
  getSiteSettings: () =>
    withFallback<SiteSettings>("settings", () => wpFetch<SiteSettings>("/tatos/v1/settings"), () => localProvider.getSiteSettings()),
  getMenus: () => withFallback<MenuSet>("menus", () => wpFetch<MenuSet>("/tatos/v1/menus"), () => localProvider.getMenus()),
  getFaq: () => withFallback<FaqCategory[]>("faq", () => wpFetch<FaqCategory[]>("/tatos/v1/faq"), () => localProvider.getFaq()),
  getPage: <T,>(slug: string) =>
    withFallback<PageContent<T> | null>(
      `page ${slug}`,
      async () => {
        let page: WpPage;
        try {
          page = await wpFetch<WpPage>(`/tatos/v1/pages/${encodeURIComponent(slug)}`);
        } catch (e) {
          // Page absente de WordPress : contenu local, sans bruit dans les logs.
          if (e instanceof NotFound) return localProvider.getPage<T>(slug);
          throw e;
        }
        const local = await localProvider.getPage<T>(slug);
        const sections = htmlToSections(page.content);
        return {
          slug: page.slug,
          title: page.title,
          metaTitle: page.metaTitle || local?.metaTitle,
          metaDescription: page.metaDescription || local?.metaDescription,
          sections: sections.length ? sections : local?.sections,
          data: (page.data as T | null) ?? local?.data,
          updatedAt: page.modified,
        };
      },
      () => localProvider.getPage<T>(slug),
    ),
  getPosts: () =>
    withFallback<Post[]>(
      "posts",
      async () => (await wpFetch<WpPost[]>("/wp/v2/posts?_embed&per_page=50&status=publish")).map(mapPost),
      () => localProvider.getPosts(),
    ),
  getPost: (slug: string) =>
    withFallback<Post | null>(
      `post ${slug}`,
      async () => {
        if (!/^[a-z0-9-]+$/.test(slug)) return null;
        const [p] = await wpFetch<WpPost[]>(`/wp/v2/posts?_embed&slug=${encodeURIComponent(slug)}`);
        return p ? mapPost(p) : null;
      },
      () => localProvider.getPost(slug),
    ),
};
