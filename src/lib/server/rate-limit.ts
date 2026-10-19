/**
 * Limiteur de débit en mémoire (fenêtre fixe). Suffisant pour une instance unique ;
 * en production multi-instance, remplacer par un stockage partagé (Redis…).
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  // Purge des fenêtres expirées : la mémoire reste bornée même avec un très grand nombre de visiteurs.
  if (buckets.size > 5000) for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimits() {
  buckets.clear();
}
