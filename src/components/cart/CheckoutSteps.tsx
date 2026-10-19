import { cn } from "@/lib/client/cn";

const STEPS = ["Panier", "Livraison", "Paiement", "Confirmation"] as const;

/** Étapes de la commande (ordre réel du parcours) ; l'étape courante est annoncée aux lecteurs d'écran. */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 | 3 }) {
  return (
    <nav aria-label="Étapes de la commande">
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === current ? "step" : undefined} className="flex items-center gap-3">
            {i > 0 && <span className={cn("h-px w-6 sm:w-10", i <= current ? "bg-ink" : "bg-line")} aria-hidden="true" />}
            <span className={cn("t-eyebrow flex items-center gap-2", i <= current ? "text-ink" : "text-graphite-light")}>
              <span className={cn("t-spec flex size-6 items-center justify-center rounded-full border !text-[0.65rem]", i < current ? "border-ink bg-ink text-paper" : i === current ? "border-ink" : "border-line")}>{i + 1}</span>
              <span className={cn(i !== current && "hidden sm:inline")}>{label}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
