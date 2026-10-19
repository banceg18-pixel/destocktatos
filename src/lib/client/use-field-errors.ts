"use client";

import { useCallback, useRef, useState } from "react";

type Validators<K extends string> = Record<K, (value: string) => string | null>;

/**
 * Erreurs par champ :
 * - un champ est vérifié quand on le quitte (pas pendant la première saisie) ;
 * - une fois l'erreur affichée, elle se met à jour à chaque frappe et disparaît dès que c'est bon ;
 * - à l'envoi, tous les champs sont vérifiés et le premier champ en erreur reçoit le focus.
 * `ids` associe chaque clé à l'identifiant HTML du champ (par défaut, la clé elle-même).
 */
export function useFieldErrors<K extends string>(ids: Partial<Record<K, string>> = {}) {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({});
  const shown = useRef(new Set<K>());

  const set = useCallback((key: K, message: string | null) => {
    setErrors((e) => (e[key] === (message ?? undefined) ? e : { ...e, [key]: message ?? undefined }));
  }, []);

  /** À la sortie d'un champ. */
  const onBlur = useCallback(
    (key: K, value: string, validate: (v: string) => string | null) => {
      shown.current.add(key);
      set(key, validate(value));
    },
    [set],
  );

  /** Pendant la saisie : seulement si le champ a déjà été vérifié. */
  const onChange = useCallback(
    (key: K, value: string, validate: (v: string) => string | null) => {
      if (shown.current.has(key)) set(key, validate(value));
    },
    [set],
  );

  /** À l'envoi : vérifie tout, focalise le premier champ fautif ; renvoie true si tout est correct. */
  const validateAll = useCallback(
    (values: Record<K, string>, validators: Validators<K>) => {
      const next: Partial<Record<K, string>> = {};
      let first: K | null = null;
      for (const key of Object.keys(validators) as K[]) {
        shown.current.add(key);
        const msg = validators[key](values[key] ?? "");
        if (msg) {
          next[key] = msg;
          first ??= key;
        }
      }
      setErrors(next);
      if (first) {
        const el = document.getElementById(ids[first] ?? first);
        el?.focus();
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
      }
      return !first;
    },
    [ids],
  );

  /** Erreurs renvoyées par le serveur (même affichage que les erreurs de saisie). */
  const setServerErrors = useCallback((map: Partial<Record<K, string>>) => {
    for (const k of Object.keys(map) as K[]) shown.current.add(k);
    setErrors((e) => ({ ...e, ...map }));
  }, []);

  const reset = useCallback(() => {
    shown.current.clear();
    setErrors({});
  }, []);

  return { errors, onBlur, onChange, validateAll, setServerErrors, reset };
}

type FieldErrors<K extends string> = ReturnType<typeof useFieldErrors<K>>;
type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/**
 * Propriétés d'un champ (<Input>, <Textarea>, <NativeSelect>) reliées à sa règle :
 * `<Input id="email" {...bindField(f, "email", form.email, (v) => setForm(...), rules.email)} />`.
 */
export function bindField<K extends string>(f: FieldErrors<K>, key: K, value: string, set: (value: string) => void, rule: (value: string) => string | null) {
  return {
    value,
    invalid: !!f.errors[key],
    onChange: (e: React.ChangeEvent<Control>) => {
      set(e.target.value);
      f.onChange(key, e.target.value, rule);
    },
    onBlur: (e: React.FocusEvent<Control>) => f.onBlur(key, e.target.value, rule),
  };
}
