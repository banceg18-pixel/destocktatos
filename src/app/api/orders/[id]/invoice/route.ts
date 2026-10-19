import { prisma } from "@/lib/prisma";
import { getSiteSettings } from "@/lib/cms";
import { ApiError, handleError, requireUser } from "@/lib/server/api";
import { buildInvoicePdf, invoiceNumber } from "@/lib/server/invoice";
import { getUserOrder } from "@/lib/server/orders";
import { objectId } from "@/lib/validation";

const PAID = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"];

/** GET /api/orders/:id/invoice[?download=1] — facture PDF (commande payée du client connecté). */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const order = await getUserOrder(session.id, objectId.parse((await ctx.params).id));
    if (!PAID.includes(order.status) || !order.paidAt) throw new ApiError(409, "La facture est disponible une fois la commande réglée");
    const [user, s] = await Promise.all([prisma.user.findUniqueOrThrow({ where: { id: session.id } }), getSiteSettings()]);
    const pdf = buildInvoicePdf(order, user, {
      name: s.siteName,
      address: s.addressLine,
      city: `${s.postalCode} ${s.city}, ${s.country}`,
      email: s.email,
      phone: s.phone,
    });
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
