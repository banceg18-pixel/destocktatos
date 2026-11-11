import { DELIVERY_OPTIONS } from "@/lib/delivery";
import { formatEuros } from "@/lib/money";

const COLUMNS = [
  { key: "piedDuCamion", label: "Bordsteinkante" },
  { key: "livraisonPiece", label: "Lieferung in den Raum" },
  { key: "installation", label: "Lieferung mit Montage" },
] as const;

/** Liefertarife nach Versandart: Kostenlos */
export function DeliveryRates({ className }: { className?: string }) {
  return (
    <div className={className}>
      <dl className="t-price grid grid-cols-1 border-t border-ink text-sm sm:grid-cols-3">
        {COLUMNS.map((c) => {
          const price = DELIVERY_OPTIONS[c.key].price;
          return (
            <div key={c.key} className="flex justify-between gap-4 border-b border-line py-3 sm:flex-col sm:justify-start sm:pr-4">
              <dt className="font-medium">{c.label}</dt>
              <dd className="text-graphite">{price > 0 ? formatEuros(price) : "Kostenlos"}</dd>
            </div>
          );
        })}
      </dl>
      <p className="mt-4 text-sm text-graphite">
        Lieferung in ganz Deutschland durch unsere Serviceteams. Keine Etagenzuschläge, kostenlose Altgeräterücknahme auf Wunsch inklusive.
      </p>
    </div>
  );
}
