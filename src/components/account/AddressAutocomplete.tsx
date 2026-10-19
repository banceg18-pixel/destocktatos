"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { addressSuggestions } from "@/services/account";
import { cn } from "@/lib/client/cn";
import { fieldClasses, Spinner } from "@/components/ui/Primitives";
import { IconPin } from "@/components/ui/Icons";

interface Suggestion {
  id?: string;
  label: string;
  address: string;
  postalCode: string;
  city: string;
}

/** Champ d'adresse avec suggestions (Base Adresse Nationale via /api/addresses/suggestions). */
export function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  placeholder = "Commencez à taper votre adresse...",
  className = "",
  required = false,
  id = "address",
  invalid = false,
  onBlur,
}: {
  value: string;
  onChange: (v: string) => void;
  onAddressSelect: (a: { address: string; postalCode: string; city: string }) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
  invalid?: boolean;
  /** Sortie du champ (après la fermeture de la liste de suggestions). */
  onBlur?: () => void;
}) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const timer = useRef<number | undefined>(undefined);

  const load = useCallback(async (q: string) => {
    if (q.length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    const res = await addressSuggestions(q);
    if (res.ok) {
      setSuggestions(res.data.suggestions || []);
      setOpen(true);
      setActive(-1);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (timer.current !== undefined) clearTimeout(timer.current);
    timer.current = window.setTimeout(() => load(value), 300);
    return () => {
      if (timer.current !== undefined) clearTimeout(timer.current);
    };
  }, [value, load]);

  const choose = (s: Suggestion) => {
    onChange(s.label);
    onAddressSelect({ address: s.address, postalCode: s.postalCode, city: s.city });
    setOpen(false);
    setActive(-1);
  };

  return (
    <div className="relative">
      <div className="relative">
        <input
          id={id}
          type="text"
          value={value}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          aria-autocomplete="list"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => (i < suggestions.length - 1 ? i + 1 : i));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (i > 0 ? i - 1 : -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (active >= 0 && active < suggestions.length) choose(suggestions[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
              setActive(-1);
            }
          }}
          onBlur={() =>
            setTimeout(() => {
              setOpen(false);
              setActive(-1);
              onBlur?.();
            }, 200)
          }
          onFocus={() => value.length >= 3 && suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          className={cn(fieldClasses(invalid), "h-12 pr-11", className)}
          required={required}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {loading ? <Spinner className="text-graphite" /> : <IconPin size={16} className="text-graphite" />}
        </div>
      </div>
      {open && suggestions.length > 0 && (
        <div role="listbox" id={listId} className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-sm border border-line bg-paper shadow-xl">
          {suggestions.map((s, i) => (
            <div
              role="option"
              id={`${listId}-${i}`}
              aria-selected={i === active}
              onClick={() => choose(s)}
              className={cn("cursor-pointer border-b border-line px-4 py-3 transition-colors last:border-b-0", i === active ? "bg-mist" : "hover:bg-mist")}
              key={s.id ?? `${s.label}-${i}`}
            >
              <div className="flex items-start">
                <IconPin size={16} className="mr-3 mt-0.5 shrink-0 text-graphite" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.label}</div>
                  <div className="t-spec mt-1 text-graphite">
                    {s.postalCode} {s.city}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AddressAutocomplete;
