import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { memo } from "@/lib/server/memo";
import type { ContentProvider, FaqCategory, MenuSet, PageContent, Post, SiteSettings } from "./types";

const CONTENT_DIR = path.join(process.cwd(), "data", "content");

// En production, les fichiers de contenu ne changent qu'au déploiement : lecture disque au plus toutes les 5 minutes.
const readJson = <T,>(file: string): Promise<T | null> =>
  process.env.NODE_ENV === "production" ? memo(`content:${file}`, 300_000, () => readJsonFile<T>(file)) : readJsonFile<T>(file);

async function readJsonFile<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(CONTENT_DIR, file), "utf8")) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}

/** Contenus éditoriaux stockés en JSON dans `data/content` (référence répliquée du site source). */
export const localProvider: ContentProvider = {
  name: "local",
  async getSiteSettings() {
    const s = await readJson<SiteSettings>("site.json");
    if (!s) throw new Error("data/content/site.json manquant");
    return s;
  },
  async getMenus() {
    return (await readJson<MenuSet>("menus.json")) ?? { header: [], footerLegal: [] };
  },
  async getPage<T>(slug: string) {
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    return readJson<PageContent<T>>(path.join("pages", `${slug}.json`));
  },
  async getFaq() {
    return (await readJson<FaqCategory[]>("faq.json")) ?? [];
  },
  async getPosts(): Promise<Post[]> {
    const posts = (await readJson<Post[]>("posts.json")) ?? [];
    return [...posts].sort((a, b) => b.date.localeCompare(a.date));
  },
  async getPost(slug: string) {
    if (!/^[a-z0-9-]+$/.test(slug)) return null;
    return (await localProvider.getPosts()).find((p) => p.slug === slug) ?? null;
  },
};
