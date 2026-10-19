/** Contenu éditorial de l'accueil (CMS : data/content/pages/accueil.json ou WordPress). */
export interface HeroSlide {
  image: string;
  imageAlt: string;
  title: string;
  text: string;
  cta: string;
  href: string;
}

export type ServiceIcon = "truck" | "wrench" | "store" | "shield" | "recycle";

export interface HomeContent {
  hero: { slides: HeroSlide[] };
  categories: { title: string; intro: string };
  statement: { title: string; cta: string; href: string };
  services: { icon: ServiceIcon; title: string; text: string }[];
  promo: { cta: string };
  selection: { title: string; cta: string };
  why: { text: string; stats: { products: string; brands: string; radius: string } };
  band: { image: string; imageAlt: string; title: string; text: string; cta: string; href: string };
}
