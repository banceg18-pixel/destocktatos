import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/client/cn";
import { discountPercent, formatEuros } from "@/lib/money";

/** Étiquette courte en majuscules, éventuellement entourée (pastille). */
export function Tag({ children, tone = "line", className }: { children: ReactNode; tone?: "line" | "ink" | "paper" | "glass" | "mist"; className?: string }) {
  return (
    <span
      className={cn(
        "t-eyebrow inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-full px-3 !text-[0.68rem]",
        tone === "line" && "border border-line text-ink",
        tone === "ink" && "bg-ink text-paper",
        tone === "paper" && "bg-paper text-ink",
        tone === "glass" && "border border-white/40 bg-white/10 text-paper backdrop-blur-md",
        tone === "mist" && "bg-mist text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** En-tête de section : sur-titre + titre + texte d'appui optionnel, et action à droite. */
export function SectionHeading({
  title,
  intro,
  action,
  align = "left",
  as: H = "h2",
  className,
}: {
  title: ReactNode;
  intro?: ReactNode;
  action?: ReactNode;
  align?: "left" | "center";
  as?: "h1" | "h2";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-6 md:flex-row md:items-end md:justify-between", align === "center" && "items-center text-center md:flex-col md:items-center", className)}>
      <div className={cn("max-w-3xl", align === "center" && "mx-auto")}>
        <H className="t-h2">{title}</H>
        {intro && <p className="t-lead mt-5 max-w-xl text-graphite">{intro}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Prix courant, prix conseillé fabricant barré et réduction. Format unique « 1 299,00 € ». */
export function Price({
  prix,
  promotionPrix,
  size = "md",
  tone = "ink",
  showBadge = false,
  className,
}: {
  prix: number;
  promotionPrix?: number | null;
  size?: "sm" | "md" | "lg" | "xl";
  tone?: "ink" | "paper";
  showBadge?: boolean;
  className?: string;
}) {
  const pct = discountPercent(prix, promotionPrix);
  const current = pct ? promotionPrix! : prix;
  return (
    <p className={cn("t-price flex flex-wrap items-baseline gap-x-2.5 gap-y-1", className)}>
      <span
        className={cn(
          "font-medium",
          size === "sm" && "text-sm",
          size === "md" && "text-base",
          size === "lg" && "text-xl",
          size === "xl" && "font-display text-[clamp(1.75rem,2.6vw,2.4rem)] tracking-tight [font-stretch:110%]",
          tone === "paper" ? "text-paper" : "text-ink",
        )}
      >
        {formatEuros(current)}
      </span>
      {pct > 0 && (
        <>
          {/* Le prix barré est le prix conseillé par le fabricant (jamais un ancien prix du magasin). */}
          <span className={cn(size === "xl" ? "text-base" : "text-xs", tone === "paper" ? "text-white/60" : "text-graphite")}>
            Prix conseillé fabricant <s>{formatEuros(prix)}</s>
          </span>
          {showBadge && (
            <span className={cn("t-spec rounded-xs px-1.5 py-0.5", tone === "paper" ? "bg-paper text-ink" : "bg-ink text-paper")}>-{pct} %</span>
          )}
        </>
      )}
    </p>
  );
}

/** Étoiles de notation (affichage). */
export function Stars({ value, size = 14, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={label ?? `Note ${value.toFixed(1).replace(".", ",")} sur 5`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
            <defs>
              <linearGradient id={`star-${i}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="currentColor" />
                <stop offset={`${fill * 100}%`} stopColor="currentColor" stopOpacity="0.18" />
              </linearGradient>
            </defs>
            <path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill={`url(#star-${i}-${fill})`} />
          </svg>
        );
      })}
    </span>
  );
}

/** Pastille de disponibilité (couleur fonctionnelle, texte toujours présent). */
export function StockBadge({ stock, className }: { stock: number; className?: string }) {
  const state = stock <= 0 ? "out" : stock <= 3 ? "low" : "in";
  return (
    <span className={cn("t-spec inline-flex items-center gap-2", className)}>
      <span
        className={cn("size-2 rounded-full", state === "in" && "bg-success", state === "low" && "bg-warning", state === "out" && "bg-danger")}
        aria-hidden="true"
      />
      {state === "out" ? "Rupture de stock" : state === "low" ? `Plus que ${stock} en stock` : "En stock"}
    </span>
  );
}

/** Accordéon accessible sans JavaScript (<details>), ouverture animée. */
export function Accordion({ title, children, defaultOpen, className, name }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean; className?: string; name?: string }) {
  return (
    <details className={cn("accordion group border-b border-line", className)} open={defaultOpen} name={name}>
      <summary className="flex items-center justify-between gap-6 py-5 text-left text-[0.95rem] font-medium">
        <span>{title}</span>
        <svg className="accordion-icon shrink-0" width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
          <path d="M7 0v14M0 7h14" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      </summary>
      <div className="pb-6 text-[0.95rem] leading-relaxed text-ink-soft">{children}</div>
    </details>
  );
}

/** Flèche fine utilisée dans les liens et boutons. */
export function Arrow({ className, direction = "right" }: { className?: string; direction?: "right" | "left" | "up-right" | "down" }) {
  const rotate = { right: 0, left: 180, "up-right": -45, down: 90 }[direction];
  return (
    <svg className={cn("shrink-0", className)} width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" style={{ transform: `rotate(${rotate}deg)` }}>
      <path d="M1 7h11.5M8 2.5 12.5 7 8 11.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  );
}

/* ----------------------------------------------------------------------------------------
 * Champs de formulaire
 * -------------------------------------------------------------------------------------- */
export const fieldClasses = (invalid?: boolean) =>
  cn(
    "w-full rounded-sm border bg-paper px-4 text-[0.95rem] text-ink placeholder:text-graphite-light",
    "transition-colors duration-200 focus:border-ink focus:outline-none focus-visible:outline-none",
    invalid ? "border-danger focus:border-danger" : "border-line hover:border-graphite-light",
  );

export function Field({
  label,
  hint,
  error,
  htmlFor,
  required,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {required && (
          <span className="text-graphite" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${htmlFor}-error`} className="flex items-start gap-1.5 text-sm text-danger" role="alert">
          <svg className="mt-[3px] shrink-0" width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="M8 4.5v4.2M8 10.9v.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="text-sm text-graphite">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Lien d'accessibilité entre un champ en erreur et son message (rendu par <Field>). */
const describedBy = (invalid: boolean | undefined, id: string | undefined, own: string | undefined) => (invalid && id ? `${id}-error` : own);

export function Input({ invalid, className, "aria-describedby": own, ...props }: { invalid?: boolean } & ComponentPropsWithoutRef<"input">) {
  return <input aria-invalid={invalid || undefined} aria-describedby={describedBy(invalid, props.id, own)} className={cn(fieldClasses(invalid), "h-12", className)} {...props} />;
}

export function Textarea({ invalid, className, "aria-describedby": own, ...props }: { invalid?: boolean } & ComponentPropsWithoutRef<"textarea">) {
  return <textarea aria-invalid={invalid || undefined} aria-describedby={describedBy(invalid, props.id, own)} className={cn(fieldClasses(invalid), "min-h-36 py-3 leading-relaxed", className)} {...props} />;
}

export function NativeSelect({ invalid, className, children, "aria-describedby": own, ...props }: { invalid?: boolean } & ComponentPropsWithoutRef<"select">) {
  return (
    <div className="relative">
      <select aria-invalid={invalid || undefined} aria-describedby={describedBy(invalid, props.id, own)} className={cn(fieldClasses(invalid), "h-12 cursor-pointer appearance-none pr-10", className)} {...props}>
        {children}
      </select>
      <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    </div>
  );
}

export function Checkbox({ label, className, ...props }: { label: ReactNode } & ComponentPropsWithoutRef<"input">) {
  return (
    <label className={cn("group flex cursor-pointer items-start gap-3 text-sm text-ink-soft", className)}>
      <input type="checkbox" className="peer sr-only" {...props} />
      <span
        className="mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-xs border border-graphite-light bg-paper transition-colors peer-checked:border-ink peer-checked:bg-ink peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink [&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100"
        aria-hidden="true"
      >
        <svg width="11" height="11" viewBox="0 0 12 12">
          <path d="M2 6.2 4.8 9 10 3" fill="none" stroke="white" strokeWidth="1.6" />
        </svg>
      </span>
      <span className="leading-snug">{label}</span>
    </label>
  );
}

/** Indicateur de chargement discret. */
export function Spinner({ className }: { className?: string }) {
  return <span className={cn("inline-block size-4 animate-[spin_0.8s_linear_infinite] rounded-full border-[1.5px] border-current border-r-transparent", className)} aria-hidden="true" />;
}
