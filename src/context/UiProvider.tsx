"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Panel = "cart" | "search" | "menu" | null;

interface UiContextValue {
  panel: Panel;
  openPanel: (p: Exclude<Panel, null>) => void;
  closePanel: () => void;
  /** Dernier produit ajouté : mis en avant à l'ouverture du mini-panier. */
  lastAddedId: string | null;
  notifyAdded: (id: string) => void;
}

const UiContext = createContext<UiContextValue | null>(null);

/** État des panneaux globaux (mini-panier, recherche, menu mobile) : un seul ouvert à la fois. */
export function UiProvider({ children }: { children: ReactNode }) {
  const [panel, setPanel] = useState<Panel>(null);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const openPanel = useCallback((p: Exclude<Panel, null>) => setPanel(p), []);
  const closePanel = useCallback(() => setPanel(null), []);
  const notifyAdded = useCallback((id: string) => {
    setLastAddedId(id);
    setPanel("cart");
  }, []);
  const value = useMemo(() => ({ panel, openPanel, closePanel, lastAddedId, notifyAdded }), [panel, openPanel, closePanel, lastAddedId, notifyAdded]);
  return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error("useUi doit être utilisé dans <UiProvider>");
  return ctx;
}
