import { ApiError, json, requireUser, route } from "@/lib/server/api";
import { invoiceNumber } from "@/lib/server/invoice";
import { getUserOrder } from "@/lib/server/orders";
import { objectId } from "@/lib/validation";

const PAID = ["PAYEE", "EN_PREPARATION", "EXPEDIEE", "LIVREE"];

/** GET /api/orders/:id/view-invoice — lien vers la facture PDF (format de réponse du site source). */
export const GET = route("GET /api/orders/:id/view-invoice", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireUser();
  const order = await getUserOrder(user.id, objectId.parse((await ctx.params).id));
  if (!PAID.includes(order.status) || !order.paidAt) throw new ApiError(409, "La facture est disponible une fois la commande réglée");
  const url = `/api/orders/${order.id}/invoice`;
  return json({ success: true, viewUrl: url, invoiceNumber: invoiceNumber(order) });
});
