"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { cn } from "@/lib/client/cn";
import { useInView } from "./Reveal";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Texte qui se « remplit » mot à mot pendant le défilement (opacité de chaque mot pilotée par la
 * progression de l'élément dans la fenêtre). Le texte reste lisible tel quel sans JavaScript.
 */
export function TextReveal({ text, className, as: Tag = "p" }: { text: string; className?: string; as?: "p" | "h2" | "h3" }) {
  const ref = useRef<HTMLElement>(null);
  const words = text.split(/\s+/).filter(Boolean);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      el.style.setProperty("--p", "1");
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 quand le haut du texte atteint 85 % de la hauteur, 1 quand le bas atteint 45 %.
      const p = (vh * 0.85 - r.top) / (r.height + vh * 0.4);
      el.style.setProperty("--p", String(Math.min(1, Math.max(0, p))));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return (
    <Tag ref={ref as never} className={cn("word-reveal", className)} style={{ "--n": words.length } as CSSProperties} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} aria-hidden="true" style={{ "--i": i } as CSSProperties}>
          {w}{" "}
        </span>
      ))}
    </Tag>
  );
}

/** Compteur qui défile jusqu'à sa valeur quand il devient visible. */
export function Counter({ value, suffix = "", prefix = "", duration = 1600, className }: { value: number; suffix?: string; prefix?: string; duration?: number; className?: string }) {
  const [ref, visible] = useInView<HTMLSpanElement>();
  const [shown, setShown] = useState(0);
  useEffect(() => {
    if (!visible) return;
    if (prefersReducedMotion()) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, value, duration]);
  return (
    <span ref={ref} className={cn("t-price", className)} aria-label={`${prefix}${value.toLocaleString("fr-FR")}${suffix}`}>
      <span aria-hidden="true">
        {prefix}
        {shown.toLocaleString("fr-FR")}
        {suffix}
      </span>
    </span>
  );
}
