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
import { offerUnitEuros } from "@/lib/offers";

/** Mini-panier latéral : ouvert à chaque ajout, modification des quantités, accès à la commande. */
export function CartDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { cart, totalItems, totalPrice, updateQuantity, removeFromCart } = useCart();
  const { lastAddedId } = useUi();

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={totalItems ? `Warenkorb · ${totalItems} Artikel` : "Warenkorb"}
      closeLabel="Warenkorb schließen"
      footer={
        cart.length > 0 && (
          <div className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm">Zwischensumme</span>
              <span className="t-price text-lg font-medium">{formatEuros(totalPrice)}</span>
            </div>
            <p className="text-xs text-graphite">Lieferung, Montage und Gutscheine werden im nächsten Schritt gewählt.</p>
            <ButtonLink href="/panier" onClick={onClose} block size="lg">
              Zum Warenkorb & Kasse
            </ButtonLink>
          </div>
        )
      }
    >
      {cart.length === 0 ? (
        <div className="flex h-full flex-col items-start justify-center gap-6 px-6 py-16">
          <p className="t-h3">Ihr Warenkorb ist leer.</p>
          <p className="text-graphite">Entdecken Sie unser Sortiment an modernen Haushaltsgeräten mit kostenlosem Versand.</p>
          <ButtonLink href="/boutique" onClick={onClose} variant="outline">
            Sortiment entdecken
          </ButtonLink>
        </div>
      ) : (
        <ul className="divide-y divide-line px-6">
          {cart.map((item) => {
            const unit = offerUnitEuros(item.promotionPrix && item.promotionPrix < item.prix ? item.promotionPrix : item.prix);
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
                    {item._id === lastAddedId && <Tag tone="ink">Hinzugefügt</Tag>}
                  </div>
                  <p className="t-price text-sm">{formatEuros(unit)}</p>
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <QuantityStepper
                      size="sm"
                      value={item.quantity}
                      onChange={(q) => updateQuantity(item._id, q)}
                      label={`Menge für ${item.titre}`}
                    />
                    <button type="button" onClick={() => removeFromCart(item._id)} className="text-xs text-graphite underline-offset-4 hover:text-ink hover:underline">
                      Entfernen
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
