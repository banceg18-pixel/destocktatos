"use client";

import Link from "next/link";
import { useCart } from "@/context/CartProvider";
import { useUi } from "@/context/UiProvider";
import { formatEuros } from "@/lib/money";
import { Drawer } from "@/components/ui/Drawer";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { ButtonLink } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Tag } from "@/components/ui/Primitives";

/** Mini-panier latéral : ouvert à chaque ajout, modification des quantités, accès à la commande. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();
  const { lastAddedId } = useUi();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={totalItems ? `Panier · ${totalItems} article${totalItems > 1 ? "s" : ""}` : "Panier"}
      closeLabel="Fermer le panier"
      footer={
        cart.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Sous-total</span>
              <span className="t-price text-lg font-medium">{formatEuros(totalPrice)}</span>
            </div>
            <p className="text-xs text-graphite">Livraison, installation et code promo se choisissent à l&apos;étape suivante.</p>
            <ButtonLink href="/panier" onClick={onClose} block size="lg">
              Voir le panier et commander
            </ButtonLink>
          </div>
        )
      }
    >
      {cart.length === 0 ? (
        <div className="flex h-full flex-col items-start justify-center gap-6 px-6 py-16">
          <p className="t-h3">Votre panier est vide.</p>
          <p className="text-graphite">Parcourez le catalogue : chaque appareil peut être livré, installé, ou retiré en magasin.</p>
          <ButtonLink href="/boutique" onClick={onClose} variant="outline">
            Découvrir la boutique
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line px-6">
          {cart.map((item) => {
            const unit = item.promotionPrix && item.promotionPrix < item.prix ? item.promotionPrix : item.prix;
            return (
              <li key={item._id} className="flex gap-4 py-5">
                <Link href={item.slug ? `/boutique/${item.slug}` : "/boutique"} onClick={onClose} className="size-24 shrink-0 bg-mist p-2">
                  <ImageComponent img={item.imagePrincipale?.url} alt={item.titre} size={96} className="size-full object-contain mix-blend-multiply" />
                </Link>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="t-spec text-graphite">{item.marque}</p>
                      <Link href={item.slug ? `/boutique/${item.slug}` : "/boutique"} onClick={onClose} className="line-clamp-2 text-sm font-medium hover:underline">
                        {item.titre}
                      </Link>
                    </div>
                    {item._id === lastAddedId && <Tag tone="ink">Ajouté</Tag>}
                  </div>
                  <p className="t-price text-sm">{formatEuros(unit)}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item._id, q)}
                      label={`Quantité de ${item.titre}`}
                    />
                    <button type="button" onClick={() => removeFromCart(item._id)} className="text-xs text-graphite underline-offset-4 hover:text-ink hover:underline">
                      Retirer
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Drawer>
  );
}
