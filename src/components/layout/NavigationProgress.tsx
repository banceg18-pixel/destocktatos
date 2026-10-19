"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

const sameUrl = (a: string, b: string) => {
  const x = new URL(a, location.href);
  const y = new URL(b, location.href);
  return x.pathname === y.pathname && x.search === y.search;
};

/**
 * Fine barre de progression en haut de l'écran pendant les navigations internes (clic sur un
 * lien du site). Remplace l'écran « Chargement… » : la page courante reste visible et les codes
 * HTTP (404) restent exacts, aucune limite de Suspense n'enveloppant les pages.
 * Volontairement sans `useSearchParams` : dans la mise en page racine, ce hook impose une zone
 * rendue côté client seulement, source d'erreurs d'hydratation intermittentes sur appareil chargé.
 * La fin d'une navigation (y compris un simple changement de filtres) est détectée sur l'URL.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");
  const timer = useRef<number | undefined>(undefined);
  const poll = useRef<number | undefined>(undefined);
  const target = useRef<string | null>(null);

  const finish = useCallback(() => {
    target.current = null;
    window.clearInterval(poll.current);
    window.clearTimeout(timer.current);
    setState((s) => (s === "loading" ? "done" : s));
    timer.current = window.setTimeout(() => setState("idle"), 450);
  }, []);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement).closest("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (sameUrl(url.href, location.href)) return; // ancre ou même page
      target.current = url.href;
      window.clearTimeout(timer.current);
      window.clearInterval(poll.current);
      setState("loading");
      // L'URL change quand la nouvelle page est affichée (y compris pour un changement de filtres).
      poll.current = window.setInterval(() => {
        if (target.current && sameUrl(target.current, location.href)) finish();
      }, 120);
      // Garde-fou : une navigation qui n'aboutit pas (réseau coupé) ne laisse pas la barre figée.
      timer.current = window.setTimeout(finish, 20000);
    };
    const reset = () => {
      target.current = null;
      window.clearTimeout(timer.current);
      window.clearInterval(poll.current);
      setState("idle");
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("offline", reset);
    window.addEventListener("pageshow", reset);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("offline", reset);
      window.removeEventListener("pageshow", reset);
      window.clearTimeout(timer.current);
      window.clearInterval(poll.current);
    };
  }, [finish]);

  useEffect(() => {
    finish();
  }, [pathname, finish]);

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[400] h-[2px]">
      <div
        className="h-full origin-left bg-ink transition-[transform,opacity] ease-[var(--ease-out-expo)]"
        style={{
          transform: state === "idle" ? "scaleX(0)" : state === "loading" ? "scaleX(0.7)" : "scaleX(1)",
          opacity: state === "done" ? 0 : 1,
          transitionDuration: state === "loading" ? "6s" : "400ms",
        }}
      />
    </div>
  );
}
