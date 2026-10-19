"use client";

import { useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { cn } from "@/lib/client/cn";

/** Champ mot de passe avec bouton afficher/masquer. */
export function InputPassword({
  name,
  id,
  className,
  onChange,
  required = true,
  placeholder = "",
  autoComplete,
  value,
  invalid,
  onBlur,
  "data-cy": dataCy,
}: {
  name: string;
  id: string;
  className?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  /** Valeur contrôlée (facultative : champ libre par défaut). */
  value?: string;
  /** Champ en erreur : bordure rouge et lien vers le message affiché par <Field>. */
  invalid?: boolean;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  "data-cy"?: string;
}) {
  const [type, setType] = useState<"password" | "text">("password");
  const toggle = () => setType((t) => (t === "password" ? "text" : "password"));
  // Icône d'origine rendue utilisable au clavier (Tab puis Entrée / Espace).
  const toggleProps = (onToggle: () => void, ariaLabel: string) => ({
    onClick: onToggle,
    role: "button",
    "aria-label": ariaLabel,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
  });
  const label = type === "password" ? "Afficher le mot de passe" : "Masquer le mot de passe";
  return (
    <div className="relative">
      <input
        type={type}
        name={name}
        id={id}
        data-cy={dataCy}
        onChange={onChange}
        onBlur={onBlur}
        value={value}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cn("p-3 w-full rounded-md pr-12", className, invalid && "!border-danger")}
        placeholder={placeholder}
      />
      {type === "password" ? (
        <FaEye className="absolute right-4 top-4 text-lg opacity-50" {...toggleProps(toggle, label)} />
      ) : (
        <FaEyeSlash className="absolute right-4 top-4 text-lg opacity-50" {...toggleProps(toggle, label)} />
      )}
    </div>
  );
}

export default InputPassword;
