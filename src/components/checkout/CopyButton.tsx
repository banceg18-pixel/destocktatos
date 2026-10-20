"use client";

import { useState } from "react";
import { IconCheck } from "@/components/ui/Icons";
import { cn } from "@/lib/client/cn";

/** Copie une valeur (IBAN, montant, communication) pour la coller dans l'application bancaire. */
export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Navigateurs sans presse-papiers asynchrone : sélection temporaire.
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      document.body.removeChild(area);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copier ${label}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[0.68rem] font-medium uppercase tracking-[0.08em] transition-colors",
        copied ? "border-success bg-success text-paper" : "border-line text-ink hover:border-ink",
        className,
      )}
    >
      {copied ? (
        <>
          <IconCheck size={12} /> Copié
        </>
      ) : (
        "Copier"
      )}
      <span className="sr-only" role="status">
        {copied ? `${label} copié` : ""}
      </span>
    </button>
  );
}
