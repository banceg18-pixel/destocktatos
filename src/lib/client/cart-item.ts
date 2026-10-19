import type { Product } from "@/types/catalog";
import type { CartItem } from "@/types/cart";

/**
 * Article de panier à partir d'un produit. Le poids est conservé pour que les frais
 * d'étage affichés soient identiques à ceux recalculés par le backend.
 */
export function toCartItem(p: Product): Omit<CartItem, "quantity"> {
  return {
    _id: p._id,
    slug: p.slug,
    titre: p.titre,
    marque: p.marque,
    prix: p.prix,
    promotionPrix: p.promotionPrix ?? null,
    imagePrincipale: p.imagePrincipale || { url: "", idImage: "" },
    poids: p.caracteristiques?.poids ?? 0,
  };
}
