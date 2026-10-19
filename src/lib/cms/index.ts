import "server-only";
import { cache } from "react";
import { localProvider } from "./local";
import { wordpressProvider } from "./wordpress";
import type { ContentProvider } from "./types";

/** Fournisseur de contenus actif (`CMS_PROVIDER=local|wordpress`). */
export function getContentProvider(): ContentProvider {
  return process.env.CMS_PROVIDER === "wordpress" ? wordpressProvider : localProvider;
}

// Mémoïsation par requête (plusieurs composants serveur lisent les mêmes réglages).
export const getSiteSettings = cache(() => getContentProvider().getSiteSettings());
export const getMenus = cache(() => getContentProvider().getMenus());
export const getPage = cache(<T,>(slug: string) => getContentProvider().getPage<T>(slug));
export const getFaq = cache(() => getContentProvider().getFaq());
export const getPosts = cache(() => getContentProvider().getPosts());
export const getPost = cache((slug: string) => getContentProvider().getPost(slug));

export type * from "./types";
