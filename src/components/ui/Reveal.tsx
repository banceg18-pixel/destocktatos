"use client";

import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/client/cn";

/** Observateur partagé : un seul IntersectionObserver pour tous les éléments à révéler. */
let observer: IntersectionObserver | null = null;
const callbacks = new WeakMap<Element, () => void>();
function observe(el: Element, cb: () => void) {
  if (typeof IntersectionObserver === "undefined") return cb();
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          callbacks.get(e.target)?.();
          observer!.unobserve(e.target);
          callbacks.delete(e.target);
        }
      }
    },
    { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
  );
  callbacks.set(el, cb);
  observer.observe(el);
  return () => {
    observer?.unobserve(el);
    callbacks.delete(el);
  };
}

/** Hook : passe à `true` (une seule fois) quand l'élément entre dans la fenêtre. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    return observe(ref.current, () => setVisible(true)) ?? undefined;
  }, []);
  return [ref, visible] as const;
}

/**
 * Apparition au défilement (fondu + légère montée, ou dévoilement en masque).
 * Sans JavaScript ou avec « mouvement réduit », le contenu est simplement visible.
 */
export function Reveal({
  as = "div",
  delay = 0,
  mask = false,
  className,
  style,
  children,
  ...rest
}: {
  as?: keyof React.JSX.IntrinsicElements;
  delay?: number;
  mask?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
} & Record<string, unknown>) {
  const [ref, visible] = useInView<HTMLElement>();
  if (mask) {
    // Le masque (clip-path) s'applique à un calque intérieur : un élément entièrement masqué n'est
    // jamais « visible » pour l'observateur, il ne serait donc jamais dévoilé. Le conteneur doit être
    // positionné (relative) ; le calque le remplit.
    return createElement(
      as,
      { ref, className, style, ...rest },
      <div className="reveal-mask absolute inset-0" data-visible={visible ? "true" : "false"} style={{ "--reveal-delay": `${delay}ms` } as CSSProperties}>
        {children}
      </div>,
    );
  }
  return createElement(
    as,
    {
      ref,
      className: cn("reveal", className),
      "data-visible": visible ? "true" : "false",
      style: { ...style, "--reveal-delay": `${delay}ms` } as CSSProperties,
      ...rest,
    },
    children,
  );
}
