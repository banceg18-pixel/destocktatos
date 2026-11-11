"use client";

import { useState } from "react";
import { GERMAN_BANKS, type GermanBank } from "@/lib/german-banks";
import { CopyButton } from "./CopyButton";
import { formatEuros } from "@/lib/money";

interface GermanBankSelectorProps {
  amount: number;
  orderNumber: string;
  selectedBank: GermanBank;
  onSelectBank: (bank: GermanBank) => void;
  onInitiateBridge: () => void;
  loading: boolean;
}

export function GermanBankSelector({
  amount,
  orderNumber,
  selectedBank,
  onSelectBank,
  onInitiateBridge,
  loading,
}: GermanBankSelectorProps) {
  const [mode, setMode] = useState<"instant" | "manual">("instant");
  const popularBanks = GERMAN_BANKS.filter((b) => b.popular);

  return (
    <div className="space-y-6">
      {/* Sélecteur de méthode : Virement direct (Bridge) ou Virement manuel */}
      <div className="grid grid-cols-2 gap-3" role="tablist">
        <button
          type="button"
          onClick={() => setMode("instant")}
          className={`px-4 py-3 text-left border text-sm transition-all rounded-sm ${
            mode === "instant"
              ? "border-ink bg-ink text-paper font-medium"
              : "border-line bg-paper text-graphite hover:border-ink"
          }`}
        >
          <p className="font-semibold text-inherit">⚡ Direktüberweisung (Bridge)</p>
          <p className="text-xs opacity-85 mt-0.5">Automatischer Transfer über Ihre deutsche Bank</p>
        </button>
        <button
          type="button"
          onClick={() => setMode("manual")}
          className={`px-4 py-3 text-left border text-sm transition-all rounded-sm ${
            mode === "manual"
              ? "border-ink bg-ink text-paper font-medium"
              : "border-line bg-paper text-graphite hover:border-ink"
          }`}
        >
          <p className="font-semibold text-inherit">🏦 Standard SEPA-Überweisung</p>
          <p className="text-xs opacity-85 mt-0.5">Manuell mit IBAN / BIC überweisen</p>
        </button>
      </div>

      {mode === "instant" ? (
        <div className="border border-line bg-mist p-5 sm:p-6 space-y-5 rounded-sm">
          <div>
            <h3 className="font-semibold text-sm text-ink mb-1">Wählen Sie Ihre Bank</h3>
            <p className="text-xs text-graphite">
              Sie werden sicher mit Ihrer gewählten Bank verbunden, um die Überweisung in Echtzeit freizugeben.
            </p>
          </div>

          {/* Grille des banques populaires */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {popularBanks.map((b) => {
              const active = b.id === selectedBank.id;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => onSelectBank(b)}
                  className={`flex flex-col items-center justify-center p-3 text-center border rounded transition-all ${
                    active
                      ? "border-ink bg-paper ring-2 ring-ink shadow-sm"
                      : "border-line/70 bg-paper/60 hover:bg-paper hover:border-ink/50"
                  }`}
                >
                  <span
                    className="size-7 rounded-md flex items-center justify-center text-xs font-bold text-white mb-1.5"
                    style={{ backgroundColor: b.color }}
                  >
                    {b.shortName.slice(0, 3)}
                  </span>
                  <span className="text-xs font-medium text-ink line-clamp-1">{b.shortName}</span>
                </button>
              );
            })}
          </div>

          {/* Sélecteur déroulant complet pour toutes les banques */}
          <div>
            <label htmlFor="all-german-banks" className="block text-xs font-medium text-graphite mb-1">
              Oder weitere deutsche Bank auswählen :
            </label>
            <select
              id="all-german-banks"
              value={selectedBank.id}
              onChange={(e) => {
                const found = GERMAN_BANKS.find((b) => b.id === e.target.value);
                if (found) onSelectBank(found);
              }}
              className="w-full bg-paper border border-line px-3.5 py-2.5 text-sm text-ink rounded focus:outline-none focus:ring-1 focus:ring-ink"
            >
              {GERMAN_BANKS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} (BIC: {b.bic})
                </option>
              ))}
            </select>
          </div>

          {/* Aperçu du virement pré-rempli */}
          <div className="bg-paper border border-line p-4 rounded text-xs space-y-2">
            <div className="flex justify-between items-center text-graphite pb-2 border-b border-line">
              <span>Ausgewählte Bank :</span>
              <span className="font-semibold text-ink">{selectedBank.name}</span>
            </div>
            <div className="flex justify-between items-center text-graphite pb-2 border-b border-line">
              <span>Empfänger :</span>
              <span className="font-medium text-ink">Bernard Alexis Chabaud</span>
            </div>
            <div className="flex justify-between items-center text-graphite pb-2 border-b border-line">
              <span>IBAN :</span>
              <span className="font-mono text-ink">DE53 3101 0833 9914 0820 74</span>
            </div>
            <div className="flex justify-between items-center text-graphite">
              <span>Verwendungszweck :</span>
              <span className="font-mono font-medium text-ink">{orderNumber}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={onInitiateBridge}
            disabled={loading}
            className="w-full py-3.5 px-5 bg-ink text-paper rounded font-medium text-sm flex items-center justify-center gap-2 hover:bg-ink/90 transition-colors shadow-sm disabled:opacity-50"
          >
            {loading ? (
              <span>Verbindung mit {selectedBank.shortName} wird hergestellt…</span>
            ) : (
              <>
                <span>Direktüberweisung über {selectedBank.shortName} auslösen</span>
                <span className="text-xs opacity-75">({formatEuros(amount)})</span>
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="border border-line bg-mist p-5 sm:p-6 space-y-4 rounded-sm text-sm">
          <p className="font-medium text-ink">Überweisen Sie eigenständig von Ihrem Bankkonto :</p>
          <div className="bg-paper border border-line p-4 rounded divide-y divide-line text-xs">
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">Empfänger (Inhaber) :</span>
              <div className="flex items-center gap-2">
                <span className="font-medium text-ink">Bernard Alexis Chabaud</span>
                <CopyButton value="Bernard Alexis Chabaud" label="Empfänger" />
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">IBAN :</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-ink">DE53 3101 0833 9914 0820 74</span>
                <CopyButton value="DE53310108339914082074" label="IBAN" />
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">BIC :</span>
              <div className="flex items-center gap-2">
                <span className="font-mono text-ink">SCFBDE33XXX</span>
                <CopyButton value="SCFBDE33XXX" label="BIC" />
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">Bank :</span>
              <span className="text-ink">Santander Consumer Bank</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">Verwendungszweck :</span>
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-ink">{orderNumber}</span>
                <CopyButton value={orderNumber} label="Verwendungszweck" />
              </div>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-graphite">Betrag :</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-ink">{formatEuros(amount)}</span>
                <CopyButton value={amount.toString()} label="Betrag" />
              </div>
            </div>
          </div>
          <p className="text-xs text-graphite">
            Nach Absenden Ihrer Bestellung erhalten Sie eine Bestätigungs-E-Mail und Ihre Artikel bleiben für Sie reserviert.
          </p>
        </div>
      )}
    </div>
  );
}

