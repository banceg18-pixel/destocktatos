import "server-only";
import Stripe from "stripe";
import type { Order } from "@prisma/client";

/**
 * Fournisseurs de paiement.
 * - Stripe : utilisé dès que STRIPE_SECRET_KEY est défini. Le statut est toujours vérifié côté
 *   serveur auprès de Stripe (jamais sur la seule parole du client).
 * - Virement bancaire avant livraison (« virement ») : proposé sans clé Stripe, ou en plus de Stripe
 *   avec BANK_TRANSFER=true. La commande est confirmée et ses articles réservés ; le client reçoit par
 *   email la facture avec les coordonnées bancaires, et le magasin la passe à « Payée » (virement reçu)
 *   avant de la préparer et de la livrer.
 * - Simulation (« test ») : réservée aux tests automatisés, activée seulement par TEST_PAYMENTS=true.
 */
export type PaymentStatus = "succeeded" | "processing" | "requires_action" | "failed" | "canceled";

export interface PaymentProvider {
  name: "stripe" | "virement";
  mode: "live" | "test";
  createIntent(order: Order, email?: string | null): Promise<{ clientSecret: string | null; providerRef: string }>;
  retrieve(providerRef: string): Promise<{ status: PaymentStatus; orderId: string | null; amountCents: number }>;
}

let stripeClient: Stripe | null = null;
export function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  stripeClient ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return stripeClient;
}

const stripeProvider = (stripe: Stripe): PaymentProvider => ({
  name: "stripe",
  mode: process.env.STRIPE_SECRET_KEY!.startsWith("sk_live") ? "live" : "test",
  async createIntent(order, email) {
    const intent = await stripe.paymentIntents.create(
      {
        amount: order.totalCents,
        currency: "eur",
        automatic_payment_methods: { enabled: true },
        receipt_email: email ?? undefined,
        description: `Commande ${order.number}`,
        metadata: { orderId: order.id, orderNumber: order.number },
      },
      // Idempotence : une seule intention par commande et par montant.
      { idempotencyKey: `order-${order.id}-${order.totalCents}` },
    );
    return { clientSecret: intent.client_secret, providerRef: intent.id };
  },
  async retrieve(ref) {
    const pi = await stripe.paymentIntents.retrieve(ref);
    const map: Record<string, PaymentStatus> = {
      succeeded: "succeeded",
      processing: "processing",
      requires_action: "requires_action",
      requires_payment_method: "failed",
      requires_confirmation: "processing",
      requires_capture: "processing",
      canceled: "canceled",
    };
    return { status: map[pi.status] ?? "processing", orderId: (pi.metadata?.orderId as string) ?? null, amountCents: pi.amount };
  },
});

/** Référence du virement bancaire d'une commande. */
export const transferRef = (orderId: string) => `virement_${orderId}`;

const bankTransferProvider: PaymentProvider = {
  name: "virement",
  mode: "live",
  async createIntent(order) {
    return { clientSecret: null, providerRef: transferRef(order.id) };
  },
  async retrieve(ref) {
    return { status: "processing", orderId: ref.replace(/^virement_/, ""), amountCents: 0 };
  },
};

export function getPaymentProvider(): PaymentProvider {
  const stripe = getStripe();
  return stripe ? stripeProvider(stripe) : bankTransferProvider;
}

/** Virement bancaire avant livraison : toujours proposé sans Stripe, en option avec Stripe. */
export function isBankTransferEnabled() {
  return !getStripe() || process.env.BANK_TRANSFER === "true";
}

/** Simulation de paiement : uniquement pour les tests automatisés (jamais visible des clients). */
export function isTestPaymentEnabled() {
  return !getStripe() && process.env.TEST_PAYMENTS === "true";
}
