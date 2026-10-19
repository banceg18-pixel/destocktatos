"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartProvider";
import { DELIVERY_OPTIONS, type DeliveryMethod } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";
import { Checkbox } from "@/components/ui/Primitives";
import { ChoiceCard } from "./ShippingAddressForm";

const METHODS: { m: DeliveryMethod; title: string; text: string }[] = [
  { m: "piedDuCamion", title: "Pied du camion", text: "Remise à l'entrée de l'immeuble ou de la maison" },
  { m: "livraisonPiece", title: "Livraison dans la pièce", text: "Monté et déposé dans la pièce de votre choix" },
  { m: "installation", title: "Installation", text: "Livraison, raccordement et mise en service" },
];

/** Prix affiché : « Offert » quand c'est gratuit (cas actuel, partout en France). */
const fee = (euros: number) => (euros > 0 ? formatEuros(euros) : "Offert");

/** Choix du mode de livraison (tous offerts, partout en France) et reprise de l'ancien appareil. */
export function DeliveryOptions() {
  const { deliveryMethod, setDeliveryMethod, deliveryDistance, includeOldItemPickup, setIncludeOldItemPickup, deliveryFee } = useCart();
  // Les options s'affichent une fois l'adresse vérifiée (géocodée).
  const options = deliveryDistance > 0 ? DELIVERY_OPTIONS : null;

  // Choix par défaut : l'installation, le service le plus complet.
  useEffect(() => {
    if (options && !deliveryMethod) setDeliveryMethod("installation");
  }, [options, deliveryMethod, setDeliveryMethod]);

  if (!options) return <p className="text-sm text-graphite">Les options de livraison s&apos;affichent dès que l&apos;adresse de livraison est complète.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3" role="radiogroup" aria-label="Options de livraison">
        {METHODS.map(({ m, title, text }) => (
          <ChoiceCard
            key={m}
            name="livraison"
            checked={deliveryMethod === m}
            onChange={() => setDeliveryMethod(m)}
            title={title}
            text={text}
            aside={fee(options[m].price)}
          />
        ))}
      </div>

      {deliveryMethod === "installation" && (
        <Checkbox
          id="oldItemPickup"
          checked={includeOldItemPickup}
          onChange={(e) => setIncludeOldItemPickup(e.target.checked)}
          label={
            <>
              Reprendre mon ancien appareil ({fee(options.installation.additionalFee ?? 0).toLowerCase()}) — collecté et recyclé le jour de l&apos;installation
            </>
          }
        />
      )}

      {deliveryMethod && (
        <dl className="t-price flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-graphite">{METHODS.find((x) => x.m === deliveryMethod)?.title}</dt>
            <dd>{fee(options[deliveryMethod].price)}</dd>
          </div>
          {deliveryMethod === "installation" && includeOldItemPickup && (
            <div className="flex justify-between">
              <dt className="text-graphite">Reprise de l&apos;ancien appareil</dt>
              <dd>{fee(options.installation.additionalFee ?? 0)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <dt>Total livraison</dt>
            <dd>{fee(deliveryFee)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default DeliveryOptions;
