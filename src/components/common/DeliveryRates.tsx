import { DELIVERY_RATES } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";

const COLUMNS = [
  { key: "piedDuCamion", label: "Pied du camion" },
  { key: "livraisonPiece", label: "Dans la pièce" },
  { key: "installation", label: "Avec installation" },
] as const;

/**
 * Grille des tarifs de livraison (mêmes valeurs que le calcul du panier et du serveur).
 * Au-delà de 60 km, seule la livraison au pied du camion est proposée.
 */
export function DeliveryRates({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] text-left text-sm">
          <caption className="sr-only">Tarifs de livraison selon la distance au magasin</caption>
          <thead>
            <tr className="border-b border-ink">
              <th scope="col" className="py-3 pr-4 font-medium">
                Distance
              </th>
              {COLUMNS.map((c) => (
                <th key={c.key} scope="col" className="py-3 pr-4 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="t-price">
            {Object.entries(DELIVERY_RATES).map(([range, o]) => {
              const long = range === "60-80";
              return (
                <tr key={range} className="border-b border-line">
                  <th scope="row" className="py-3 pr-4 font-normal">
                    {range.replace("-", " à ")} km
                  </th>
                  <td className="py-3 pr-4">{formatEuros(o.piedDuCamion.price)}</td>
                  <td className="py-3 pr-4 text-graphite">{long ? "—" : formatEuros(o.livraisonPiece.price)}</td>
                  <td className="py-3 pr-4 text-graphite">{long ? "—" : formatEuros(o.installation.price)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-graphite">
        Reprise de l&apos;ancien appareil : +{formatEuros(DELIVERY_RATES["0-20"].installation.additionalFee ?? 5)} avec l&apos;installation. Étage : +10 € dès le 3ᵉ, puis +10 € par étage au-delà pour une commande de
        20 kg et plus. Retrait en magasin gratuit.
      </p>
    </div>
  );
}
