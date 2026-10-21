"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { transferLines, type BankDetails } from "@/lib/bank";
import { formatEuros } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Primitives";
import { IconCheck } from "@/components/ui/Icons";
import { lockScroll } from "@/components/ui/Drawer";
import { CopyButton } from "@/components/checkout/CopyButton";

type Pending = { id: string; number: string; amount: number };
type Data = { order: Pending; bank: BankDetails; contact?: { email: string; phone: string } };

/** Suivi du paiement : statut relu toutes les 15 s (et au retour sur l'onglet). */
const POLL_MS = 15_000;
/** Délai avant de demander au client de confirmer son virement. */
const CONFIRM_AFTER_MS = 30_000;
/** Pages où la fenêtre ne s'affiche pas : commande en cours de saisie, connexion et création du compte. */
const QUIET = ["/panier", "/paiement", "/connexion", "/inscription"];

/**
 * Fenêtre de paiement : dès la confirmation d'une commande par virement, elle présente au client les
 * informations de paiement (montant, communication, IBAN, BIC, copiables) et reste affichée — sur
 * toutes les pages, à chaque visite. Au bout de 30 s, elle lui demande de confirmer son virement :
 * « Confirmer » le note sur la commande, prévient le magasin, et le client passe à la suite. Si le
 * magasin marque le virement reçu entre-temps, la fenêtre l'annonce directement.
 */
export function TransferReminder() {
  const pathname = usePathname();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [state, setState] = useState<"pending" | "confirm" | "declared" | "paid" | "cancelled">("pending");
  const [sending, setSending] = useState(false);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  // Commande en attente de paiement pour cet acheteur (compte ou commande sans compte).
  useEffect(() => {
    if (quiet || data) return;
    let cancelled = false;
    const timer = window.setTimeout(
      async () => {
        try {
          const res = await fetch("/api/orders/transfer-reminder", { cache: "no-store" });
          if (!res.ok) return;
          const body = (await res.json()) as { orders: Pending[]; bank: BankDetails | null; contact?: Data["contact"] };
          const order = body.orders[0];
          if (!cancelled && order && body.bank) {
            setState("pending");
            setData({ order, bank: body.bank, contact: body.contact });
          }
        } catch {
          /* réseau indisponible : nouvel essai à la prochaine page */
        }
      },
      pathname === "/confirmation" ? 200 : 800,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quiet, pathname, data]);

  // 30 s après l'affichage des informations de paiement : demande de confirmation du virement.
  useEffect(() => {
    if (!data || state !== "pending") return;
    const t = window.setTimeout(() => setState("confirm"), CONFIRM_AFTER_MS);
    return () => window.clearTimeout(t);
  }, [data, state]);

  const declare = async () => {
    if (!data) return;
    setSending(true);
    try {
      await fetch("/api/orders/transfer-reminder", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId: data.order.id }) });
    } catch {
      /* le client peut continuer ; le magasin vérifie de toute façon la réception */
    }
    setSending(false);
    setState("declared");
  };

  // Suivi du paiement tant que la fenêtre est ouverte.
  const check = useCallback(async () => {
    if (!data || (state !== "pending" && state !== "confirm")) return;
    try {
      const res = await fetch(`/api/orders/transfer-reminder?order=${encodeURIComponent(data.order.id)}`, { cache: "no-store" });
      if (!res.ok) return;
      const { status, paid } = (await res.json()) as { status: string | null; paid: boolean };
      if (paid) setState("paid");
      else if (status === "ANNULEE") setState("cancelled");
    } catch {
      /* nouvel essai au prochain passage */
    }
  }, [data, state]);

  useEffect(() => {
    if (!data || (state !== "pending" && state !== "confirm")) return;
    const t = window.setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(t);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data, state, check]);

  useEffect(() => {
    if (!data) return;
    const unlock = lockScroll();
    const t = window.setTimeout(() => panel.current?.focus(), 60);
    return () => {
      window.clearTimeout(t);
      unlock();
    };
  }, [data]);

  if (!data || (quiet && (state === "pending" || state === "confirm"))) return null;
  const { order, bank, contact } = data;
  const { rows, note } = transferLines(formatEuros(order.amount), order.number, bank);
  // Informations de paiement (RIB), rappelées dans chaque fenêtre.
  const details = (
    <dl className="mt-5 flex flex-col gap-2 bg-mist p-4 text-left text-sm" data-testid="transfer-rib">
      {rows.map(([label, value, mono]) => (
        <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line pb-2 last:border-b-0 last:pb-0">
          <div className="min-w-0">
            <dt className="text-xs text-graphite">{label}</dt>
            <dd className={mono ? "t-spec !text-sm text-ink" : "font-medium"}>{value}</dd>
          </div>
          {(mono || label === "Montant") && (
            <CopyButton value={label === "IBAN" ? value.replace(/\s+/g, "") : label === "Montant" ? value.replace(/[^\d,.]/g, "") : value} label={label} />
          )}
        </div>
      ))}
    </dl>
  );
  const done = () => {
    setData(null);
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[340] flex items-end justify-center sm:items-center sm:p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/60 backdrop-blur-[2px]" />
      <div
        ref={panel}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="transfer-reminder"
        data-state={state}
        className="relative max-h-[94vh] w-full max-w-[480px] animate-[slide-up_0.6s_var(--ease-out-expo)_both] overflow-y-auto bg-paper p-6 shadow-2xl outline-none sm:p-8"
      >
        {state === "paid" ? (
          <div className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-paper">
              <IconCheck size={26} />
            </span>
            <h2 id={titleId} className="t-h3 mt-5">
              Paiement reçu, merci !
            </h2>
            <p className="mt-3 text-sm text-graphite">
              Votre commande {order.number} passe en préparation. Votre facture vous a été envoyée par email et nous vous appelons pour fixer la livraison.
            </p>
            <Button size="lg" block className="mt-7" onClick={done} data-testid="transfer-continue">
              Continuer
            </Button>
          </div>
        ) : state === "confirm" ? (
          <div className="text-center" data-testid="transfer-confirm">
            <p className="t-eyebrow text-promo">Confirmation du paiement</p>
            <h2 id={titleId} className="t-h3 mt-3">
              Avez-vous effectué le virement de {formatEuros(order.amount)} ?
            </h2>
            <p className="mt-3 text-sm text-graphite">
              Confirmez-le pour passer à la suite : nous vérifions la réception du virement et vous envoyons la facture dès qu&apos;il est reçu.
            </p>
            {details}
            <Button size="lg" block className="mt-7" onClick={declare} disabled={sending} plain={sending} data-testid="transfer-declare">
              {sending ? <Spinner /> : "Confirmer"}
            </Button>
            <button type="button" onClick={() => setState("pending")} className="mt-4 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline">
              Revoir les informations de paiement
            </button>
          </div>
        ) : state === "declared" ? (
          <div className="text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-ink text-paper">
              <IconCheck size={26} />
            </span>
            <h2 id={titleId} className="t-h3 mt-5">
              Merci, c&apos;est noté !
            </h2>
            <p className="mt-3 text-sm text-graphite">
              Nous vérifions la réception de votre virement pour la commande {order.number}. Dès qu&apos;il est reçu, vous recevez votre facture par email et nous vous appelons pour
              fixer la livraison.
            </p>
            {details}
            <Button size="lg" block className="mt-7" onClick={done} data-testid="transfer-continue">
              Continuer
            </Button>
          </div>
        ) : state === "cancelled" ? (
          <div className="text-center">
            <h2 id={titleId} className="t-h3">
              Commande {order.number} annulée
            </h2>
            <p className="mt-3 text-sm text-graphite">Aucun paiement n&apos;est attendu pour cette commande.</p>
            <Button size="lg" block className="mt-7" onClick={done}>
              Continuer
            </Button>
          </div>
        ) : (
          <>
            <p className="t-eyebrow text-promo">Paiement à effectuer</p>
            <h2 id={titleId} className="t-h3 mt-3">
              Réglez votre commande {order.number} par virement
            </h2>
            <p className="mt-2 text-sm text-graphite">
              Vos articles sont réservés. Faites le virement avec les informations ci-dessous : nous suivons votre paiement et vous accompagnons si besoin.
            </p>
            {details}
            <p className="mt-4 text-sm text-graphite">{note}</p>
            <div className="mt-5 flex items-center gap-3 border border-line p-4 text-sm" role="status" aria-live="polite">
              <Spinner />
              <span>
                En attente de la réception de votre virement. Cette fenêtre se met à jour toute seule dès que le paiement est reçu.
              </span>
            </div>
            {contact && (
              <p className="mt-4 text-center text-xs text-graphite">
                Une question sur le paiement ? {contact.phone} · {contact.email}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
