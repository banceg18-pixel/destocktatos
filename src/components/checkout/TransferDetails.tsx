import type { BankDetails } from "@/lib/bank";
import { formatEuros } from "@/lib/money";
import { cn } from "@/lib/client/cn";

/** Virement attendu : montant, référence à indiquer et coordonnées bancaires du magasin. */
export function TransferDetails({ amount, reference, bank, className }: { amount: number; reference: string; bank: BankDetails | null; className?: string }) {
  const rows: [string, string, boolean?][] = [
    ["Montant", formatEuros(amount)],
    ["Référence à indiquer", reference, true],
    ...(bank ? ([["Titulaire", bank.holder], ...(bank.bank ? [["Banque", bank.bank]] : []), ["IBAN", bank.iban, true], ...(bank.bic ? [["BIC", bank.bic, true]] : [])] as [string, string, boolean?][]) : []),
  ];
  return (
    <div className={cn("border border-ink p-5 sm:p-6", className)} data-testid="transfer-details">
      <p className="font-medium">Virement bancaire à effectuer</p>
      <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="contents">
            <dt className="text-graphite">{label}</dt>
            <dd className={cn("font-medium break-all", mono && "t-spec !text-sm text-ink select-all")}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-graphite">
        {bank ? "Indiquez bien la référence dans le libellé du virement." : "Nos coordonnées bancaires vous sont envoyées par email."} Votre commande est préparée et livrée dès
        réception du virement.
      </p>
    </div>
  );
}
