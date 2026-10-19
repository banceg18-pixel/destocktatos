/**
 * Contrat entre le frontend et la source de contenus (fichiers locaux ou WordPress Headless).
 * Les composants ne connaissent que ces types : changer de fournisseur ne touche pas l'interface.
 */

export interface MenuItem {
  label: string;
  href: string;
  dataCy?: string;
}

export interface SiteSettings {
  siteName: string;
  description: string;
  email: string;
  phone: string;
  phoneIntl: string;
  addressLine: string;
  postalCode: string;
  city: string;
  country: string;
  hours: string;
  storeHours: string;
  mapQuery: string;
  /** Messages du bandeau fixe en haut de page (vides : pas de bandeau). */
  bannerMessage1?: string;
  bannerMessage2?: string;
}

export interface MenuSet {
  header: MenuItem[];
  footerLegal: MenuItem[];
}

/** Bloc de contenu riche (pages légales, à propos…). */
export type ContentBlock =
  | { type: "heading"; level: 2 | 3 | 4; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "html"; html: string };

export interface ContentSection {
  id?: string;
  title: string;
  blocks: ContentBlock[];
}

export interface PageContent<T = Record<string, unknown>> {
  slug: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  sections?: ContentSection[];
  /** Données structurées propres à la page (héros, cartes, chiffres…). */
  data?: T;
  updatedAt?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FaqCategory {
  title: string;
  icon?: string;
  items: FaqItem[];
}

export interface Post {
  slug: string;
  title: string;
  /** Résumé en texte brut. */
  excerpt: string;
  /** Contenu HTML (assaini avant affichage). */
  content: string;
  date: string;
  modified?: string;
  image?: string | null;
  imageAlt?: string;
  category?: string | null;
}

export interface ContentProvider {
  readonly name: "local" | "wordpress";
  getSiteSettings(): Promise<SiteSettings>;
  getMenus(): Promise<MenuSet>;
  getPage<T = Record<string, unknown>>(slug: string): Promise<PageContent<T> | null>;
  getFaq(): Promise<FaqCategory[]>;
  /** Le site source n'a pas de blog : renvoie une liste vide en local. */
  getPosts(): Promise<Post[]>;
  getPost(slug: string): Promise<Post | null>;
}
