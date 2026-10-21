import type { Metadata } from "next";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { TransferGuide } from "@/components/checkout/TransferGuide";
import { CopyButton } from "@/components/checkout/CopyButton";
import { AccountInvite } from "@/components/checkout/AccountInvite";
import { buttonClasses, ButtonLink } from "@/components/ui/Button";
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
export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false, follow: false } };

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
  // Commande confirmée : payée, ou enregistrée en attente du virement (paiement avant livraison).
  const paid = !!order && (awaitingTransfer || ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"].includes(order.status));
  const count = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;
  const delivery = order
    ? order.isPickupInStore
      ? `Nous vous prévenons dès que c'est prêt : ${settings.addressLine}, ${settings.postalCode} ${settings.city}. ${settings.storeHours}.`
      : order.shippingAddress
        ? `Nous vous appelons pour fixer le créneau de livraison au ${order.shippingAddress.address}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}.`
        : "Nous vous appelons pour fixer le créneau de livraison."
    : "";
  const bank = bankDetailsOf(settings);
  // Coordonnées du virement directement dans « Et maintenant ? » (copiables, comme dans la procédure).
  const transfer = order && awaitingTransfer ? transferLines(formatEuros(order.totalAmount), order.number, bank) : null;
  const steps: { title: string; body: React.ReactNode }[] = order
    ? [
        ...(transfer
          ? [
              {
                title: "Virement",
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
        { title: "Préparation", body: `${awaitingTransfer ? "Dès réception du virement, nous" : "Nous"} vérifions et préparons vos ${count} article${count > 1 ? "s" : ""}.` },
        { title: order.isPickupInStore ? "Retrait en magasin" : (DELIVERY_LABELS[order.deliveryMethod ?? ""] ?? "Livraison"), body: delivery },
        { title: "Une question ?", body: `${settings.phone} · ${settings.email}` },
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
              <h1 className="t-display mt-8">Merci pour votre commande !</h1>
              {!awaitingTransfer ? (
                <p className="t-lead mt-6 max-w-xl text-graphite">
                  La commande <strong className="t-spec text-ink">{order.number}</strong> est enregistrée{order.paidAt ? ` et payée (${formatEuros(order.totalAmount)})` : ""}. Un
                  récapitulatif est disponible dans votre compte{order.paidAt ? ", avec la facture" : ""}.
                </p>
              ) : (
                <>
                  <p className="t-lead mt-6 max-w-xl text-graphite">
                    La commande <strong className="t-spec text-ink">{order.number}</strong> est enregistrée et vos articles sont réservés. Pour la valider, réglez{" "}
                    {formatEuros(order.totalAmount)} par virement bancaire : la facture et nos coordonnées bancaires vous ont aussi été envoyées par email.
                  </p>
                  <TransferGuide amount={order.totalAmount} orderNumber={order.number} bank={bank} className="mt-8 max-w-xl" />
                </>
              )}
              {/* Commande passée sans être connecté : création du compte (ou connexion) pour retrouver ses factures. */}
              {!session?.user?.id && customer && <AccountInvite email={customer.email} hasPassword={!!customer.passwordHash} />}
            </>
          ) : (
            <>
              <h1 className="t-display mt-8">Paiement en cours de vérification</h1>
              <p className="t-lead mt-6 max-w-xl text-graphite">
                Nous n&apos;avons pas encore la confirmation de votre banque. Le statut se met à jour automatiquement dans « Mes commandes ».
              </p>
            </>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            {order?.paidAt && (
              // Lien direct vers le PDF (route API) : pas de navigation côté client.
              <a href={`/api/orders/${order._id}/invoice?download=1`} download className={buttonClasses({ size: "lg" })} data-testid="confirmation-invoice">
                Télécharger la facture
              </a>
            )}
            {session?.user?.id && (
              <ButtonLink href="/compte/commandes" size="lg" variant={paid ? "outline" : "solid"} icon={<Arrow />}>
                Mes commandes
              </ButtonLink>
            )}
          </div>
        </div>

        {paid && order && (
          <aside className="self-start bg-mist p-6 lg:p-8" aria-label="Et maintenant ?">
            <h2 className="t-h3">Et maintenant ?</h2>
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
