"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cancelOrder, invoiceLink } from "@/services/orders";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";

/** Ouvre ou télécharge la facture PDF (lien généré par l'API, propre à la commande du client). */
function InvoiceButton({ orderId, kind }: { orderId: string; kind: "download" | "view" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const click = async () => {
    setLoading(true);
    setError(null);
    const res = await invoiceLink(orderId, kind);
    setLoading(false);
    if (!res.ok) return setError(res.error);
    const url = kind === "download" ? res.data.downloadUrl : res.data.viewUrl;
    if (!url) return setError("Die Rechnung konnte nicht erstellt werden. Bitte versuchen Sie es erneut.");
    if (kind === "view") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `rechnung_${res.data.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  return (
    <span className="flex flex-col gap-1">
      <Button variant={kind === "download" ? "solid" : "outline"} size="sm" plain={loading} disabled={loading} onClick={click}>
        {loading ? <Spinner /> : kind === "download" ? "Rechnung herunterladen" : "Rechnung ansehen"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

/** Annulation confirmée d'une commande pas encore payée (articles remis en vente). */
function CancelOrder({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="flex flex-wrap items-center gap-3 text-sm">
      {confirm ? (
        <>
          <span>Diese Bestellung stornieren? Die Artikel werden wieder zum Verkauf freigegeben.</span>
          <button
            type="button"
            disabled={busy}
            className="font-medium text-danger underline underline-offset-4"
            onClick={async () => {
              setBusy(true);
              const res = await cancelOrder(orderId);
              setBusy(false);
              setConfirm(false);
              if (res.ok) router.refresh();
              else setError(res.error);
            }}
          >
            {busy ? <Spinner /> : "Ja, stornieren"}
          </button>
          <button type="button" className="underline underline-offset-4" onClick={() => setConfirm(false)}>
            Zurück
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setConfirm(true)} className="text-graphite underline-offset-4 hover:text-danger hover:underline">
          Bestellung stornieren
        </button>
      )}
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Actions d'une commande : factures (payée, ou en attente de virement : la facture porte alors les
 * coordonnées bancaires), reprise du paiement ou annulation confirmée (pas encore payée).
 */
export function OrderActions({ orderId, status, paid }: { orderId: string; status: string; paid: boolean }) {
  const active = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"].includes(status);
  const awaitingTransfer = status === "EN_ATTENTE_VIREMENT";

  // Paiement attendu : le devis a été envoyé par email ; la facture arrive une fois le paiement reçu.
  if (awaitingTransfer)
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        <p className="text-graphite">Die Rechnung wird Ihnen nach Zahlungseingang per E-Mail zugesandt.</p>
        <CancelOrder orderId={orderId} />
      </div>
    );
  if (active && paid)
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <InvoiceButton orderId={orderId} kind="view" />
        <InvoiceButton orderId={orderId} kind="download" />
      </div>
    );
  if (active) return <p className="text-sm text-graphite">Die Rechnung steht hier bereit, sobald die Bestellung bezahlt wurde.</p>;
  if (status !== "EN_ATTENTE_PAIEMENT") return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <ButtonLink href="/paiement" size="sm">
        Zahlung abschließen
      </ButtonLink>
      <CancelOrder orderId={orderId} />
    </div>
  );
}

export default OrderActions;
