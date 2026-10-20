import { transferLines, type BankDetails } from "@/lib/bank";
import { formatEuros } from "@/lib/money";
import { cn } from "@/lib/client/cn";
import { CopyButton } from "./CopyButton";

/** Virement attendu : montant, communication, numéro de commande et coordonnées bancaires du magasin. */
export function TransferDetails({ amount, reference, bank, className }: { amount: number; reference: string; bank: BankDetails | null; className?: string }) {
  const { rows, note } = transferLines(formatEuros(amount), reference, bank);
  return (
    <div className={cn("border border-ink p-5 sm:p-6", className)} data-testid="transfer-details">
      <p className="font-medium">Virement bancaire à effectuer</p>
      <dl className="mt-4 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-[auto_1fr]">
        {rows.map(([label, value, mono]) => (
          <div key={label} className="contents">
            <dt className="text-graphite">{label}</dt>
            <dd className={cn("flex flex-wrap items-center justify-between gap-2 font-medium", mono && "t-spec !text-sm text-ink select-all")}>
              {value}
              {mono && <CopyButton value={label === "IBAN" ? value.replace(/\s+/g, "") : value} label={label} />}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 text-sm text-graphite">{note}</p>
    </div>
  );
}
