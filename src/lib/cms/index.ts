import "server-only";
import { cache } from "react";
import { hasObsoleteIdentity, legalPage, normalizeAddress, rebrand } from "@/lib/brand";
import { localProvider } from "./local";
import { wordpressProvider } from "./wordpress";
import type { ContentProvider } from "./types";

/** Fournisseur de contenus actif (`CMS_PROVIDER=local|wordpress`). */
export function getContentProvider(): ContentProvider {
  return process.env.CMS_PROVIDER === "wordpress" ? wordpressProvider : localProvider;
}

// Mémoïsation par requête (plusieurs composants serveur lisent les mêmes réglages). Les contenus sont
// présentés au nom de Destocktatos (voir lib/brand.ts), quelle que soit leur origine.
export const getSiteSettings = cache(async () => normalizeAddress(rebrand(await getContentProvider().getSiteSettings())));
export const getMenus = cache(async () => rebrand(await getContentProvider().getMenus()));
export const getPage = cache(async <T,>(slug: string) => {
  const [stored, settings] = await Promise.all([getContentProvider().getPage<T>(slug), getSiteSettings()]);
  // Page légale réécrite par une ancienne version de l'extension : texte de référence du site.
  const page = hasObsoleteIdentity(stored) ? await localProvider.getPage<T>(slug) : stored;
  return legalPage(rebrand(page), settings);
});
export const getFaq = cache(async () => rebrand(await getContentProvider().getFaq()));
export const getPosts = cache(async () => rebrand(await getContentProvider().getPosts()));
export const getPost = cache(async (slug: string) => rebrand(await getContentProvider().getPost(slug)));

export type * from "./types";
