"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { transferLines, type BankDetails } from "@/lib/bank";
import { formatEuros } from "@/lib/money";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { IconClose } from "@/components/ui/Icons";
import { lockScroll } from "@/components/ui/Drawer";
import { CopyButton } from "@/components/checkout/CopyButton";

type Pending = { id: string; number: string; amount: number };

/** Rappel déjà montré pendant cette visite. */
const SHOWN = "rappelVirementVu";
const DONE = "virementSignale";
const DELAY_MS = 1500;
/** Pas de rappel pendant la commande ni sur la page de confirmation (le virement y est déjà détaillé). */
const QUIET = ["/panier", "/paiement", "/confirmation", "/connexion", "/inscription"];

function read(storage: () => Storage, key: string) {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}
function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    /* stockage indisponible : rien à mémoriser */
  }
}

/**
 * Rappel du virement attendu : quand un client revient sur le site alors qu'une commande attend son
 * virement, une fenêtre lui rappelle le montant et les coordonnées bancaires (copiables). Montré une
 * fois par visite ; « J'ai déjà fait le virement » le masque pour cette commande. Vérifié à chaque
 * chargement de page tant qu'aucun rappel n'a été montré (réponse immédiate sans session ni commande).
 */
export function TransferReminder() {
  const pathname = usePathname();
  const [data, setData] = useState<{ order: Pending; bank: BankDetails } | null>(null);
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const quiet = QUIET.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (quiet || read(() => sessionStorage, SHOWN)) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch("/api/orders/transfer-reminder", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { orders: Pending[]; bank: BankDetails | null };
        const done = (read(() => localStorage, DONE) ?? "").split(",");
        const order = body.orders.find((o) => !done.includes(o.id));
        if (!cancelled && order && body.bank) {
          write(() => sessionStorage, SHOWN, "1");
          setData({ order, bank: body.bank });
        }
      } catch {
        /* réseau indisponible : pas de rappel */
      }
    }, DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [quiet]);

  useEffect(() => {
    if (!data) return;
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    const t = window.setTimeout(() => panel.current?.querySelector<HTMLElement>("button")?.focus(), 60);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setData(null);
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlock();
      previous?.focus?.();
    };
  }, [data]);

  if (!data) return null;
  const { order, bank } = data;
  const { rows } = transferLines(formatEuros(order.amount), order.number, bank);
  const alreadyPaid = () => {
    const done = (read(() => localStorage, DONE) ?? "").split(",").filter(Boolean);
    write(() => localStorage, DONE, [...done, order.id].slice(-10).join(","));
    setData(null);
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <button type="button" aria-label="Fermer le rappel" className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]" onClick={() => setData(null)} tabIndex={-1} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        data-testid="transfer-reminder"
        className="relative max-h-[92vh] w-full max-w-[460px] animate-[slide-up_0.6s_var(--ease-out-expo)_both] overflow-y-auto bg-paper p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          onClick={() => setData(null)}
          aria-label="Fermer"
          className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-graphite hover:bg-mist hover:text-ink"
        >
          <IconClose size={18} />
        </button>
        <p className="t-eyebrow text-promo">Virement attendu</p>
        <h2 id={titleId} className="t-h3 mt-3 pr-8">
          Votre commande {order.number} attend votre virement
        </h2>
        <p className="mt-2 text-sm text-graphite">Vos articles sont réservés. Faites le virement avec ces coordonnées : nous préparons la commande dès sa réception.</p>
        <dl className="mt-5 flex flex-col gap-2 bg-mist p-4 text-sm">
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
        <ButtonLink href={`/confirmation?status=success&order=${order.id}`} size="lg" block className="mt-6" icon={<Arrow />} onClick={() => setData(null)}>
          Voir la procédure de virement
        </ButtonLink>
        <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
          <button type="button" onClick={alreadyPaid} className="text-graphite underline-offset-4 hover:text-ink hover:underline">
            J&apos;ai déjà fait le virement
          </button>
          <button type="button" onClick={() => setData(null)} className="text-graphite underline-offset-4 hover:text-ink hover:underline">
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}
