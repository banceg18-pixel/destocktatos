import type { ReactNode } from "react";
import type { BankDetails } from "@/lib/bank";
import { formatEuros } from "@/lib/money";
import { cn } from "@/lib/client/cn";
import { CopyButton } from "./CopyButton";

/** Ligne « libellé : valeur » avec bouton de copie. */
function Value({ label, value, copy, mono = true }: { label: string; value: string; copy?: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <div className="min-w-0">
        <p className="text-xs text-graphite">{label}</p>
        <p className={cn("font-medium text-ink [overflow-wrap:anywhere]", mono && "t-spec !text-sm [overflow-wrap:normal]")}>{value}</p>
      </div>
      {copy !== undefined && <CopyButton value={copy} label={label} />}
    </div>
  );
}

function Step({ n, title, children, last }: { n: number; title: string; children: ReactNode; last?: boolean }) {
  return (
    <li className="relative flex gap-4 pb-7 last:pb-0">
      {!last && <span aria-hidden="true" className="absolute left-[15px] top-9 h-[calc(100%-2.25rem)] w-px bg-line" />}
      <span className="t-spec relative flex size-8 shrink-0 items-center justify-center rounded-full bg-ink !text-xs text-paper">{n}</span>
      <div className="min-w-0 flex-1 pt-1">
        <p className="font-medium">{title}</p>
        <div className="mt-2 text-sm text-graphite">{children}</div>
      </div>
    </li>
  );
}

/**
 * Procédure de virement pas à pas en allemand, avec les valeurs à copier dans l'application bancaire :
 * bénéficiaire (titulaire Bernard Alexis Chabaud, IBAN DE53..., BIC SCFBDE33XXX), montant exact et numéro de commande.
 */
export function TransferGuide({ amount, orderNumber, bank, className }: { amount: number; orderNumber: string; bank: BankDetails; className?: string }) {
  const amountText = formatEuros(amount);
  return (
    <section className={cn("border border-ink p-5 sm:p-7", className)} aria-labelledby="procedure-virement" data-testid="transfer-guide">
      <h2 id="procedure-virement" className="t-h3">
        Banküberweisung in 5 einfachen Schritten
      </h2>
      <p className="mt-2 text-sm text-graphite">Kopieren Sie die Daten und fügen Sie sie in Ihre Banking-App ein.</p>
      <ol className="mt-7">
        <Step n={1} title="Banking-App oder Online-Banking öffnen">
          Öffnen Sie Ihre Banking-App (Sparkasse, Deutsche Bank, Commerzbank, ING, etc.) und wählen Sie „Überweisung“ oder „Neuer Empfänger“.
        </Step>
        <Step n={2} title="Empfängerdaten eingeben">
          <div className="mt-1 bg-mist p-4">
            <Value label="Zahlungsempfänger (Inhaber)" value={bank.holder} copy={bank.holder} mono={false} />
            <Value label="IBAN" value={bank.iban} copy={bank.iban.replace(/\s+/g, "")} />
            {bank.bic && <Value label="BIC" value={bank.bic} copy={bank.bic} />}
            {bank.bank && <Value label="Kreditinstitut" value={bank.bank} mono={false} />}
            <Value label="Abteilung" value={bank.service} mono={false} />
          </div>
        </Step>
        <Step n={3} title="Genauen Betrag eingeben">
          <div className="mt-1 bg-mist p-4">
            <Value label="Betrag" value={amountText} copy={amountText.replace(/[^\d,.]/g, "")} />
          </div>
        </Step>
        <Step n={4} title="Verwendungszweck angeben">
          <div className="mt-1 bg-mist p-4">
            {bank.reference && <Value label="Referenz" value={bank.reference} copy={bank.reference} />}
            <Value label="Verwendungszweck (Bestellnummer)" value={orderNumber} copy={orderNumber} />
          </div>
        </Step>
        <Step n={5} title="Überweisung freigeben" last>
          Ihre Artikel sind reserviert. Sobald die Überweisung gutgeschrieben ist, bearbeiten wir Ihre Bestellung und vereinbaren den Liefertermin mit Ihnen.
        </Step>
      </ol>
    </section>
  );
}
