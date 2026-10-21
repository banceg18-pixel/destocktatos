import { ApiError, json, route } from "@/lib/server/api";
import { getBuyerOrder, requireBuyer } from "@/lib/server/buyer";
import { invoiceAvailable, invoiceNumber } from "@/lib/server/invoice";
import { objectId } from "@/lib/validation";

/** GET /api/orders/:id/download-invoice — lien vers la facture PDF (format de réponse du site source). */
export const GET = route("GET /api/orders/:id/download-invoice", async (_req: Request, ctx: { params: Promise<{ id: string }> }) => {
  await requireBuyer();
  const order = await getBuyerOrder(objectId.parse((await ctx.params).id));
  if (!invoiceAvailable(order)) throw new ApiError(409, "La facture est disponible une fois le paiement reçu");
  const url = `/api/orders/${order.id}/invoice?download=1`;
  return json({ success: true, downloadUrl: url, invoiceNumber: invoiceNumber(order) });
});
