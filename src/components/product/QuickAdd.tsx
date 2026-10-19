"use client";

import type { Product } from "@/types/catalog";
import { useCart } from "@/context/CartProvider";
import { useUi } from "@/context/UiProvider";
import { cn } from "@/lib/client/cn";
import { IconBag } from "@/components/ui/Icons";

/** Données de panier d'un produit (poids inclus pour les frais d'étage). */
export function toCartItem(p: Product) {
  return {
    _id: p._id,
    slug: p.slug,
    titre: p.titre,
    marque: p.marque,
    prix: p.prix,
    promotionPrix: p.promotionPrix,
    imagePrincipale: p.imagePrincipale ?? { url: "" },
    poids: p.caracteristiques?.poids,
  };
}

/** Ajout rapide depuis une carte produit : ouvre le mini-panier. */
export function QuickAdd({ product, className }: { product: Product; className?: string }) {
  const { addToCart } = useCart();
  const { notifyAdded } = useUi();
  const available = product.stock > 0;
  return (
    <button
      type="button"
      disabled={!available}
      onClick={() => {
        addToCart(toCartItem(product));
        notifyAdded(product._id);
      }}
      aria-label={available ? `Ajouter ${product.titre} au panier` : `${product.titre} : rupture de stock`}
      title={available ? "Ajouter au panier" : "Rupture de stock"}
      className={cn(
        "flex size-10 items-center justify-center rounded-full bg-paper text-ink shadow-[0_1px_0_rgba(0,0,0,0.04)] transition-[background-color,color,transform,opacity] duration-300 hover:bg-ink hover:text-paper disabled:opacity-40",
        className,
      )}
    >
      <IconBag size={17} />
    </button>
  );
}
