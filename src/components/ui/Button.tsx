import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/client/cn";

type Variant = "solid" | "outline" | "light" | "glass" | "ghost";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  solid: "bg-ink text-paper hover:bg-ink-soft",
  outline: "border border-ink text-ink hover:bg-ink hover:text-paper",
  light: "bg-paper text-ink hover:bg-mist",
  glass: "border border-white/40 bg-white/10 text-paper backdrop-blur-md hover:bg-white hover:text-ink",
  ghost: "text-ink hover:bg-mist",
};
const SIZES: Record<Size, string> = {
  sm: "min-h-9 px-4 py-2 text-[0.72rem]",
  md: "min-h-12 px-6 py-3 text-xs",
  lg: "min-h-14 px-6 py-3.5 text-[0.8rem] sm:px-8",
};

export function buttonClasses({ variant = "solid", size = "md", block = false, className }: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(
    // Libellé sur une ligne tant qu'il tient ; sur très petit écran il passe à la ligne plutôt que de déborder.
    "inline-flex max-w-full items-center justify-center gap-2.5 rounded-sm text-center font-medium uppercase tracking-[0.09em] select-none [&>svg]:shrink-0",
    "transition-colors duration-300 disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    VARIANTS[variant],
    SIZES[size],
    block && "w-full",
    className,
  );
}

/** Libellé doublé qui « roule » au survol (voir `.roll` dans globals.css). */
export function Roll({ children }: { children: ReactNode }) {
  return (
    <span className="roll">
      <span>{children}</span>
      <span aria-hidden="true">{children}</span>
    </span>
  );
}

interface CommonProps {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  icon?: ReactNode;
  /** Désactive l'effet de roulement du libellé (contenus longs, états de chargement). */
  plain?: boolean;
}

export function Button({
  variant,
  size,
  block,
  icon,
  plain,
  className,
  children,
  type = "button",
  ...props
}: CommonProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button type={type} className={buttonClasses({ variant, size, block, className })} {...props}>
      {plain ? children : <Roll>{children}</Roll>}
      {icon}
    </button>
  );
}

export function ButtonLink({
  variant,
  size,
  block,
  icon,
  plain,
  className,
  children,
  href,
  ...props
}: CommonProps & Omit<ComponentPropsWithoutRef<typeof Link>, "href"> & { href: string }) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })} {...props}>
      {plain ? children : <Roll>{children}</Roll>}
      {icon}
    </Link>
  );
}

/** Bouton rond à icône (en-tête, carrousels). `label` est obligatoire pour l'accessibilité. */
export function IconButton({
  label,
  tone = "light",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: { label: string; tone?: "light" | "dark" | "glass"; size?: "sm" | "md" } & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-full transition-colors duration-300 disabled:opacity-30 disabled:pointer-events-none",
        size === "md" ? "size-10" : "size-8",
        tone === "light" && "border border-line bg-paper text-ink hover:border-ink",
        tone === "dark" && "border border-white/25 text-paper hover:bg-paper hover:text-ink",
        tone === "glass" && "bg-white/15 text-paper backdrop-blur-md hover:bg-paper hover:text-ink",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
