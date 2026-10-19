"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useCart } from "@/context/CartProvider";
import { LONG_DISTANCE_THRESHOLD, calculateFloorFees, calculateTotalWeight, getDeliveryOptions, type DeliveryMethod } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";
import { Checkbox } from "@/components/ui/Primitives";
import { ChoiceCard } from "./ShippingAddressForm";

const METHODS: { m: DeliveryMethod; title: string; text: string }[] = [
  { m: "piedDuCamion", title: "Pied du camion", text: "Remise à l'entrée de l'immeuble ou de la maison" },
  { m: "livraisonPiece", title: "Livraison dans la pièce", text: "Monté et déposé dans la pièce de votre choix" },
  { m: "installation", title: "Installation", text: "Livraison, raccordement et mise en service" },
];

/** Choix du mode de livraison selon la distance (grille tarifaire, reprise, frais d'étage). */
export function DeliveryOptions() {
  const { deliveryMethod, setDeliveryMethod, deliveryDistance, includeOldItemPickup, setIncludeOldItemPickup, deliveryFee, cart, shippingAddress } = useCart();
  const options = useMemo(() => (deliveryDistance > 0 ? getDeliveryOptions(deliveryDistance) : null), [deliveryDistance]);
  const weight = calculateTotalWeight(cart);
  const floor = shippingAddress?.floor || 0;
  const floorFees = calculateFloorFees(floor, weight);
  const longDistance = deliveryDistance > LONG_DISTANCE_THRESHOLD;

  const available = useCallback(
    (m: DeliveryMethod) => !!options && options[m]?.price > 0 && (!longDistance || m === "piedDuCamion"),
    [options, longDistance],
  );

  // Choix par défaut : installation si possible ; au-delà de 60 km, pied du camion uniquement.
  useEffect(() => {
    if (!options) return;
    if (deliveryMethod && available(deliveryMethod)) return;
    const next = (["installation", "livraisonPiece", "piedDuCamion"] as DeliveryMethod[]).find(available) ?? null;
    if (next !== deliveryMethod) setDeliveryMethod(next);
  }, [options, deliveryMethod, available, setDeliveryMethod]);

  if (!options) return <p className="text-sm text-graphite">Les options et leurs tarifs s&apos;affichent dès que l&apos;adresse de livraison est complète.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3" role="radiogroup" aria-label="Options de livraison">
        {METHODS.map(({ m, title, text }) => (
          <ChoiceCard
            key={m}
            name="livraison"
            checked={deliveryMethod === m}
            disabled={!available(m)}
            onChange={() => available(m) && setDeliveryMethod(m)}
            title={title}
            text={text}
            aside={available(m) ? formatEuros(options[m].price) : "Indisponible"}
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
              Reprendre mon ancien appareil (+{formatEuros(options.installation.additionalFee ?? 5)}) — collecté et recyclé le jour de l&apos;installation
            </>
          }
        />
      )}

      {deliveryMethod && (
        <dl className="t-price flex flex-col gap-1.5 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-graphite">{METHODS.find((x) => x.m === deliveryMethod)?.title}</dt>
            <dd>{formatEuros(options[deliveryMethod].price)}</dd>
          </div>
          {deliveryMethod === "installation" && includeOldItemPickup && (
            <div className="flex justify-between">
              <dt className="text-graphite">Reprise de l&apos;ancien appareil</dt>
              <dd>{formatEuros(options.installation.additionalFee ?? 5)}</dd>
            </div>
          )}
          {floorFees > 0 && (
            <div className="flex justify-between">
              <dt className="text-graphite">
                Frais d&apos;étage ({floor}ᵉ, {String(Math.round(weight * 10) / 10).replace(".", ",")} kg)
              </dt>
              <dd>{formatEuros(floorFees)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <dt>Total livraison</dt>
            <dd>{formatEuros(deliveryFee)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default DeliveryOptions;
