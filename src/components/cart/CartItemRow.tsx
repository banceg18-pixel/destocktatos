"use client";

import Link from "next/link";
import { useCart, type CartItem } from "@/context/CartProvider";
import { formatEuros } from "@/lib/money";
import { displayTitle } from "@/lib/text";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Price } from "@/components/ui/Primitives";

/** Ligne d'article du panier : photo, référence, prix unitaire, quantité, total de ligne, retrait. */
export function CartItemRow({ item }: { item: CartItem }) {
  const { updateQuantity, removeFromCart } = useCart();
  const unit = item.promotionPrix && item.promotionPrix < item.prix ? item.promotionPrix : item.prix;
  const href = item.slug ? `/boutique/${item.slug}` : "/boutique";
  const title = displayTitle(item.titre, item.marque);
  return (
    <li className="grid grid-cols-[88px_1fr] gap-4 py-6 sm:grid-cols-[120px_1fr_auto] sm:gap-6">
      <Link href={href} className="aspect-square bg-mist p-2.5">
        <ImageComponent img={item.imagePrincipale?.url} alt={title} size={120} className="size-full object-contain mix-blend-multiply" />
      </Link>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="t-spec text-graphite">{item.marque}</p>
        <Link href={href} className="line-clamp-2 font-medium hover:underline">
          {title}
        </Link>
        <Price prix={item.prix} promotionPrix={item.promotionPrix} size="sm" className="mt-1" />
        <div className="mt-3 flex items-center gap-5">
          <QuantityStepper size="sm" value={item.quantity} max={10} onChange={(q) => updateQuantity(item._id, q)} label={`Quantité de ${title}`} />
          <button type="button" onClick={() => removeFromCart(item._id)} className="text-sm text-graphite underline-offset-4 hover:text-ink hover:underline">
            Retirer
          </button>
        </div>
      </div>
      <p className="t-price col-start-2 text-right font-medium sm:col-start-3 sm:pt-6">{formatEuros(unit * item.quantity)}</p>
    </li>
  );
}

export default CartItemRow;
