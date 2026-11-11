import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyBridgeWebhookSignature } from "@/lib/server/bridge";
import { markOrderPaid } from "@/lib/server/orders";

export const runtime = "nodejs";

interface BridgeWebhookEvent {
  type: string;
  timestamp?: number;
  content?: {
    payment_transaction_id?: string;
    payment_request_id?: string;
    client_reference?: string;
    status?: string;
    status_reason?: string;
  };
}

/**
 * Webhook Bridge officiel (PISP) — signal autoritaire de confirmation de virement.
 * Vérifie l'en-tête "BridgeApi-Signature" (HMAC-SHA256).
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("BridgeApi-Signature") ?? request.headers.get("bridgeapi-signature");

  if (!verifyBridgeWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false, message: "Ungültige Signatur" }, { status: 401 });
  }

  let event: BridgeWebhookEvent;
  try {
    event = JSON.parse(raw) as BridgeWebhookEvent;
  } catch {
    return NextResponse.json({ ok: false, message: "Ungültiges JSON" }, { status: 400 });
  }

  const c = event.content ?? {};
  const orderId = c.client_reference;

  if (!orderId) {
    return NextResponse.json({ ok: true, handled: false });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    return NextResponse.json({ ok: true, handled: false });
  }

  try {
    // Si la transaction est acceptée (ACSC = AcceptedSettlementCompleted) ou créée
    if (event.type === "payment.transaction.updated" || event.type === "payment.transaction.created") {
      const isPaid = c.status === "ACSC" || c.status === "ACTC" || c.status === "succeeded";
      if (isPaid && order.status !== "PAYEE") {
        await markOrderPaid(order.id, {
          provider: "bridge",
          mode: "live",
          providerRef: c.payment_transaction_id || c.payment_request_id || `bridge_${order.id}`,
          details: { status: c.status, eventType: event.type },
        });
      }
    }
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (e) {
    console.error("[bridge-webhook] Fehler bei der Verarbeitung:", e);
    return NextResponse.json({ ok: true, handled: false });
  }
}

