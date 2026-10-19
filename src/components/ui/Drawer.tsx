"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/client/cn";

/** Verrouille le défilement de la page (compteur : plusieurs panneaux peuvent s'empiler). */
let locks = 0;
export function lockScroll() {
  if (locks++ === 0) {
    const w = window.innerWidth - document.documentElement.clientWidth;
    document.documentElement.style.overflow = "hidden";
    if (w > 0) document.documentElement.style.paddingRight = `${w}px`;
  }
  return () => {
    if (--locks === 0) {
      document.documentElement.style.overflow = "";
      document.documentElement.style.paddingRight = "";
    }
  };
}

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type="hidden"]),select,textarea,[tabindex]:not([tabindex="-1"])';

/**
 * Panneau modal coulissant (droite, gauche ou bas) : fond assombri, fermeture par Échap ou clic
 * extérieur, focus maintenu dans le panneau puis rendu à l'élément d'origine.
 */
export function Drawer({
  open,
  onClose,
  title,
  side = "right",
  children,
  footer,
  className,
  tone = "paper",
  hideTitle = false,
  id,
  closeLabel = "Fermer",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  side?: "right" | "left" | "bottom" | "top";
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  tone?: "paper" | "ink";
  hideTitle?: boolean;
  id?: string;
  /** Nom accessible du bouton de fermeture (ex. « Fermer le menu »). */
  closeLabel?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  // Rendu uniquement après montage : le portail n'existe pas côté serveur (sinon écart d'hydratation).
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const unlock = lockScroll();
    const t = window.setTimeout(() => {
      const first = panel.current?.querySelector<HTMLElement>("[data-autofocus]") ?? panel.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panel.current)?.focus();
    }, 60);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === "Tab" && panel.current) {
        const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const [first, last] = [items[0], items[items.length - 1]];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      unlock();
      previous?.focus?.();
    };
  }, [open]);

  if (!mounted) return null;
  return createPortal(
    <div className={cn("fixed inset-0 z-[300]", open ? "visible" : "invisible delay-500")} aria-hidden={!open}>
      <div
        className={cn("absolute inset-0 bg-ink/45 backdrop-blur-[2px] transition-opacity duration-500", open ? "opacity-100" : "opacity-0")}
        onClick={onClose}
      />
      <div
        ref={panel}
        id={id}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "absolute flex flex-col outline-none transition-transform duration-[650ms] ease-[var(--ease-out-expo)]",
          tone === "ink" ? "on-dark bg-ink text-paper" : "bg-paper text-ink",
          side === "right" && "inset-y-0 right-0 w-full max-w-[460px]",
          side === "left" && "inset-y-0 left-0 w-full max-w-[460px]",
          side === "bottom" && "inset-x-0 bottom-0 max-h-[88dvh] rounded-t-md",
          side === "top" && "inset-x-0 top-0 max-h-[92dvh]",
          open
            ? "translate-x-0 translate-y-0"
            : side === "right"
              ? "translate-x-full"
              : side === "left"
                ? "-translate-x-full"
                : side === "top"
                  ? "-translate-y-full"
                  : "translate-y-full",
          className,
        )}
      >
        <div className={cn("flex items-center justify-between gap-4 px-6 py-5", tone === "ink" ? "border-b border-white/10" : "border-b border-line")}>
          <h2 id={titleId} className={cn("t-eyebrow", hideTitle && "sr-only")}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className={cn("t-eyebrow inline-flex items-center gap-2 rounded-full py-2 pl-3 pr-2 transition-colors", tone === "ink" ? "hover:bg-white/10" : "hover:bg-mist")}
          >
            Fermer
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 3l10 10M13 3 3 13" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
        {footer && <div className={cn("px-6 py-5", tone === "ink" ? "border-t border-white/10" : "border-t border-line")}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
