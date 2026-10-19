import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";
import { getSession } from "@/lib/auth";
import { rateLimit } from "./rate-limit";

/** Erreur métier contrôlée : message affichable à l'utilisateur + code HTTP. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/**
 * Réponses publiques du catalogue (identiques pour tous les visiteurs) : le navigateur les garde 30 s,
 * un CDN 60 s, puis les sert encore 5 min pendant leur rafraîchissement. Allège le serveur aux pics de trafic.
 */
export const PUBLIC_CACHE = { headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } };

export function json<T>(data: T, init?: number | ResponseInit) {
  return NextResponse.json(data, typeof init === "number" ? { status: init } : init);
}

/** Traduit les erreurs en réponses JSON propres (aucun détail technique exposé). */
export function handleError(err: unknown, context: string) {
  if (err instanceof ApiError) {
    return NextResponse.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, { status: err.status });
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ champ: i.path.join("."), message: i.message }));
    return NextResponse.json({ error: details[0]?.message || "Données invalides", details }, { status: 400 });
  }
  console.error(`[api] ${context}:`, err);
  return NextResponse.json({ error: "Une erreur interne est survenue. Veuillez réessayer." }, { status: 500 });
}

/** Enveloppe un handler : gestion d'erreurs uniforme. */
export function route<A extends unknown[]>(context: string, fn: (...args: A) => Promise<Response>) {
  return async (...args: A) => {
    try {
      return await fn(...args);
    } catch (e) {
      return handleError(e, context);
    }
  };
}

export async function parseBody<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "Corps de requête JSON invalide");
  }
  return schema.parse(body);
}

/** Exige un utilisateur connecté ; renvoie son identifiant. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) throw new ApiError(401, "Vous devez être connecté");
  return session.user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new ApiError(403, "Accès refusé");
  return user;
}

export function clientIp(req: Request) {
  return (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "local";
}

/** Limitation de débit par IP pour les formulaires publics. */
export function limitByIp(req: Request, bucket: string, limit = 10, windowMs = 10 * 60 * 1000) {
  const r = rateLimit(`${bucket}:${clientIp(req)}`, limit, windowMs);
  if (!r.ok) throw new ApiError(429, `Trop de requêtes. Réessayez dans ${r.retryAfter} secondes.`);
}
