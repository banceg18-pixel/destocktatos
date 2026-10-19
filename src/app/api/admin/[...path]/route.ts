import { handleError } from "@/lib/server/api";
import { handleAdmin } from "@/lib/server/admin";

/** /api/admin/* — API d'administration (espace WordPress), voir src/lib/server/admin.ts. */
type Ctx = { params: Promise<{ path: string[] }> };

async function handler(req: Request, ctx: Ctx) {
  try {
    const { path } = await ctx.params;
    const res = await handleAdmin(req, path);
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (e) {
    return handleError(e, `${req.method} /api/admin`);
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
