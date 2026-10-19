import "server-only";

type Entry<T> = { value?: T; has: boolean; expires: number; pending?: Promise<T> };

// Partagé entre les rechargements de modules (développement) ; un seul magasin par processus.
const globalStore = globalThis as unknown as { __memoStore?: Map<string, Entry<unknown>> };
const store = (globalStore.__memoStore ??= new Map());

function load<T>(key: string, ttlMs: number, loader: () => Promise<T>, entry: Entry<T>): Promise<T> {
  entry.pending = loader()
    .then((value) => {
      // Une invalidation pendant le chargement l'emporte : on ne réécrit pas une entrée supprimée.
      if (store.get(key) === entry) Object.assign(entry, { value, has: true, expires: Date.now() + ttlMs });
      return value;
    })
    .finally(() => {
      entry.pending = undefined;
    });
  return entry.pending;
}

/**
 * Cache mémoire du processus, pensé pour la charge :
 * - une seule lecture en base à la fois par clé, même avec des centaines de visiteurs simultanés ;
 * - une valeur expirée continue d'être servie pendant son rafraîchissement en arrière-plan ;
 * - si le rafraîchissement échoue (base momentanément indisponible), la dernière valeur connue reste servie.
 */
export function memo<T>(key: string, ttlMs: number, loader: () => Promise<T>): Promise<T> {
  if (!(ttlMs > 0)) return loader();
  let entry = store.get(key) as Entry<T> | undefined;
  if (!entry) {
    entry = { has: false, expires: 0 };
    store.set(key, entry as Entry<unknown>);
  }
  if (entry.has) {
    if (entry.expires <= Date.now() && !entry.pending) load(key, ttlMs, loader, entry).catch(() => {});
    return Promise.resolve(entry.value as T);
  }
  return entry.pending ?? load(key, ttlMs, loader, entry);
}

/** Oublie les entrées dont la clé commence par `prefix` (toutes si absent) : la lecture suivante repart de la base. */
export function invalidateMemo(prefix = "") {
  for (const key of [...store.keys()]) if (key.startsWith(prefix)) store.delete(key);
}
