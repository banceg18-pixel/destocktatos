"use client";

import { useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Arrow, Field, Input } from "@/components/ui/Primitives";
import { ConnexionForm } from "@/components/auth/ConnexionForm";
import { rules } from "@/lib/client/form-rules";
import { useFieldErrors } from "@/lib/client/use-field-errors";
import { cn } from "@/lib/client/cn";

/**
 * Dernière étape avant le règlement : le visiteur a tout préparé (articles, adresse, livraison). Il
 * commande sans compte avec son seul email, ou se connecte s'il a déjà un compte. Le compte se crée
 * après la commande, depuis le lien reçu par email avec la facture : il y retrouvera ses factures.
 */
export function CheckoutAccount({ open, onClose, onDone, onGuest }: { open: boolean; onClose: () => void; onDone: () => void; onGuest: (email: string) => void }) {
  const [mode, setMode] = useState<"guest" | "login">("guest");
  const [email, setEmail] = useState("");
  const f = useFieldErrors<"email">({ email: "guest-email" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.validateAll({ email }, { email: rules.email })) return;
    onGuest(email.trim().toLowerCase());
  };

  return (
    <Drawer open={open} onClose={onClose} title="Dernière étape : vos coordonnées" closeLabel="Revenir au panier" className="sm:max-w-[480px]">
      {open && (
        <div className="flex flex-col gap-6 px-6 pb-10 pt-2">
          <div role="tablist" aria-label="Commander" className="grid grid-cols-2 border border-line p-1 text-sm">
            {(
              [
                ["guest", "Commander sans compte"],
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
            {mode === "guest" ? (
              <form onSubmit={submit} noValidate className="flex flex-col gap-5">
                <p className="text-sm text-graphite">
                  Indiquez votre email : vous y recevrez la confirmation et la facture avec les informations de paiement. Vous pourrez ensuite créer votre
                  compte en un clic pour retrouver vos factures.
                </p>
                <Field label="Email" htmlFor="guest-email" error={f.errors.email}>
                  <Input
                    id="guest-email"
                    type="email"
                    value={email}
                    invalid={!!f.errors.email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      f.onChange("email", e.target.value, rules.email);
                    }}
                    onBlur={(e) => f.onBlur("email", e.target.value, rules.email)}
                    autoComplete="email"
                    placeholder="nom@exemple.fr"
                    data-testid="guest-email"
                  />
                </Field>
                <Button type="submit" size="lg" block icon={<Arrow />} data-testid="guest-continue">
                  Continuer vers le paiement
                </Button>
              </form>
            ) : (
              <ConnexionForm googleEnabled={false} onSuccess={onDone} />
            )}
          </div>
        </div>
      )}
    </Drawer>
  );
}
