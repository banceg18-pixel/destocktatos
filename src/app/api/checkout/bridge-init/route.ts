import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, route } from "@/lib/server/api";
import { getBuyerOrder, requireBuyer } from "@/lib/server/buyer";
import { billingSchema } from "@/lib/server/order-schemas";
import { objectId } from "@/lib/validation";
import { createBridgePaymentRequest } from "@/lib/server/bridge";
import { sendMetaEvent } from "@/lib/server/meta-capi";

const schema = z.object({
  orderId: objectId,
  bankId: z.string().optional(),
  billingAddress: billingSchema,
});

function originOf(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/**
 * POST /api/checkout/bridge-init — initialise un virement immédiat via Bridge sur une banque allemande.
 * Retourne l'URL de redirection (soit le guichet de la banque cliente via Bridge, soit le simulateur de banque allemande).
 */
export const POST = route("POST /api/checkout/bridge-init", async (req: Request) => {
  await requireBuyer();
  const { orderId, bankId, billingAddress } = await parseBody(req, schema);
  const order = await getBuyerOrder(orderId);

  if (order.status === "ANNULEE") {
    throw new ApiError(409, "Die Reservierung ist abgelaufen. Bitte kehren Sie zum Warenkorb zurück.");
  }
  if (order.status !== "EN_ATTENTE_PAIEMENT" && order.status !== "EN_ATTENTE_VIREMENT") {
    throw new ApiError(409, "Diese Bestellung wurde bereits bestätigt oder bezahlt.");
  }

  // Met à jour l'adresse de facturation
  await prisma.order.update({
    where: { id: order.id },
    data: { billingAddress },
  });

  const origin = originOf(req);
  const [firstName, ...rest] = (billingAddress.name || "Kunde").split(" ");

  try {
    const bridgeReq = await createBridgePaymentRequest({
      orderId: order.id,
      orderNumber: order.number,
      amount: order.totalCents / 100,
      bankId: bankId || "sparkasse",
      user: {
        firstName: firstName || "Kunde",
        lastName: rest.join(" ") || "Destocktatos",
        email: billingAddress.email,
      },
      callbackUrl: `${origin}/confirmation?order=${encodeURIComponent(order.id)}&status=bridge`,
      appOrigin: origin,
    });

    // Enregistre l'intention de paiement Bridge
    await prisma.payment.upsert({
      where: { id: `${order.id}-${bridgeReq.id}`.slice(0, 190) },
      update: { status: "EN_ATTENTE", amountCents: order.totalCents },
      create: {
        id: `${order.id}-${bridgeReq.id}`.slice(0, 190),
        orderId: order.id,
        provider: "bridge",
        mode: bridgeReq.mode === "live" ? "live" : "test",
        providerRef: bridgeReq.id,
        amountCents: order.totalCents,
        status: "EN_ATTENTE",
      },
    });

    void sendMetaEvent("InitiateCheckout", {
      eventId: order.number,
      email: billingAddress.email,
      phone: billingAddress.phone,
      value: order.totalCents / 100,
      url: req.headers.get("referer") ?? undefined,
    });

    return json({
      ok: true,
      redirectUrl: bridgeReq.url,
      mode: bridgeReq.mode,
      orderId: order.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Virement impossible à initialiser";
    throw new ApiError(502, `Die Banküberweisung konnte nicht gestartet werden: ${message}`);
  }
});

