import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { markOrderPaid, recordPaymentFailure } from "@/lib/server/orders";
import { getStripe } from "@/lib/server/payments";

/**
 * POST /api/stripe/webhook — événements Stripe (signature vérifiée avec STRIPE_WEBHOOK_SECRET).
 * Assure la mise à jour des commandes même si le client ferme la page après le paiement.
 */
export async function POST(req: Request) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return NextResponse.json({ error: "Webhook Stripe non configuré" }, { status: 503 });
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch (e) {
    console.warn("[stripe] signature invalide:", (e as Error).message);
    return NextResponse.json({ error: "Signature invalide" }, { status: 400 });
  }
  const mode = process.env.STRIPE_SECRET_KEY?.startsWith("sk_live") ? "live" : "test";
  try {
    if (event.type === "payment_intent.succeeded") {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.orderId) await markOrderPaid(pi.metadata.orderId, { provider: "stripe", mode, providerRef: pi.id });
    } else if (event.type === "payment_intent.payment_failed") {
      const pi = event.data.object as Stripe.PaymentIntent;
      if (pi.metadata?.orderId)
        await recordPaymentFailure(pi.metadata.orderId, { provider: "stripe", mode, providerRef: pi.id, reason: pi.last_payment_error?.code ?? "failed" });
    }
  } catch (e) {
    console.error("[stripe] traitement du webhook impossible:", e);
    return NextResponse.json({ error: "Erreur de traitement" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
