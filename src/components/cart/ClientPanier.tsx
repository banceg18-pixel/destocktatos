"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useCart } from "@/context/CartProvider";
import { useError } from "@/context/PopUpProvider";
import { trackBeginCheckout } from "@/lib/client/analytics";
import { formatEuros } from "@/lib/money";
import { BIG_TICKET_OFFER } from "@/lib/offers";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Arrow, Checkbox, Spinner } from "@/components/ui/Primitives";
import { IconAlert, IconLock } from "@/components/ui/Icons";
import { CartItemRow } from "./CartItemRow";
import { CheckoutAccount } from "./CheckoutAccount";
import { CouponForm } from "./CouponForm";
import { DeliveryOptions } from "./DeliveryOptions";
import { ShippingAddressForm } from "./ShippingAddressForm";

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-ink pt-6" aria-labelledby={`etape-${n}`}>
      <h2 id={`etape-${n}`} className="mb-6 flex items-baseline gap-4">
        <span className="t-spec text-graphite">{String(n).padStart(2, "0")}</span>
        <span className="t-h3">{title}</span>
      </h2>
      {children}
    </section>
  );
}

/** Panier et préparation de la commande : articles, réception, options de livraison, récapitulatif. */
export function ClientPanier() {
  const {
    cart,
    clearCart,
    totalItems,
    totalPrice,
    deliveryFee,
    deliveryMethod,
    calculateTotalWithDelivery,
    isPickupInStore,
    shippingAddress,
    isShippingAddressValid,
    deliveryDistance,
    appliedCoupon,
    includeOldItemPickup,
  } = useCart();
  const { status } = useSession();
  const authenticated = status === "authenticated";
  const router = useRouter();
  const { setError } = useError();
  // Acceptation des conditions de vente : choix propre à cette commande (indépendant des cookies).
  const [accepted, setAccepted] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  // Coordonnées demandées au moment de payer, une fois tout le reste rempli : email seul (sans compte) ou connexion.
  const [accountOpen, setAccountOpen] = useState(false);

  const missing: string[] = [];
  if (!isPickupInStore) {
    if (!isShippingAddressValid() || !shippingAddress) missing.push("Complétez l'adresse de livraison.");
    else if (deliveryDistance <= 0) missing.push("La distance de livraison n'est pas encore calculée.");
    else if (!deliveryMethod) missing.push("Choisissez une option de livraison.");
  }
  if (!accepted) missing.push("Acceptez les conditions générales de vente.");
  const canCheckout = missing.length === 0;
  // Économie de l'offre -10 % au-delà de 1 000 € (déjà comprise dans le total des articles).
  const offerSavings = cart.reduce((s, i) => s + (i.promotionPrix || i.prix) * i.quantity, 0) - totalPrice;

  const checkout = () => {
    setAttempted(true);
    if (!canCheckout || processing || status === "loading") return;
    if (!cart.length || !totalPrice) return setError("Votre panier est vide.");
    if (!authenticated) return setAccountOpen(true);
    void placeOrder();
  };

  // Connexion faite dans le panneau, ou email saisi (sans compte) : la commande part aussitôt, sans rien ressaisir.
  const onAccountReady = () => {
    setAccountOpen(false);
    void placeOrder();
  };
  const onGuest = (email: string) => {
    setAccountOpen(false);
    void placeOrder(email);
  };

  const placeOrder = async (guestEmail?: string) => {
    setProcessing(true);
    const total = calculateTotalWithDelivery();
    trackBeginCheckout(cart, total, appliedCoupon?.code);
    const { createOrder } = await import("@/services/orders");
    const res = await createOrder({
      items: cart.map((i) => ({ _id: i._id, quantity: i.quantity })),
      totalAmount: total,
      deliveryFee,
      deliveryMethod,
      includeOldItemPickup: !isPickupInStore && deliveryMethod === "installation" && includeOldItemPickup,
      deliveryDistance,
      isPickupInStore,
      shippingAddress: isPickupInStore ? null : shippingAddress,
      appliedCoupon,
      ...(guestEmail ? { guest: { email: guestEmail } } : {}),
    });
    if (res.ok) {
      router.push("/paiement");
      return;
    }
    setProcessing(false);
    setError(res.status === 0 ? "Le serveur ne répond pas. Vérifiez votre connexion puis réessayez." : res.error || "La commande n'a pas pu être créée. Réessayez.");
  };

  if (totalItems === 0) {
    return (
      <div className="flex flex-col items-start gap-6 border-t border-ink py-20">
        <h2 className="t-h2">Votre panier est vide</h2>
        <p className="max-w-lg text-graphite">Ajoutez des appareils depuis le catalogue : ils restent mémorisés sur cet appareil jusqu&apos;à votre commande.</p>
        <ButtonLink href="/boutique" size="lg" icon={<Arrow />}>
          Découvrir la boutique
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-16">
      <div className="flex flex-col gap-14">
        <Section n={1} title={`Articles (${totalItems})`}>
          <ul className="divide-y divide-line">
            {cart.map((item) => (
              <CartItemRow key={item._id} item={item} />
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4 text-sm">
            <Link href="/boutique" className="link-underline inline-flex items-center gap-2">
              <Arrow direction="left" /> Continuer mes achats
            </Link>
            {confirmClear ? (
              <span className="flex items-center gap-4">
                Vider le panier ?
                <button type="button" className="font-medium text-danger underline underline-offset-4" onClick={clearCart}>
                  Oui, vider
                </button>
                <button type="button" className="underline underline-offset-4" onClick={() => setConfirmClear(false)}>
                  Annuler
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmClear(true)} className="text-graphite underline-offset-4 hover:text-ink hover:underline">
                Vider le panier
              </button>
            )}
          </div>
        </Section>

        <Section n={2} title="Réception">
          <ShippingAddressForm />
        </Section>

        {!isPickupInStore && (
          <Section n={3} title="Options de livraison">
            <DeliveryOptions />
          </Section>
        )}
      </div>

      <aside aria-label="Récapitulatif" className="lg:sticky lg:top-[calc(var(--header-h)+28px)] lg:self-start">
        <div className="bg-mist p-6 lg:p-8">
          <h2 className="t-h3">Récapitulatif</h2>
          <dl className="t-price mt-6 flex flex-col gap-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-graphite">
                Articles ({totalItems})
              </dt>
              <dd>{formatEuros(totalPrice)}</dd>
            </div>
            {offerSavings >= 0.01 && (
              <div className="flex justify-between font-semibold text-promo">
                <dt>Dont offre -{BIG_TICKET_OFFER.percent} % (plus de 1 000 €)</dt>
                <dd>−{formatEuros(offerSavings)}</dd>
              </div>
            )}
            {appliedCoupon && (
              <div className="flex justify-between text-success">
                <dt>Réduction {appliedCoupon.code}</dt>
                <dd>−{formatEuros(appliedCoupon.discount)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-graphite">{isPickupInStore ? "Retrait en magasin" : "Livraison"}</dt>
              <dd>{isPickupInStore || deliveryFee <= 0 ? "Offerte" : formatEuros(deliveryFee)}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-line pt-5">
            <CouponForm />
          </div>
          <div className="mt-5 flex items-baseline justify-between border-t border-ink pt-5">
            <span className="font-medium">Total TTC</span>
            <span className="t-price font-display text-2xl font-medium [font-stretch:110%]" data-testid="cart-total">
              {formatEuros(calculateTotalWithDelivery())}
            </span>
          </div>

          {!authenticated && status !== "loading" && (
            <p className="mt-6 border border-line bg-paper p-4 text-sm">
              Pas besoin de compte pour préparer votre commande : vous le créerez juste avant le paiement, en une minute. Déjà client ? Vous pourrez vous
              connecter à cette étape.
            </p>
          )}

          <Checkbox
            id="termsCheckbox"
            className="mt-6"
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            label={
              <>
                J&apos;accepte les{" "}
                <Link href="/cgv" target="_blank" className="underline underline-offset-4">
                  conditions générales de vente
                </Link>{" "}
                et la{" "}
                <Link href="/politique-confidentialite" target="_blank" className="underline underline-offset-4">
                  politique de confidentialité
                </Link>
                .
              </>
            }
          />

          {attempted && missing.length > 0 && (
            <ul className="mt-5 flex flex-col gap-2 text-sm" role="alert">
              {missing.map((m) => (
                <li key={m} className="flex gap-2 text-danger">
                  <IconAlert size={16} className="mt-0.5 shrink-0" /> {m}
                </li>
              ))}
            </ul>
          )}

          <Button
            size="lg"
            block
            className="mt-6"
            data-testid="checkout-button"
            onClick={checkout}
            disabled={processing}
            plain={processing}
            icon={processing ? undefined : <Arrow />}
          >
            {processing ? (
              <>
                <Spinner /> Création de la commande…
              </>
            ) : (
              "Passer au paiement"
            )}
          </Button>
          <p className="mt-4 flex items-center justify-center gap-2 text-xs text-graphite">
            <IconLock size={14} /> Paiement sécurisé à l&apos;étape suivante
          </p>
        </div>
      </aside>
      <CheckoutAccount open={accountOpen} onClose={() => setAccountOpen(false)} onDone={onAccountReady} onGuest={onGuest} />
    </div>
  );
}

export default ClientPanier;
