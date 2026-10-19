/**
 * Types du catalogue. Les noms de champs reprennent volontairement ceux de l'API du site
 * source (titre, marque, prix, promotionPrix…) : les composants restent identiques et le
 * mapping vers WordPress (custom fields) se fait dans `lib/cms`.
 */

export interface ImageRef {
  url: string;
  idImage?: string;
  _id?: string;
}

export interface Caracteristiques {
  profondeur?: number;
  largeur?: number;
  hauteur?: number;
  poids?: number;
}

export interface Garantie {
  duree: number;
  descriptif: string;
}

export interface ResumeAvis {
  nombreAvis: number;
  noteMoyenne: number;
}

export interface Product {
  _id: string;
  slug: string;
  titre: string;
  marque: string;
  modele: string;
  /** Prix en euros (le backend stocke des centimes). */
  prix: number;
  promotionPrix?: number | null;
  caracteristiques: Caracteristiques;
  description: string;
  imagePrincipale: ImageRef | null;
  images: ImageRef[];
  etiquetteEnergie?: ImageRef | null;
  stock: number;
  categorie: string;
  sousCategorie: string[];
  magasin: boolean;
  garantie?: Garantie | null;
  pose?: string | null;
  couleur: string[];
  connecter: boolean;
  vedette: boolean;
  sonore?: number | null;
  resumeAvis: ResumeAvis;
  createdAt: string;
  updatedAt: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
}

export interface Category {
  slug: string;
  nom: string;
  ordre: number;
  image: string | null;
  /** Le produit représentatif est-il « vedette » / en promotion (badges du carrousel). */
  vedette?: boolean;
  promotion?: boolean;
  imageAlt?: string;
  /** Nombre de produits disponibles (stock > 0). */
  count?: number;
  /** Prix d'entrée de gamme parmi les produits disponibles (euros, promotions comprises). */
  prixMin?: number | null;
}

export interface ProductListResult {
  produits: Product[];
  page: number;
  totalPages: number;
  total: number;
  sousCategories?: Record<string, string[]>;
}

export type SortKey = "recent" | "prix-asc" | "prix-desc" | "remise";

export interface ProductFilters {
  page?: number;
  limit?: number;
  categorie?: string;
  sousCategorie?: string;
  prixMin?: number;
  prixMax?: number;
  recherche?: string;
  promotions?: boolean;
  /** La boutique source ne liste que les produits disponibles. */
  inStockOnly?: boolean;
  /** Ordre d'affichage (par défaut : les plus récents d'abord). */
  tri?: SortKey;
}

export interface Review {
  _id: string;
  note: number;
  commentaire: string;
  auteur: string;
  createdAt: string;
  isOwner?: boolean;
}
