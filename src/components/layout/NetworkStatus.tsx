"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Bandeau discret quand la connexion est perdue, puis « Connexion rétablie » quelques secondes.
 * Le panier reste enregistré sur l'appareil ; les lectures sont retentées automatiquement (services/http).
 */
export function NetworkStatus() {
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Page entièrement hydratée (les effets ne s'exécutent qu'après la mise en place de tout l'arbre) :
    // repère utilisé par les tests de bout en bout avant d'interagir avec la page.
    document.documentElement.dataset.hydrated = "1";
    const goOffline = () => {
      window.clearTimeout(timer.current);
      setState("offline");
    };
    const goOnline = () => {
      setState((s) => (s === "offline" ? "back" : s));
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setState("online"), 3500);
    };
    if (navigator.onLine === false) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      window.clearTimeout(timer.current);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(var(--header-h)+8px)] z-[270] flex justify-center px-4">
      {state !== "online" && (
        <p className="on-dark animate-[slide-up_0.4s_var(--ease-out-expo)_both] rounded-full bg-ink px-4 py-2 text-center text-[0.8rem] text-paper shadow-xl">
          {state === "offline" ? "Hors connexion : votre panier est conservé, reprise automatique au retour du réseau." : "Connexion rétablie."}
        </p>
      )}
    </div>
  );
}
