import crypto from "node:crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { WP_CACHE_TAG } from "@/lib/cms/wordpress";
import { syncCatalogFromWordPress, syncCategoriesFromWordPress, syncProductFromWordPress } from "@/lib/cms/wordpress-sync";
import { invalidateCatalog } from "@/lib/catalog/repository";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

interface WebhookBody {
  event?: string;
  type?: string;
  id?: string;
  slug?: string;
  status?: string;
}

const PRODUCT_ID = /^[A-Za-z0-9]{1,64}$/;

/**
 * POST /api/webhooks/wordpress — appelé par le plugin « TATOS Headless » à chaque modification.
 * Authentifié par l'en-tête X-Tatos-Secret (WORDPRESS_WEBHOOK_SECRET). Invalide le cache des contenus
 * et synchronise le produit modifié (ou tout le catalogue pour « sync.full »). Un produit supprimé
 * ou dépublié dans WordPress n'est pas effacé (historique des commandes) : son stock passe à 0.
 */
export async function POST(req: Request) {
  const secret = process.env.WORDPRESS_WEBHOOK_SECRET;
  const given = req.headers.get("x-tatos-secret") ?? "";
  if (!secret || !safeEqual(given, secret)) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  let body: WebhookBody = {};
  try {
    body = (await req.json()) as WebhookBody;
  } catch {
    /* corps optionnel */
  }
  revalidateTag(WP_CACHE_TAG);
  const id = typeof body.id === "string" && PRODUCT_ID.test(body.id) ? body.id : null;
  let result: unknown = null;
  try {
    if (body.event === "sync.full") {
      result = await syncCatalogFromWordPress();
    } else if (body.event === "categories.updated") {
      result = { categories: (await syncCategoriesFromWordPress()).categories };
    } else if (body.event === "product.deleted" || (body.event === "product.updated" && body.status && body.status !== "publish")) {
      if (id) result = { id, retired: (await prisma.product.updateMany({ where: { id }, data: { stock: 0 } })).count };
    } else if (body.event === "product.updated") {
      result = id ? await syncProductFromWordPress(id) : await syncCatalogFromWordPress();
    }
  } catch (e) {
    console.error("[webhook wordpress] synchronisation impossible:", e);
    return NextResponse.json({ error: "Synchronisation impossible" }, { status: 502 });
  }
  invalidateCatalog();
  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true, event: body.event ?? null, result });
}
