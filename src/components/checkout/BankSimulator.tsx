"use client";

import { useState } from "react";
import { formatEuros } from "@/lib/money";
import { GERMAN_BANKS, findGermanBank, type GermanBank } from "@/lib/german-banks";

export interface BankSimulatorProps {
  token: string;
  orderNumber: string;
  amount: number;
  initialBankId?: string;
  payerName: string;
}

export function BankSimulator({ token, orderNumber, amount, initialBankId, payerName }: BankSimulatorProps) {
  const [selectedBankId, setSelectedBankId] = useState(initialBankId || "sparkasse");
  const [stage, setStage] = useState<"idle" | "processing">("idle");
  const tanCode = "842 195";

  const bank: GermanBank = findGermanBank(selectedBankId);

  async function handleDecision(decision: "approve" | "decline") {
    setStage("processing");
    try {
      const res = await fetch("/api/bank-sim/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, decision, bankId: selectedBankId }),
      });
      const data = (await res.json()) as { ok?: boolean; callbackUrl?: string };
      if (data?.callbackUrl) {
        window.location.href = data.callbackUrl;
        return;
      }
    } catch (e) {
      console.error(e);
    }
    setStage("idle");
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        {/* En-tête bancaire */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
          <div className="px-6 py-4 flex items-center justify-between border-b border-slate-700/80" style={{ borderTop: `4px solid ${bank.color}` }}>
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-lg font-bold text-sm shadow-sm" style={{ backgroundColor: bank.color, color: "#fff" }}>
                {bank.shortName.slice(0, 3).toUpperCase()}
              </span>
              <div>
                <h1 className="text-base font-semibold text-white leading-tight">{bank.name}</h1>
                <p className="text-xs text-slate-400">Online-Banking · SEPA-Direktüberweisung (Bridge PISP)</p>
              </div>
            </div>
            <span className="text-[11px] font-mono font-medium px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Live-Test Sandbox
            </span>
          </div>

          {/* Corps de la validation de virement */}
          <div className="p-6 sm:p-8">
            {stage === "processing" ? (
              <div className="py-12 flex flex-col items-center text-center space-y-4">
                <div className="size-12 border-4 border-slate-600 border-t-emerald-400 rounded-full animate-spin" />
                <h2 className="text-lg font-medium text-white">Überweisung wird verarbeitet…</h2>
                <p className="text-sm text-slate-400 max-w-sm">
                  Freigabe über PhotoTAN / chipTAN wird an die Santander Consumer Bank übermittelt. Sie werden gleich weitergeleitet.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label htmlFor="bank-selector" className="block text-xs font-medium text-slate-400 mb-1.5 uppercase tracking-wider">
                    Ausgewählte deutsche Bank wechseln
                  </label>
                  <select
                    id="bank-selector"
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
                    className="w-full bg-slate-900/90 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {GERMAN_BANKS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} (BIC: {b.bic})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Récapitulatif du virement SEPA */}
                <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-5 space-y-3.5 text-sm">
                  <div className="flex justify-between items-baseline pb-3 border-b border-slate-800">
                    <span className="text-slate-400 text-xs">Überweisungsbetrag</span>
                    <span className="text-2xl font-bold text-emerald-400 font-mono">{formatEuros(amount)}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/70">
                    <span className="text-slate-400 text-xs">Empfänger (Inhaber)</span>
                    <span className="font-medium text-white text-right">Bernard Alexis Chabaud</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/70">
                    <span className="text-slate-400 text-xs">IBAN Empfänger</span>
                    <span className="font-mono text-xs font-semibold text-sky-300 text-right">DE53 3101 0833 9914 0820 74</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/70">
                    <span className="text-slate-400 text-xs">BIC / Bank</span>
                    <span className="text-right text-xs">
                      <span className="font-mono text-slate-300">SCFBDE33XXX</span> · Santander Consumer Bank AG
                    </span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-800/70">
                    <span className="text-slate-400 text-xs">Verwendungszweck (Bestellung)</span>
                    <span className="font-mono text-xs font-semibold text-emerald-300 text-right">{orderNumber}</span>
                  </div>

                  <div className="flex justify-between py-1">
                    <span className="text-slate-400 text-xs">Auftraggeber (Kunde)</span>
                    <span className="text-white text-right font-medium">{payerName || "Destocktatos Kunde"}</span>
                  </div>
                </div>

                {/* TAN / Freigabe-Feld */}
                <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-slate-300">App-Freigabe / TAN-Bestätigung</p>
                    <p className="text-[11px] text-slate-400">Automatisch generierter Einmalcode für den Testlauf</p>
                  </div>
                  <span className="font-mono text-sm tracking-widest font-bold px-3 py-1 bg-slate-900 border border-slate-700 rounded text-emerald-400">
                    {tanCode}
                  </span>
                </div>

                {/* Boutons d'action */}
                <div className="space-y-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleDecision("approve")}
                    className="w-full flex items-center justify-center gap-2 rounded-xl py-3.5 px-4 font-semibold text-sm transition-all shadow-lg hover:shadow-emerald-500/20"
                    style={{ backgroundColor: bank.color, color: "#fff" }}
                  >
                    <span>Überweisung jetzt freigeben ({formatEuros(amount)})</span>
                    <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDecision("decline")}
                    className="w-full py-2.5 text-center text-xs text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    Vorgang abbrechen und zurück zum Shop
                  </button>
                </div>

                <div className="pt-2 text-center">
                  <p className="text-[11px] text-slate-400">
                    Geschützte Banküberweisung gemäß PSD2 / Open Banking über Bridge API. Destocktatos erhält keinen Zugriff auf Ihre PIN oder Zugangsdaten.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
