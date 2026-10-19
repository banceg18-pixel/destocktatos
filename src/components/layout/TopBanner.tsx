"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/client/cn";

/**
 * Bandeau promotionnel tout en haut, fixé avec l'en-tête. Plusieurs messages alternent toutes
 * les 5 s (pause au survol ou au focus) ; ils partagent la même case, la hauteur ne bouge pas.
 */
export function TopBanner({ messages }: { messages: string[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (messages.length < 2 || paused) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), 5000);
    return () => window.clearInterval(id);
  }, [messages.length, paused]);

  return (
    <div
      className="bg-promo text-white"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="shell grid h-[var(--banner-h)] place-items-center overflow-hidden">
        {messages.map((message, i) => (
          <p
            key={i}
            aria-hidden={i !== index}
            className={cn(
              "col-start-1 row-start-1 line-clamp-2 text-center text-[0.75rem] font-bold leading-tight tracking-wide transition-opacity duration-500 md:line-clamp-1 md:text-[0.8125rem]",
              i === index ? "opacity-100" : "opacity-0",
            )}
          >
            {message}
          </p>
        ))}
      </div>
    </div>
  );
}
