import type { Metadata } from "next";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { TransferGuide } from "@/components/checkout/TransferGuide";
import { CopyButton } from "@/components/checkout/CopyButton";
import { AccountInvite } from "@/components/checkout/AccountInvite";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { IconAlert, IconCheck } from "@/components/ui/Icons";
import { getSession } from "@/lib/auth";
import { bankDetailsOf, transferLines } from "@/lib/bank";
import { getSiteSettings } from "@/lib/cms";
import { formatEuros } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { getBuyerOrder } from "@/lib/server/buyer";
import { toOrderDTO } from "@/lib/server/orders";
import { DELIVERY_LABELS } from "@/services/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bestellbestätigung — Destocktatos", robots: { index: false, follow: false } };

type SP = Promise<{ status?: string; order?: string; payment_id?: string }>;

/**
 * Page de retour après le règlement, avec ou sans compte (invité : sa commande seulement, par cookie
 * signé). L'état affiché vient de la base (jamais des seuls paramètres d'URL).
 */
export default async function ConfirmationPage({ searchParams }: { searchParams: SP }) {
  const { order: orderId } = await searchParams;
  const [session, settings] = await Promise.all([getSession(), getSiteSettings()]);
  let order: ReturnType<typeof toOrderDTO> | null = null;
  let customer: { email: string; passwordHash: string | null } | null = null;
  if (orderId && /^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
    try {
      const o = await getBuyerOrder(orderId);
      order = toOrderDTO(o);
      customer = await prisma.user.findUnique({ where: { id: o.userId }, select: { email: true, passwordHash: true } });
    } catch {
      order = null;
    }
  }
  const awaitingTransfer = order?.status === "EN_ATTENTE_VIREMENT";
  // Virement signalé par le client (ou paiement reçu) : simple page de remerciement, sans les informations de paiement.
  const declared = awaitingTransfer && !!order?.transferDeclaredAt;
  const toPay = awaitingTransfer && !declared;
  // Commande confirmée : payée, ou enregistrée en attente du virement (paiement avant livraison).
  const paid = !!order && (awaitingTransfer || ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"].includes(order.status));
  const count = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const delivery = order
    ? order.isPickupInStore
      ? `Wir benachrichtigen Sie, sobald Ihre Bestellung abholbereit ist: ${settings.addressLine}, ${settings.postalCode} ${settings.city}. ${settings.storeHours}.`
      : order.shippingAddress
        ? `Wir rufen Sie an, um den Liefertermin an folgende Adresse abzustimmen: ${order.shippingAddress.address}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}.`
        : "Wir rufen Sie an, um den genauen Liefertermin abzustimmen."
    : "";
  const bank = bankDetailsOf(settings);
  // Coordonnées du virement directement dans « Et maintenant ? » (copiables, comme dans la procédure).
  const transfer = order && toPay ? transferLines(formatEuros(order.totalAmount), order.number, bank) : null;
  const steps: { title: string; body: React.ReactNode }[] = order
    ? [
        ...(transfer
          ? [
              {
                title: "Banküberweisung",
                body: (
                  <dl className="mt-2 flex flex-col gap-2" data-testid="transfer-account">
                    {transfer.rows.map(([label, value, mono]) => (
                      <div key={label} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line pb-2 last:border-b-0">
                        <div className="min-w-0">
                          <dt className="text-xs text-graphite">{label}</dt>
                          <dd className={mono ? "t-spec !text-sm text-ink" : "font-medium text-ink"}>{value}</dd>
                        </div>
                        {mono && <CopyButton value={label === "IBAN" ? value.replace(/\s+/g, "") : value} label={label} />}
                      </div>
                    ))}
                  </dl>
                ),
              },
            ]
          : []),
        ...(declared ? [{ title: "Prüfung der Überweisung", body: "Wir prüfen den Zahlungseingang. Ihre Rechnung wird per E-Mail versandt, sobald der Betrag gebucht ist." }] : []),
        { title: "Vorbereitung", body: `${awaitingTransfer ? "Nach Eingang der Überweisung bereiten wir" : "Wir bereiten"} Ihre ${count} Artikel für die Auslieferung vor.` },
        { title: order.isPickupInStore ? "Selbstabholung in Filiale" : (DELIVERY_LABELS[order.deliveryMethod ?? ""] ?? "Lieferung"), body: delivery },
        { title: "Haben Sie Fragen?", body: `${settings.phone} · ${settings.email}` },
      ]
    : [];

  return (
    <div className="shell pb-24 pt-8 lg:pt-12">
      <div className="mb-14 flex justify-end">
        <CheckoutSteps current={paid ? 3 : 2} />
      </div>
      <div className="grid gap-14 lg:grid-cols-[1.2fr_1fr] lg:gap-20">
        <div>
          <span className={paid ? "flex size-14 items-center justify-center rounded-full bg-ink text-paper" : "flex size-14 items-center justify-center rounded-full bg-mist"}>
            {paid ? <IconCheck size={26} /> : <IconAlert size={26} />}
          </span>
          {paid && order ? (
            <>
              <h1 className="t-display mt-8">Vielen Dank für Ihre Bestellung!</h1>
              {order.paidAt ? (
                <p className="t-lead mt-6 max-w-xl text-graphite" data-testid="confirmation-done">
                  Die Bestellung <strong className="t-spec text-ink">{order.number}</strong> ist bezahlt ({formatEuros(order.totalAmount)}). Ihre Rechnung wurde per E-Mail versandt und wir rufen Sie zur Vereinbarung des Liefertermins an.
                </p>
              ) : declared ? (
                <p className="t-lead mt-6 max-w-xl text-graphite" data-testid="confirmation-done">
                  Die Bestellung <strong className="t-spec text-ink">{order.number}</strong> ist erfasst und Ihre Artikel sind reserviert. Vielen Dank für Ihre Überweisung von{" "}
                  {formatEuros(order.totalAmount)} : Wir prüfen den Eingang und senden Ihnen die Rechnung per E-Mail, sobald der Betrag gebucht ist.
                </p>
              ) : toPay ? (
                <>
                  <p className="t-lead mt-6 max-w-xl text-graphite">
                    Die Bestellung <strong className="t-spec text-ink">{order.number}</strong> ist erfasst und Ihre Artikel sind reserviert. Bitte überweisen Sie{" "}
                    {formatEuros(order.totalAmount)} per Banküberweisung : Die Zahlungsdaten finden Sie nachfolgend sowie in der Bestätigungs-E-Mail.
                  </p>
                  <TransferGuide amount={order.totalAmount} orderNumber={order.number} bank={bank} className="mt-8 max-w-xl" />
                </>
              ) : (
                <p className="t-lead mt-6 max-w-xl text-graphite">
                  Die Bestellung <strong className="t-spec text-ink">{order.number}</strong> ist eingegangen. Eine Übersicht finden Sie in Ihrem Kundenkonto.
                </p>
              )}
              <p className="mt-4 max-w-xl text-sm text-graphite" data-testid="spam-hint">
                E-Mail nicht gefunden? Bitte prüfen Sie Ihren Spam-Ordner und markieren Sie unsere E-Mail als « Kein Spam ».
              </p>
              {/* Commande passée sans être connecté : création du compte (ou connexion) pour retrouver ses factures. */}
              {!session?.user?.id && customer && <AccountInvite email={customer.email} hasPassword={!!customer.passwordHash} />}
            </>
          ) : (
            <>
              <h1 className="t-display mt-8">Zahlung wird geprüft</h1>
              <p className="t-lead mt-6 max-w-xl text-graphite">
                Wir warten noch auf die Bestätigung Ihrer Bank. Der Status wird in « Meine Bestellungen » automatisch aktualisiert.
              </p>
            </>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            {session?.user?.id && (
              <ButtonLink href="/compte/commandes" size="lg" variant={paid ? "outline" : "solid"} icon={<Arrow />}>
                Meine Bestellungen
              </ButtonLink>
            )}
          </div>
        </div>

        {paid && order && (
          <aside className="self-start bg-mist p-6 lg:p-8" aria-label="Wie geht es weiter?">
            <h2 className="t-h3">Wie geht es weiter?</h2>
            <ol className="mt-6 flex flex-col gap-5 text-sm">
              {steps.map(({ title, body }, i) => (
                <li key={title} className="flex gap-4">
                  <span className="t-spec mt-0.5 text-graphite">0{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="block font-medium">{title}</span>
                    {typeof body === "string" ? <span className="text-graphite">{body}</span> : body}
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
