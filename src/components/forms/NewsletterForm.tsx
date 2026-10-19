"use client";

import { useId, useState } from "react";
import { subscribeNewsletter } from "@/services/forms";
import { cn } from "@/lib/client/cn";
import { Arrow, Spinner } from "@/components/ui/Primitives";

/**
 * Inscription à la newsletter (pied de page sur fond encre, page Promotions sur fond clair).
 * Le retour (succès, déjà inscrit, erreur) s'affiche sous le champ.
 */
export function NewsletterForm({ tone = "paper", label = "Votre adresse email", compact = false, className }: { tone?: "paper" | "ink"; label?: string; compact?: boolean; className?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<{ kind: "idle" | "loading" | "ok" | "error"; text?: string }>({ kind: "idle" });
  const dark = tone === "ink";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setState({ kind: "error", text: "Saisissez une adresse email valide, par exemple nom@exemple.fr." });
      return;
    }
    setState({ kind: "loading" });
    const res = await subscribeNewsletter(email.trim());
    if (res.ok) {
      setEmail("");
      setState({ kind: "ok", text: "Inscription réussie : vous recevrez nos prochaines offres." });
    } else {
      setState({ kind: "error", text: res.status === 409 ? "Cette adresse est déjà inscrite." : res.error || "L'inscription n'a pas abouti. Réessayez." });
    }
  };

  return (
    <form onSubmit={submit} noValidate className={cn("flex min-w-0 flex-col justify-end", className)}>
      <label htmlFor={id} className={cn("t-eyebrow", compact ? "mb-2" : "mb-4", dark ? "text-white/50" : "text-graphite")}>
        {label}
      </label>
      <div className={cn("flex items-center border-b transition-colors", dark ? "border-white/30 focus-within:border-paper" : "border-graphite-light focus-within:border-ink")}>
        <input
          id={id}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nom@exemple.fr"
          aria-invalid={state.kind === "error" || undefined}
          aria-describedby={`${id}-status`}
          className={cn("min-w-0 flex-1 bg-transparent focus:outline-none", compact ? "py-3 text-base" : "py-4 text-lg", dark ? "text-paper placeholder:text-white/35" : "text-ink placeholder:text-graphite-light")}
        />
        <button type="submit" disabled={state.kind === "loading"} className="t-eyebrow inline-flex shrink-0 items-center gap-3 py-3 pl-4 transition-opacity hover:opacity-70 disabled:opacity-50">
          {state.kind === "loading" ? <Spinner /> : "S'inscrire"}
          <Arrow />
        </button>
      </div>
      <p id={`${id}-status`} role="status" className={cn("min-h-5 text-sm", compact ? "mt-1.5" : "mt-3", state.kind === "error" ? (dark ? "text-[#ff9b8f]" : "text-danger") : dark ? "text-white/65" : "text-graphite")}>
        {state.text ?? ""}
      </p>
    </form>
  );
}

export default NewsletterForm;
