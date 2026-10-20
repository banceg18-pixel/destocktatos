import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { invalidateMemo } from "./memo";

/**
 * Versions partagées des caches mémoire, pour qu'une modification soit visible partout en quelques
 * secondes, même quand l'hébergeur fait tourner plusieurs copies du site (processus, instances) :
 * - « content » : contenus lus dans WordPress (réglages, pages, menus, FAQ, articles) ;
 * - « catalog » : produits, stock, catégories, avis (instantané du catalogue).
 * Une écriture incrémente la version en base (`bumpVersion`) ; chaque copie la relit au plus toutes
 * les 2 s (`syncCaches`) et vide alors ses caches concernés. Base indisponible : caches conservés.
 */
const CHECK_MS = 2000;
const KEYS = { content: "wp:", catalog: "catalog:" } as const;
export type SyncKey = keyof typeof KEYS;

type State = { seen: Map<string, string>; checkedAt: number; pending?: Promise<void> };
const g = globalThis as unknown as { __syncVersions?: State };
const state: State = (g.__syncVersions ??= { seen: new Map<string, string>(), checkedAt: 0 });

async function check() {
  try {
    const rows = await prisma.siteState.findMany({ where: { key: { in: Object.keys(KEYS) } } });
    for (const r of rows) {
      const prev = state.seen.get(r.key);
      if (prev !== r.value) {
        // Premier passage : rien à vider (les caches ont été remplis avec cette version au plus tard).
        if (prev !== undefined) invalidateMemo(KEYS[r.key as SyncKey]);
        state.seen.set(r.key, r.value);
      }
    }
  } catch (e) {
    console.error("[sync] lecture des versions impossible :", (e as Error).message);
  } finally {
    state.checkedAt = Date.now();
  }
}

/** À appeler avant de lire un cache mémoire partagé : le vide si une autre copie a écrit depuis. */
export function syncCaches(): Promise<void> {
  if (Date.now() - state.checkedAt < CHECK_MS) return Promise.resolve();
  state.pending ??= check().finally(() => {
    state.pending = undefined;
  });
  return state.pending;
}

/** Version courante d'un cache (sert aussi à contourner les caches HTTP de WordPress). */
export function currentVersion(key: SyncKey) {
  return state.seen.get(key) ?? "0";
}

/** Signale une écriture : cache local vidé tout de suite, les autres copies suivent sous 2 s. */
export async function bumpVersion(key: SyncKey) {
  const value = `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
  invalidateMemo(KEYS[key]);
  state.seen.set(key, value);
  try {
    await prisma.siteState.upsert({ where: { key }, update: { value }, create: { key, value } });
  } catch (e) {
    console.error(`[sync] version « ${key} » non enregistrée :`, (e as Error).message);
  }
}
