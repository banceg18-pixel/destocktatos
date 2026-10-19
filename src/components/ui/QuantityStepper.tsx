"use client";

import { cn } from "@/lib/client/cn";
import { IconMinus, IconPlus } from "./Icons";

/** Sélecteur de quantité (− n +), borné par `max` (stock disponible). */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  size = "md",
  label = "Quantité",
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  size?: "sm" | "md";
  label?: string;
  className?: string;
}) {
  const btn = cn("flex items-center justify-center transition-colors hover:bg-mist disabled:opacity-30 disabled:hover:bg-transparent", size === "sm" ? "size-8" : "size-12");
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-sm border border-line", className)}>
      <button type="button" className={btn} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Diminuer la quantité">
        <IconMinus size={size === "sm" ? 14 : 16} />
      </button>
      <span className={cn("t-price text-center text-sm", size === "sm" ? "w-7" : "w-10")} aria-live="polite">
        {value}
      </span>
      <button type="button" className={btn} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Augmenter la quantité">
        <IconPlus size={size === "sm" ? 14 : 16} />
      </button>
    </div>
  );
}
