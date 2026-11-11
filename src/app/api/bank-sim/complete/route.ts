import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ApiError, json, parseBody, route } from "@/lib/server/api";
import { verifyBridgeToken } from "@/lib/server/bridge";
import { markOrderPaid } from "@/lib/server/orders";

const schema = z.object({
  token: z.string(),
  decision: z.enum(["approve", "decline"]),
  bankId: z.string().optional(),
});

function originOf(request: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const proto = request.headers.get("x-forwarded-proto") ?? "http";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : new URL(request.url).origin;
}

/**
 * POST /api/bank-sim/complete — Valide ou refuse la simulation de virement bancaire allemand.
 * En cas d'approbation ("approve"), valide la commande et la passe en PAYEE de façon vérifiée.
 */
export const POST = route("POST /api/bank-sim/complete", async (req: Request) => {
  const { token, decision, bankId } = await parseBody(req, schema);
  const payload = verifyBridgeToken(token);

  if (!payload) {
    throw new ApiError(400, "Ungültiges oder abgelaufenes Überweisungs-Token.");
  }

  const order = await prisma.order.findUnique({
    where: { id: payload.orderId },
  });

  if (!order) {
    throw new ApiError(404, "Bestellung nicht gefunden.");
  }

  const origin = originOf(req);

  if (decision === "decline") {
    return json({
      ok: true,
      decision: "decline",
      callbackUrl: `${origin}/paiement?error=bank_declined`,
    });
  }

  // Paiement validé par la banque allemande simulée (équivalent webhook Bridge ACSC)
  const paid = await markOrderPaid(order.id, {
    provider: "bridge",
    mode: "test",
    providerRef: `bridge_sim_${order.id}_${Date.now()}`,
    details: {
      bankId: bankId || payload.bankId || "sparkasse",
      instantTransfer: true,
      payer: payload.user,
      beneficiaryIban: "DE53310108339914082074",
    },
  });

  return json({
    ok: true,
    decision: "approve",
    orderId: paid.id,
    orderNumber: paid.number,
    callbackUrl: `${origin}/confirmation?order=${encodeURIComponent(paid.id)}&status=success`,
  });
});

