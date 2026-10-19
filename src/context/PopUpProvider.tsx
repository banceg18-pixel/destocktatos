"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

interface PopUpContextValue {
  error: string | null;
  message: string | null;
  setError: (error: string | null) => void;
  clearError: () => void;
  setMessage: (message: string | null) => void;
  clearMessage: () => void;
}

const PopUpContext = createContext<PopUpContextValue | undefined>(undefined);

/** Fournit les messages d'information (bleus) et d'erreur (rouges) affichés en bas à droite. */
export function PopUpProvider({ children }: { children: ReactNode }) {
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <PopUpContext.Provider
      value={{
        error,
        message,
        setError: (e) => setError(e),
        clearError: () => setError(null),
        setMessage: (m) => setMessage(m),
        clearMessage: () => setMessage(null),
      }}
    >
      {children}
    </PopUpContext.Provider>
  );
}

export function useError() {
  const ctx = useContext(PopUpContext);
  if (!ctx) throw new Error("useError must be used within an ErrorProvider");
  return ctx;
}

export function useMessage() {
  const ctx = useContext(PopUpContext);
  if (!ctx) throw new Error("useMessage must be used within an MessageProvider");
  return ctx;
}
