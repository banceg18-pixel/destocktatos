import { DELIVERY_OPTIONS } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";

const COLUMNS = [
  { key: "piedDuCamion", label: "Pied du camion" },
  { key: "livraisonPiece", label: "Dans la pièce" },
  { key: "installation", label: "Avec installation" },
] as const;

/** Tarifs de livraison par mode (mêmes valeurs que le calcul du panier et du serveur) : tous offerts. */
export function DeliveryRates({ className }: { className?: string }) {
  return (
    <div className={className}>
      <dl className="t-price grid grid-cols-1 border-t border-ink text-sm sm:grid-cols-3">
        {COLUMNS.map((c) => {
          const price = DELIVERY_OPTIONS[c.key].price;
          return (
            <div key={c.key} className="flex justify-between gap-4 border-b border-line py-3 sm:flex-col sm:justify-start sm:pr-4">
              <dt className="font-medium">{c.label}</dt>
              <dd className="text-graphite">{price > 0 ? formatEuros(price) : "Offert"}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-4 text-sm text-graphite">
        Partout en France, en mains propres par nos agents de proximité. Pas de frais d&apos;étage, reprise de l&apos;ancien appareil offerte avec
        l&apos;installation, retrait en magasin gratuit.
      </p>
    </div>
  );
}
