import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/cms";
import { ApiError, handleError } from "@/lib/server/api";
import { bankDetailsOf } from "@/lib/bank";
import { getBuyerOrder, requireBuyer } from "@/lib/server/buyer";
import { buildInvoicePdf, invoiceAvailable, invoiceNumber, invoiceStore, quoteNumber } from "@/lib/server/invoice";
import { objectId } from "@/lib/validation";

/**
 * GET /api/orders/:id/invoice[?download=1][&type=devis] — facture (ou devis) PDF d'une commande payée
 * ou en attente de virement, pour son client (compte connecté, ou invité pour la commande qu'il vient de passer).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    await requireBuyer();
    const order = await getBuyerOrder(objectId.parse((await ctx.params).id));
    if (!invoiceAvailable(order)) throw new ApiError(409, "La facture est disponible une fois la commande confirmée");
    const [user, s] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: order.userId } }), getSiteSettings()]);
    const params = new URL(req.url).searchParams;
    const kind = params.get("type") === "devis" ? "devis" : "facture";
    const pdf = buildInvoicePdf(order, user, invoiceStore(s), bankDetailsOf(s), kind);
    const name = kind === "devis" ? `devis_${quoteNumber(order)}` : `facture_${invoiceNumber(order)}`;
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${params.get("download") === "1" ? "attachment" : "inline"}; filename="${name}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e, "GET /api/orders/:id/invoice");
  }
}
