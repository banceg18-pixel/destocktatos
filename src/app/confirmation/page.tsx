import type { Metadata } from "next";
import { CheckoutSteps } from "@/components/cart/CheckoutSteps";
import { ButtonLink } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { IconAlert, IconCheck } from "@/components/ui/Icons";
import { getSession } from "@/lib/auth";
import { getSiteSettings } from "@/lib/cms";
import { formatEuros } from "@/lib/money";
import { getUserOrder, toOrderDTO } from "@/lib/server/orders";
import { DELIVERY_LABELS } from "@/services/orders";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Confirmation de commande", robots: { index: false, follow: false } };

type SP = Promise<{ status?: string; order?: string; payment_id?: string }>;

/** Page de retour après paiement : l'état affiché vient de la base (jamais des seuls paramètres d'URL). */
export default async function ConfirmationPage({ searchParams }: { searchParams: SP }) {
  const { order: orderId } = await searchParams;
  const [session, settings] = await Promise.all([getSession(), getSiteSettings()]);
  let order: ReturnType<typeof toOrderDTO> | null = null;
  if (session?.user?.id && orderId && /^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
    try {
      order = toOrderDTO(await getUserOrder(session.user.id, orderId));
    } catch {
      order = null;
    }
  }
  const paid = !!order && ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"].includes(order.status);
  const count = order?.items.reduce((s, i) => s + i.quantity, 0) ?? 0;

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
              {order.paidAt ? (
                <p className="t-lead mt-6 max-w-xl text-graphite">
                  La commande <strong className="t-spec text-ink">{order.number}</strong> est enregistrée et payée ({formatEuros(order.totalAmount)}). Un récapitulatif est disponible
                  dans votre compte, avec la facture.
                </p>
              ) : (
                <p className="t-lead mt-6 max-w-xl text-graphite">
                  La commande <strong className="t-spec text-ink">{order.number}</strong> est confirmée. Vous réglerez {formatEuros(order.totalAmount)}{" "}
                  {order.isPickupInStore ? "au retrait en magasin" : "à la livraison"}. Le récapitulatif vous a été envoyé par email et reste disponible dans votre compte.
                </p>
              )}
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
            <ButtonLink href="/compte/commandes" size="lg" icon={<Arrow />}>
              Mes commandes
            </ButtonLink>
            <ButtonLink href="/boutique" size="lg" variant="outline">
              Continuer mes achats
            </ButtonLink>
          </div>
        </div>

        {paid && order && (
          <aside className="self-start bg-mist p-6 lg:p-8" aria-label="Et maintenant ?">
            <h2 className="t-h3">Et maintenant ?</h2>
            <ol className="mt-6 flex flex-col gap-5 text-sm">
              <li className="flex gap-4">
                <span className="t-spec mt-0.5 text-graphite">01</span>
                <span>
                  <span className="block font-medium">Préparation</span>
                  <span className="text-graphite">Nous vérifions et préparons vos {count} article{count > 1 ? "s" : ""}.</span>
                </span>
              </li>
              <li className="flex gap-4">
                <span className="t-spec mt-0.5 text-graphite">02</span>
                <span>
                  <span className="block font-medium">{order.isPickupInStore ? "Retrait en magasin" : DELIVERY_LABELS[order.deliveryMethod ?? ""] ?? "Livraison"}</span>
                  <span className="text-graphite">
                    {order.isPickupInStore
                      ? `Nous vous prévenons dès que c'est prêt : ${settings.addressLine}, ${settings.postalCode} ${settings.city}. ${settings.storeHours}.`
                      : order.shippingAddress
                        ? `Nous vous appelons pour fixer le créneau de livraison au ${order.shippingAddress.address}, ${order.shippingAddress.postalCode} ${order.shippingAddress.city}.`
                        : "Nous vous appelons pour fixer le créneau de livraison."}
                  </span>
                </span>
              </li>
              <li className="flex gap-4">
                <span className="t-spec mt-0.5 text-graphite">03</span>
                <span>
                  <span className="block font-medium">Une question ?</span>
                  <span className="text-graphite">
                    {settings.phone} · {settings.email}
                  </span>
                </span>
              </li>
            </ol>
          </aside>
        )}
      </div>
    </div>
  );
}
