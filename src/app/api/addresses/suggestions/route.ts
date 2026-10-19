import { z } from "zod";
import { ApiError, json, limitByIp, route } from "@/lib/server/api";
import { suggestAddresses } from "@/lib/server/ban";

/** GET /api/addresses/suggestions?q=… — autocomplétion d'adresses (proxy Base Adresse Nationale). */
export const GET = route("GET /api/addresses/suggestions", async (req: Request) => {
  limitByIp(req, "address-suggest", 120, 60 * 1000);
  const q = z.string().trim().max(200).parse(new URL(req.url).searchParams.get("q") ?? "");
  if (q.length < 3) return json({ suggestions: [] });
  try {
    return json({ suggestions: await suggestAddresses(q) });
  } catch (e) {
    console.warn("[addresses] BAN indisponible:", (e as Error).message);
    throw new ApiError(503, "Service d'adresses momentanément indisponible");
  }
});
