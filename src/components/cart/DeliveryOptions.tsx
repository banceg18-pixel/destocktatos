"use client";

import { useEffect } from "react";
import { useCart } from "@/context/CartProvider";
import { DELIVERY_OPTIONS, type DeliveryMethod } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";
import { Checkbox } from "@/components/ui/Primitives";
import { ChoiceCard } from "./ShippingAddressForm";

const METHODS: { m: DeliveryMethod; title: string; text: string }[] = [
  { m: "piedDuCamion", title: "Bordsteinkante", text: "Übergabe vor dem Gebäude bzw. vor der Haustür" },
  { m: "livraisonPiece", title: "Lieferung in den Raum", text: "Transport bis in den gewünschten Raum Ihrer Wahl" },
  { m: "installation", title: "Lieferung mit Installation", text: "Transport, Anschluss und betriebsbereite Inbetriebnahme" },
];

/** Prix affiché : « Kostenlos » quand c'est gratuit. */
const fee = (euros: number) => (euros > 0 ? formatEuros(euros) : "Kostenlos");

/** Choix du mode de livraison (tous offerts, partout en France) et reprise de l'ancien appareil. */
export function DeliveryOptions() {
  const { deliveryMethod, setDeliveryMethod, deliveryDistance, includeOldItemPickup, setIncludeOldItemPickup, deliveryFee } = useCart();
  // Les options s'affichent une fois l'adresse vérifiée (géocodée).
  const options = deliveryDistance > 0 ? DELIVERY_OPTIONS : null;

  // Choix par défaut : l'installation, le service le plus complet.
  useEffect(() => {
    if (options && !deliveryMethod) setDeliveryMethod("installation");
  }, [options, deliveryMethod, setDeliveryMethod]);

  if (!options) return <p className="text-sm text-graphite">Die Versandoptionen werden angezeigt, sobald die Lieferadresse vollständig ist.</p>;

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3" role="radiogroup" aria-label="Versandoptionen">
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
              Kostenlose Altgeräterücknahme ({fee(options.installation.additionalFee ?? 0).toLowerCase()}) — Abholung und Recycling am Tag der Montage
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
              <dt className="text-graphite">Altgeräterücknahme</dt>
              <dd>{fee(options.installation.additionalFee ?? 0)}</dd>
            </div>
          )}
          <div className="flex justify-between font-medium">
            <dt>Versand gesamt</dt>
            <dd>{fee(deliveryFee)}</dd>
          </div>
        </dl>
      )}
    </div>
  );
}

export default DeliveryOptions;
