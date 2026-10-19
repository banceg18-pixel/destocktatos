import { apiFetch } from "./http";
import type { Product, ProductListResult } from "@/types/catalog";

export interface ReviewDTO {
  _id: string;
  note: number;
  commentaire: string;
  dateCreation: string;
  utilisateur: { _id: string; name: string; image?: string | null };
}

export function fetchProducts(params: URLSearchParams) {
  return apiFetch<ProductListResult>(`/api/produits?${params.toString()}`);
}

export function fetchLatestProducts(limit = 20) {
  return apiFetch<{ produits: Product[] }>(`/api/produits?limit=${limit}`);
}

export function fetchFeaturedProducts(limit: number) {
  return apiFetch<{ produits: Product[] }>(`/api/produits/vedettes?limit=${limit}`);
}

/** Renvoie directement un tableau (format de l'API source). */
export function fetchSuggestions(id: string, categorie: string, limit = 8) {
  return apiFetch<Product[]>(`/api/produits/suggestions?id=${id}&categorie=${encodeURIComponent(categorie)}&limit=${limit}`);
}

export function searchProducts(q: string, limit = 5) {
  return apiFetch<{ produits: Product[] }>(`/api/produits/search?q=${encodeURIComponent(q)}&limit=${limit}`);
}

export function fetchReviews(productId: string) {
  return apiFetch<ReviewDTO[]>(`/api/avis?produit=${encodeURIComponent(productId)}`);
}

export function canReview(productId: string) {
  return apiFetch<{ peutCommenter: boolean; raison?: string }>(`/api/avis/verifier?produit=${encodeURIComponent(productId)}`);
}

export function postReview(produit: string, note: number, commentaire: string) {
  return apiFetch<ReviewDTO>(`/api/avis`, { method: "POST", json: { produit, note, commentaire } });
}

export function updateReview(id: string, note: number, commentaire: string) {
  return apiFetch<ReviewDTO>(`/api/avis/${id}`, { method: "PUT", json: { note, commentaire } });
}

export function deleteReview(id: string) {
  return apiFetch<{ success: true }>(`/api/avis/${id}`, { method: "DELETE" });
}

export function fetchMe() {
  return apiFetch<{ _id: string; name: string; email: string; image?: string | null }>(`/api/users/me`);
}
