"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/client/cn";
import { IconButton } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";

/**
 * Rangée défilante horizontale (défilement natif : glisser au doigt, molette, clavier) avec
 * flèches qui avancent d'un écran. Les flèches se désactivent aux extrémités.
 */
export function Rail({ children, label, className, controlsClassName }: { children: ReactNode; label: string; className?: string; controlsClassName?: string }) {
  const track = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    update();
    const el = track.current;
    el?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };

  return (
    <div className={className}>
      <ul ref={track} aria-label={label} className="scroll-x flex gap-3 sm:gap-4">
        {children}
      </ul>
      <div className={cn("mt-6 flex justify-end gap-2", edges.start && edges.end && "hidden", controlsClassName)}>
        <IconButton label="Précédent" onClick={() => scroll(-1)} disabled={edges.start}>
          <Arrow direction="left" />
        </IconButton>
        <IconButton label="Suivant" onClick={() => scroll(1)} disabled={edges.end}>
          <Arrow />
        </IconButton>
      </div>
    </div>
  );
}
