import { ApiError, json, route } from "@/lib/server/api";
import { getBuyerOrder, requireBuyer } from "@/lib/server/buyer";
import { invoiceAvailable, invoiceNumber } from "@/lib/server/invoice";
import { objectId } from "@/lib/validation";

/** GET /api/orders/:id/view-invoice — lien vers la facture PDF (format de réponse du site source). */
export const GET = route("GET /api/orders/:id/view-invoice", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireBuyer();
  const order = await getBuyerOrder(objectId.parse((await ctx.params).id));
  if (!invoiceAvailable(order)) throw new ApiError(409, "Die Rechnung ist nach Zahlungseingang verfügbar");
  const url = `/api/orders/${order.id}/invoice`;
  return json({ success: true, viewUrl: url, invoiceNumber: invoiceNumber(order) });
});
