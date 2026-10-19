/**
 * Client HTTP des services frontend : toutes les requêtes vers l'API passent par ici
 * (les composants n'appellent jamais `fetch` directement pour les opérations métier).
 *
 * Tenue sur réseau lent ou instable :
 * - chaque requête est abandonnée au bout de `timeoutMs` (20 s par défaut) avec un message clair ;
 * - les lectures (GET) sont retentées automatiquement en cas de coupure ou de serveur saturé
 *   (502, 503, 504), avec un délai croissant ; les écritures (commande, paiement, avis…) ne le sont
 *   jamais, pour ne pas les exécuter deux fois.
 */
export type ApiResult<T> = { ok: true; status: number; data: T } | { ok: false; status: number; error: string; details?: unknown };

const NETWORK_ERROR = "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.";
const OFFLINE_ERROR = "Vous êtes hors connexion. Réessayez dès le retour du réseau.";
const TIMEOUT_ERROR = "Le serveur met trop de temps à répondre. Vérifiez votre connexion et réessayez.";
const BUSY_STATUSES = new Set([502, 503, 504]);
const DEFAULT_TIMEOUT_MS = 20_000;

type ApiInit = RequestInit & { json?: unknown; timeoutMs?: number; retries?: number };

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const offline = () => typeof navigator !== "undefined" && navigator.onLine === false;

/** Signal qui s'interrompt au délai dépassé ou quand le signal de l'appelant s'interrompt. */
function withTimeout(ms: number, outer?: AbortSignal | null) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException("Délai dépassé", "TimeoutError")), ms);
  const relay = () => ctrl.abort(outer?.reason);
  if (outer) {
    if (outer.aborted) relay();
    else outer.addEventListener("abort", relay, { once: true });
  }
  return {
    signal: ctrl.signal,
    timedOut: () => ctrl.signal.aborted && !outer?.aborted,
    done: () => {
      clearTimeout(timer);
      outer?.removeEventListener("abort", relay);
    },
  };
}

export async function apiFetch<T>(input: string, init?: ApiInit): Promise<ApiResult<T>> {
  const { json, headers, timeoutMs = DEFAULT_TIMEOUT_MS, retries, signal: outer, ...rest } = init ?? {};
  const method = (rest.method ?? "GET").toUpperCase();
  const maxRetries = retries ?? (method === "GET" || method === "HEAD" ? 2 : 0);

  for (let attempt = 0; ; attempt++) {
    const t = withTimeout(timeoutMs, outer);
    let res: Response;
    let body: unknown = null;
    try {
      res = await fetch(input, {
        ...rest,
        signal: t.signal,
        headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...headers },
        body: json !== undefined ? JSON.stringify(json) : rest.body,
      });
      try {
        body = await res.json();
      } catch {
        body = null;
      }
    } catch {
      const timedOut = t.timedOut();
      t.done();
      if (outer?.aborted) return { ok: false, status: 0, error: "Requête annulée" };
      if (attempt < maxRetries && !offline()) {
        await wait(600 * 2 ** attempt);
        continue;
      }
      return { ok: false, status: 0, error: offline() ? OFFLINE_ERROR : timedOut ? TIMEOUT_ERROR : NETWORK_ERROR };
    }
    t.done();
    if (BUSY_STATUSES.has(res.status) && attempt < maxRetries) {
      await wait(600 * 2 ** attempt);
      continue;
    }
    if (!res.ok) {
      const b = (body ?? {}) as { error?: string; message?: string; details?: unknown };
      const fallback = BUSY_STATUSES.has(res.status) ? "Le site est très sollicité en ce moment. Réessayez dans quelques instants." : "Une erreur est survenue";
      return { ok: false, status: res.status, error: b.error || b.message || fallback, details: b.details };
    }
    return { ok: true, status: res.status, data: body as T };
  }
}
