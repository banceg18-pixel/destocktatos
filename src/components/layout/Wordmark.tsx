"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/client/cn";

/**
 * Nom du magasin en très grand, sur toute la largeur de son conteneur (accueil, pied de page).
 * Une estimation CSS (selon le nombre de lettres) évite tout saut au premier affichage, puis la
 * taille est ajustée à la mesure réelle : le rendu reste juste quel que soit le nom.
 * `animated` fait monter les lettres une à une au chargement.
 */
export function Wordmark({ name, animated = false, className }: { name: string; animated?: boolean; className?: string }) {
  const box = useRef<HTMLSpanElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  const letters = [...name.toUpperCase()];

  useLayoutEffect(() => {
    const outer = box.current;
    const inner = text.current;
    if (!outer || !inner) return;
    const fit = () => {
      outer.style.fontSize = "100px";
      const ratio = outer.clientWidth / inner.scrollWidth;
      outer.style.fontSize = `${Math.floor(100 * ratio * 10) / 10}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(outer);
    // Les polices web peuvent arriver après le premier calcul.
    document.fonts?.ready.then(fit).catch(() => {});
    return () => ro.disconnect();
  }, [name]);

  return (
    <span
      ref={box}
      role="img"
      aria-label={name}
      className={cn("t-wordmark block w-full", className)}
      // Estimation avant mesure : chasse moyenne d'une capitale Archivo élargie ≈ 0,9 em.
      style={{ fontSize: `calc(var(--wordmark-width, 100cqw) / ${letters.length * 0.9})` } as CSSProperties}
    >
      <span ref={text} aria-hidden="true" className={cn("inline-block overflow-hidden whitespace-nowrap pb-[0.04em]", animated && "rise")}>
        {letters.map((l, i) => (
          <span key={i} style={{ "--i": i } as CSSProperties}>
            {l === " " ? " " : l}
          </span>
        ))}
      </span>
    </span>
  );
}

/** Logo compact de l'en-tête. */
export function Logo({ name, className }: { name: string; className?: string }) {
  return <span className={cn("font-display text-[1.15rem] font-semibold uppercase tracking-[-0.03em] [font-stretch:125%] lg:text-[1.3rem]", className)}>{name}</span>;
}
