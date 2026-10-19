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
    if (!url) return setError("La facture n'a pas pu être générée. Réessayez.");
    if (kind === "view") {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      const a = document.createElement("a");
      a.href = url;
      a.download = `facture_${res.data.invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };
  return (
    <span className="flex flex-col gap-1">
      <Button variant={kind === "download" ? "solid" : "outline"} size="sm" plain={loading} disabled={loading} onClick={click}>
        {loading ? <Spinner /> : kind === "download" ? "Télécharger la facture" : "Voir la facture"}
      </Button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}

/**
 * Actions d'une commande : factures (réglée), reprise du paiement ou annulation confirmée (en
 * attente). Une commande à régler à la livraison a sa facture une fois le règlement reçu.
 */
export function OrderActions({ orderId, status, paid }: { orderId: string; status: string; paid: boolean }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"].includes(status);

  if (active && paid)
    return (
      <div className="flex flex-wrap items-start gap-2">
        <InvoiceButton orderId={orderId} kind="view" />
        <InvoiceButton orderId={orderId} kind="download" />
      </div>
    );
  if (active) return <p className="text-sm text-graphite">La facture sera disponible ici dès le règlement de la commande.</p>;
  if (status !== "EN_ATTENTE_PAIEMENT") return null;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {confirm ? (
        <>
          <span>Annuler cette commande ? Les articles seront remis en vente.</span>
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
            {busy ? <Spinner /> : "Oui, annuler"}
          </button>
          <button type="button" className="underline underline-offset-4" onClick={() => setConfirm(false)}>
            Retour
          </button>
        </>
      ) : (
        <>
          <ButtonLink href="/paiement" size="sm">
            Finaliser le paiement
          </ButtonLink>
          <button type="button" onClick={() => setConfirm(true)} className="text-graphite underline-offset-4 hover:text-danger hover:underline">
            Annuler la commande
          </button>
        </>
      )}
      {error && (
        <span role="alert" className="text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

export default OrderActions;
