"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { Product } from "@/types/catalog";
import { useCart } from "@/context/CartProvider";
import { useUi } from "@/context/UiProvider";
import { trackAddToCart } from "@/lib/client/analytics";
import { toCartItem } from "@/lib/client/cart-item";
import { cn } from "@/lib/client/cn";
import { Button, ButtonLink } from "@/components/ui/Button";
import { QuantityStepper } from "@/components/ui/QuantityStepper";
import { Price } from "@/components/ui/Primitives";
import { IconBag } from "@/components/ui/Icons";

/**
 * Bloc d'achat : quantité (bornée au stock), ajout au panier (ouvre le mini-panier) et achat
 * immédiat. Sur mobile, une barre d'achat reste accessible en bas d'écran une fois le bouton
 * principal sorti de l'écran.
 */
export function PurchasePanel({ product }: { product: Product }) {
  const router = useRouter();
  const { addToCart } = useCart();
  const { notifyAdded } = useUi();
  const [quantity, setQuantity] = useState(1);
  const [stickyVisible, setStickyVisible] = useState(false);
  const anchor = useRef<HTMLDivElement>(null);
  const max = Math.max(1, Math.min(product.stock, 10));

  useEffect(() => {
    const el = anchor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStickyVisible(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const add = (qty: number) => {
    const item = toCartItem(product);
    for (let i = 0; i < qty; i++) addToCart(item);
    trackAddToCart(item, qty);
  };

  if (product.stock <= 0) {
    return (
      <div className="flex flex-col gap-4 border border-line p-5">
        <p className="font-medium">Ce modèle est épuisé pour le moment.</p>
        <p className="text-sm text-graphite">Un conseiller peut vous proposer un équivalent disponible ou vous prévenir de son retour.</p>
        <ButtonLink href="/contact" variant="outline">
          Demander conseil
        </ButtonLink>
      </div>
    );
  }

  return (
    <>
      <div ref={anchor} className="flex flex-col gap-3">
        <div className="flex gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} max={max} label="Quantité" />
          <Button
            size="lg"
            className="min-w-0 flex-1 px-4 !text-[0.72rem] sm:px-8 sm:!text-[0.8rem]"
            icon={<IconBag size={17} className="hidden sm:block" />}
            onClick={() => {
              add(quantity);
              notifyAdded(product._id);
            }}
          >
            Ajouter au panier
          </Button>
        </div>
        <Button
          size="lg"
          variant="outline"
          block
          onClick={() => {
            add(quantity);
            router.push("/panier");
          }}
        >
          Commander maintenant
        </Button>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-0 z-[150] border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-xl transition-transform duration-500 ease-[var(--ease-out-expo)] lg:hidden",
          stickyVisible ? "translate-y-0" : "translate-y-full",
        )}
        aria-hidden={!stickyVisible}
      >
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{product.titre}</p>
            <Price prix={product.prix} promotionPrix={product.promotionPrix} size="sm" />
          </div>
          <Button
            tabIndex={stickyVisible ? 0 : -1}
            onClick={() => {
              add(1);
              notifyAdded(product._id);
            }}
            icon={<IconBag size={16} />}
          >
            Ajouter
          </Button>
        </div>
      </div>
    </>
  );
}
