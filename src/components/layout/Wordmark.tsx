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
    const estimate = outer.style.fontSize;
    const fit = () => {
      outer.style.fontSize = "100px";
      const width = inner.scrollWidth;
      // Plafond : l'estimation CSS + 6 %. Une mesure faussée (police de secours encore affichée,
      // élément pas encore mis en page, Safari iOS) ne peut plus faire déborder le nom de l'écran.
      const max = (outer.clientWidth / (letters.length * 0.9)) * 1.06;
      const size = width > 0 ? Math.min((100 * outer.clientWidth) / width, max) : NaN;
      outer.style.fontSize = Number.isFinite(size) && size > 0 ? `${Math.floor(size * 10) / 10}px` : estimate;
    };
    fit();
    // Le conteneur change de largeur, ou le texte change de chasse (la vraie police remplace la police de secours).
    const ro = new ResizeObserver(() => requestAnimationFrame(fit));
    ro.observe(outer);
    ro.observe(inner);
    const fonts = document.fonts;
    const family = getComputedStyle(outer).fontFamily;
    fonts?.load(`600 100px ${family}`, name).then(fit).catch(() => {});
    fonts?.ready.then(fit).catch(() => {});
    fonts?.addEventListener?.("loadingdone", fit);
    return () => {
      ro.disconnect();
      fonts?.removeEventListener?.("loadingdone", fit);
    };
  }, [name, letters.length]);

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
  // Petits écrans : la taille suit la largeur pour que le nom (12 lettres) tienne à côté des icônes.
  return <span className={cn("font-display text-[clamp(0.75rem,calc((100vw-200px)/10),1.15rem)] font-semibold uppercase tracking-[-0.03em] [font-stretch:125%] xl:text-[1.3rem]", className)}>{name}</span>;
}
