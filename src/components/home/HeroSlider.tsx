"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import type { HeroSlide } from "@/types/home";
import { cn } from "@/lib/client/cn";
import { ButtonLink, IconButton } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Primitives";
import { Wordmark } from "@/components/layout/Wordmark";

const INTERVAL = 7000;

/**
 * Ouverture de l'accueil : photo plein écran, nom du magasin en très grand, message et bouton par
 * diapositive. Défilement automatique (pause au survol, au focus clavier, onglet masqué ou
 * mouvement réduit), flèches et barres de progression.
 */
export function HeroSlider({ slides, siteName }: { slides: HeroSlide[]; siteName: string }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  const count = slides.length;
  // Chargement progressif des visuels : seul le premier part au chargement de la page ; le suivant est
  // préparé une fois l'actuel affiché, et le défilement attend qu'il soit prêt (connexions lentes).
  const [armed, setArmed] = useState(1);
  const [ready, setReady] = useState<number[]>([]);
  const markReady = useCallback((i: number) => setReady((r) => (r.includes(i) ? r : [...r, i])), []);

  const go = useCallback((i: number) => setIndex(((i % count) + count) % count), [count]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mq.removeEventListener("change", onChange);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (ready.includes(index)) setArmed((a) => Math.max(a, Math.min(count, index + 2)));
    else setArmed((a) => Math.max(a, index + 1));
  }, [ready, index, count]);

  const nextReady = ready.includes((index + 1) % count);
  useEffect(() => {
    if (paused || reduced || count < 2 || !nextReady) return;
    timer.current = window.setTimeout(() => go(index + 1), INTERVAL);
    return () => window.clearTimeout(timer.current);
  }, [index, paused, reduced, count, go, nextReady]);

  const slide = slides[index];
  const running = !paused && !reduced && count > 1 && nextReady;

  return (
    <section
      aria-roledescription="carrousel"
      aria-label="À la une"
      className="on-dark relative isolate flex h-[100svh] min-h-[620px] max-h-[1080px] flex-col overflow-hidden bg-ink text-paper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {slides.map((s, i) => (
        <div key={s.image} aria-hidden={i !== index} className={cn("absolute inset-0 -z-10 transition-opacity duration-[1400ms] ease-[var(--ease-in-out-soft)]", i === index ? "opacity-100" : "opacity-0")}>
          {i < armed && (
            <Image
              src={s.image}
              alt={s.imageAlt}
              fill
              priority={i === 0}
              sizes="100vw"
              onLoad={() => markReady(i)}
              className={cn("object-cover", i === index && !reduced && "kenburns")}
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-ink/55 via-ink/25 to-ink/80" aria-hidden="true" />

      <h1 className="sr-only">
        {siteName} — électroménager livré, installé et garanti
      </h1>
      <div className="shell pt-[calc(var(--header-h)+clamp(12px,3vw,40px))] [container-type:inline-size]">
        <Wordmark name={siteName} animated />
      </div>

      <div className="shell mt-auto grid grid-cols-[minmax(0,1fr)] gap-10 pb-10 md:pb-14 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div key={index} className="min-w-0 max-w-[44rem]" aria-live={running ? "off" : "polite"}>
          <h2 className="t-display animate-[slide-up_1s_var(--ease-out-expo)_80ms_both]">{slide.title}</h2>
          <p className="mt-5 max-w-md text-[1.02rem] leading-relaxed text-white/80 animate-[slide-up_1s_var(--ease-out-expo)_160ms_both]">{slide.text}</p>
          <div className="mt-8 animate-[slide-up_1s_var(--ease-out-expo)_240ms_both]">
            <ButtonLink href={slide.href} variant="light" size="lg" icon={<Arrow />}>
              {slide.cta}
            </ButtonLink>
          </div>
        </div>

        {count > 1 && (
          <div className="flex items-center justify-between gap-3 sm:justify-start sm:gap-5">
            <ol className="flex gap-2" aria-label="Diapositives">
              {slides.map((s, i) => (
                <li key={s.image}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Diapositive ${i + 1} sur ${count} : ${s.title}`}
                    aria-current={i === index ? "true" : undefined}
                    className="group block py-3"
                  >
                    <span className="block h-[2px] w-8 overflow-hidden bg-white/25 sm:w-14">
                      <span
                        className={cn("block h-full origin-left bg-paper", i < index && "scale-x-100", i > index && "scale-x-0", i === index && (running ? "animate-[progress_linear_both]" : "scale-x-100"))}
                        style={i === index && running ? ({ animationDuration: `${INTERVAL}ms` } as CSSProperties) : undefined}
                      />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
            <span className="t-spec w-14 shrink-0 text-center text-white/70" aria-hidden="true">
              {String(index + 1).padStart(2, "0")} / {String(count).padStart(2, "0")}
            </span>
            <div className="flex gap-2">
              <IconButton label="Diapositive précédente" tone="dark" onClick={() => go(index - 1)}>
                <Arrow direction="left" />
              </IconButton>
              <IconButton label="Diapositive suivante" tone="dark" onClick={() => go(index + 1)}>
                <Arrow />
              </IconButton>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
