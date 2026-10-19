"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { ConnexionForm } from "@/components/auth/ConnexionForm";
import { InscriptionForm } from "@/components/auth/InscriptionForm";
import { cn } from "@/lib/client/cn";

/**
 * Dernière étape avant le paiement : le visiteur a tout préparé sans compte (articles, adresse,
 * livraison) ; il crée son compte ou se connecte ici, sans quitter le panier ni rien perdre de sa
 * saisie, puis `onDone` lance la commande.
 */
export function CheckoutAccount({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  return (
    <Drawer open={open} onClose={onClose} title="Dernière étape : votre compte" closeLabel="Revenir au panier" className="sm:max-w-[480px]">
      {open && (
        <div className="flex flex-col gap-6 px-6 pb-10 pt-2">
          <p className="text-sm text-graphite">
            Votre commande est prête. Créez votre compte pour suivre votre livraison et retrouver vos factures, puis passez au paiement. Votre panier et votre
            adresse sont conservés.
          </p>
          <div role="tablist" aria-label="Compte" className="grid grid-cols-2 border border-line p-1 text-sm">
            {(
              [
                ["signup", "Créer mon compte"],
                ["login", "J'ai déjà un compte"],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={cn("px-3 py-2.5 font-medium transition-colors", mode === m ? "bg-ink text-paper" : "text-graphite hover:text-ink")}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {mode === "signup" ? <InscriptionForm googleEnabled={false} onSuccess={onDone} /> : <ConnexionForm googleEnabled={false} onSuccess={onDone} />}
          </div>
        </div>
      )}
    </Drawer>
  );
}
