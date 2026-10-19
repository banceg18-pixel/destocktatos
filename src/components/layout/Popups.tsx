"use client";

import { useEffect } from "react";
import { useError, useMessage } from "@/context/PopUpProvider";
import { IconAlert, IconCheck, IconClose } from "@/components/ui/Icons";

/** Notifications : information (6 s) et erreur (10 s), fermables, annoncées aux lecteurs d'écran. */
function Toast({ kind, text, onClose }: { kind: "info" | "error"; text: string; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, kind === "error" ? 10000 : 6000);
    return () => window.clearTimeout(t);
  }, [text, kind, onClose]);
  return (
    <div
      role={kind === "error" ? "alert" : "status"}
      className="on-dark pointer-events-auto flex w-full max-w-sm animate-[slide-up_0.5s_var(--ease-out-expo)_both] items-start gap-3 rounded-md bg-ink p-4 pr-3 text-sm text-paper shadow-2xl"
    >
      <span className={kind === "error" ? "mt-0.5 text-[#ff9b8f]" : "mt-0.5 text-[#8fd6a8]"}>{kind === "error" ? <IconAlert /> : <IconCheck />}</span>
      <p className="flex-1 leading-relaxed">{text}</p>
      <button type="button" onClick={onClose} aria-label="Fermer la notification" className="rounded-full p-1 text-white/60 transition-colors hover:text-paper">
        <IconClose size={16} />
      </button>
    </div>
  );
}

export function Toasts() {
  const { message, clearMessage } = useMessage();
  const { error, clearError } = useError();
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[260] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-5 sm:bottom-5">
      {message && <Toast kind="info" text={message} onClose={clearMessage} />}
      {error && <Toast kind="error" text={error} onClose={clearError} />}
    </div>
  );
}

/** Compatibilité : anciens points de montage. */
export const MessagePopup = () => null;
export const ErrorPopup = () => null;
