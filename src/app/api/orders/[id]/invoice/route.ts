import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/cms";
import { ApiError, handleError, requireUser } from "@/lib/server/api";
import { bankDetailsOf } from "@/lib/bank";
import { buildInvoicePdf, invoiceAvailable, invoiceNumber, invoiceStore } from "@/lib/server/invoice";
import { getUserOrder } from "@/lib/server/orders";
import { objectId } from "@/lib/validation";

/** GET /api/orders/:id/invoice[?download=1] — facture PDF (commande payée ou en attente de virement du client connecté). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const order = await getUserOrder(session.id, objectId.parse((await ctx.params).id));
    if (!invoiceAvailable(order)) throw new ApiError(409, "La facture est disponible une fois la commande confirmée");
    const [user, s] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: session.id } }), getSiteSettings()]);
    const pdf = buildInvoicePdf(order, user, invoiceStore(s), bankDetailsOf(s));
    const download = new URL(req.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="facture_${invoiceNumber(order)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return handleError(e, "GET /api/orders/:id/invoice");
  }
}
