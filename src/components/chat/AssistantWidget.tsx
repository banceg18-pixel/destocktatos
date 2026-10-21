"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { STARTERS } from "@/lib/chat/starters";
import { FR_PHONE_HINT, isFrPhone } from "@/lib/phone";
import { cn } from "@/lib/client/cn";
import { IconChat, IconCheck, IconClose, IconSend } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Primitives";

type AssistantLink = { label: string; href: string };
interface Msg {
  id: string;
  from: "client" | "assistant";
  text: string;
  links?: AssistantLink[];
  suggestions?: string[];
  /** Formulaire « être recontacté » : ouvert, envoyé, ou remplacé par un plus récent. */
  form?: "open" | "sent" | "closed";
  /** Question reprise dans le formulaire. */
  question?: string;
}
interface Reply {
  kind: "answer" | "smalltalk" | "callback" | "unknown";
  text: string;
  links?: AssistantLink[];
  suggestions?: string[];
  contactForm?: boolean;
}

const STORAGE_KEY = "tatos-assistant";
/** Délai minimal avant la réponse : l'indicateur « en train d'écrire » reste lisible. */
const TYPING_MS = 450;
const uid = () => Math.random().toString(36).slice(2, 10);

function load(): Msg[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Msg[]).slice(-60) : [];
  } catch {
    return [];
  }
}
function save(msgs: Msg[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(msgs.slice(-60)));
  } catch {
    /* navigation privée : la conversation n'est simplement pas gardée */
  }
}

/**
 * Assistant du site : bulle en bas à droite, ouverte sur un panneau de questions-réponses. Il répond
 * aux questions fréquentes ; sans réponse, il propose au client de laisser ses coordonnées pour être
 * recontacté (Boutique → Messages dans WordPress). La conversation reste dans l'onglet du visiteur.
 */
export function AssistantWidget({ botName, welcome }: { botName: string; welcome: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  // Accueil : la bulle apparaît dès le premier défilement (elle masquerait les flèches du carrousel).
  const [scrolled, setScrolled] = useState(false);
  const titleId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => setMsgs(load()), []);

  useEffect(() => {
    if (pathname !== "/") return;
    const onScroll = () => setScrolled(window.scrollY > 120);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [pathname]);
  useEffect(() => save(msgs), [msgs]);

  // Premier affichage : message d'accueil et questions fréquentes.
  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{ id: uid(), from: "assistant", text: welcome, suggestions: STARTERS }]);
  }, [open, msgs.length, welcome]);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy, open]);

  const ask = useCallback(
    async (question: string) => {
      const q = question.trim().slice(0, 500);
      if (!q || busy) return;
      setInput("");
      setMsgs((m) => [...m, { id: uid(), from: "client", text: q }]);
      setBusy(true);
      const started = Date.now();
      let reply: Reply;
      try {
        const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) });
        const body = await res.json().catch(() => ({}));
        reply = res.ok ? (body as Reply) : { kind: "unknown", text: (body as { error?: string }).error || "Je n'arrive pas à répondre pour le moment. Réessayez dans un instant." };
      } catch {
        reply = { kind: "unknown", text: "Connexion impossible pour le moment. Vérifiez votre réseau et réessayez." };
      }
      await new Promise((r) => setTimeout(r, Math.max(0, TYPING_MS - (Date.now() - started))));
      setMsgs((m) => [
        // Un seul formulaire ouvert à la fois : le plus récent.
        ...m.map((x) => (reply.contactForm && x.form === "open" ? { ...x, form: "closed" as const } : x)),
        {
          id: uid(),
          from: "assistant",
          text: reply.text,
          links: reply.links,
          suggestions: reply.suggestions,
          ...(reply.contactForm ? { form: "open" as const, question: reply.kind === "callback" ? "" : q } : {}),
        },
      ]);
      setBusy(false);
    },
    [busy],
  );

  const sent = (id: string, name: string, by: string) =>
    setMsgs((m) => [
      ...m.map((x) => (x.id === id ? { ...x, form: "sent" as const } : x)),
      { id: uid(), from: "assistant", text: `Merci ${name} ! Votre demande est bien transmise : notre équipe vous recontacte rapidement ${by}.` },
    ]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void ask(input);
    }
  };

  const lastAssistant = [...msgs].reverse().find((m) => m.from === "assistant")?.id;
  // Fiche produit sur mobile : la barre d'achat occupe le bas de l'écran.
  const productPage = /^\/boutique\/[^/]+$/.test(pathname);

  return (
    <>
      {!open && (pathname !== "/" || scrolled) && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-label={`Une question ? Discuter avec ${botName}`}
          data-testid="assistant-open"
          className={cn(
            "fixed right-4 z-[230] flex items-center gap-2.5 rounded-full bg-ink p-4 text-paper shadow-[0_10px_30px_rgba(0,0,0,0.25)] transition-transform duration-300 hover:-translate-y-0.5 sm:right-5 sm:bottom-5 sm:py-3.5 sm:pr-5 sm:pl-4",
            productPage ? "bottom-24 lg:bottom-5" : "bottom-4",
          )}
        >
          <IconChat size={22} />
          <span className="hidden text-sm font-medium sm:inline">Une question ?</span>
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          data-testid="assistant-panel"
          className="fixed inset-0 z-[230] flex animate-[slide-up_0.45s_var(--ease-out-expo)_both] flex-col overflow-hidden bg-paper shadow-2xl sm:inset-auto sm:right-5 sm:bottom-5 sm:h-[min(620px,calc(100dvh-2.5rem))] sm:w-[390px] sm:rounded-lg sm:border sm:border-line"
        >
          <header className="on-dark flex items-center gap-3 bg-ink px-4 py-3.5 text-paper">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-promo">
              <IconChat size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p id={titleId} className="truncate font-medium">
                {botName}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-white/70">
                <span className="size-1.5 rounded-full bg-[#8fd6a8]" aria-hidden="true" />
                Répond instantanément
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Fermer l'assistant" className="rounded-full p-2 text-white/70 transition-colors hover:text-paper">
              <IconClose size={20} />
            </button>
          </header>

          <div ref={listRef} className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain bg-mist/50 px-4 py-5" aria-live="polite" data-testid="assistant-messages">
            {msgs.map((m) => (
              <div key={m.id} className={cn("flex flex-col gap-2", m.from === "client" ? "items-end" : "items-start")}>
                <div
                  className={cn(
                    "max-w-[88%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-line",
                    m.from === "client" ? "rounded-2xl rounded-br-sm bg-ink text-paper" : "rounded-2xl rounded-bl-sm border border-line bg-paper text-ink",
                  )}
                  data-from={m.from}
                >
                  {m.text}
                </div>
                {m.links?.length ? (
                  <div className="flex max-w-[88%] flex-wrap gap-2">
                    {m.links.map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        onClick={() => window.matchMedia("(max-width: 639px)").matches && setOpen(false)}
                        className="rounded-full border border-ink px-3 py-1.5 text-xs font-medium transition-colors hover:bg-ink hover:text-paper"
                      >
                        {l.label} →
                      </Link>
                    ))}
                  </div>
                ) : null}
                {m.form === "open" && <CallbackForm question={m.question ?? ""} transcript={msgs} page={pathname} onSent={(name, by) => sent(m.id, name, by)} />}
                {m.id === lastAssistant && !busy && m.suggestions?.length ? (
                  <div className="flex max-w-full flex-wrap gap-2" data-testid="assistant-suggestions">
                    {m.suggestions.map((s) => (
                      <button key={s} type="button" onClick={() => void ask(s)} className="rounded-full bg-paper px-3 py-1.5 text-left text-xs text-ink ring-1 ring-line transition-colors hover:bg-ink hover:text-paper hover:ring-ink">
                        {s}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
            {busy && (
              <div className="flex items-center gap-1 self-start rounded-2xl rounded-bl-sm border border-line bg-paper px-4 py-3.5" aria-label="L'assistant écrit">
                {[0, 150, 300].map((d) => (
                  <span key={d} className="size-1.5 animate-bounce rounded-full bg-graphite" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void ask(input);
            }}
            className="border-t border-line bg-paper px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
          >
            <div className="flex items-end gap-2">
              <label htmlFor="assistant-input" className="sr-only">
                Votre question
              </label>
              <textarea
                id="assistant-input"
                ref={inputRef}
                rows={1}
                value={input}
                maxLength={500}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                }}
                onKeyDown={onKeyDown}
                placeholder="Écrivez votre question…"
                className="max-h-28 min-h-11 flex-1 resize-none rounded-md border border-line bg-paper px-3 py-2.5 text-base outline-none transition-colors focus:border-ink sm:text-sm"
                data-testid="assistant-input"
              />
              <button
                type="submit"
                disabled={!input.trim() || busy}
                aria-label="Envoyer la question"
                className="flex size-11 shrink-0 items-center justify-center rounded-md bg-ink text-paper transition-opacity disabled:opacity-30"
                data-testid="assistant-send"
              >
                <IconSend size={19} />
              </button>
            </div>
            <p className="mt-2 text-center text-[0.68rem] text-graphite">Assistant automatique · vos questions ne sont pas enregistrées</p>
          </form>
        </div>
      )}
    </>
  );
}

/** Coordonnées du client, quand l'assistant n'a pas la réponse : l'équipe le recontacte. */
function CallbackForm({ question, transcript, page, onSent }: { question: string; transcript: Msg[]; page: string; onSent: (name: string, by: string) => void }) {
  const [f, setF] = useState({ name: "", phone: "", email: "", question });
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const id = useId();
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return setError("Indiquez votre nom.");
    if (!f.phone.trim() && !f.email.trim()) return setError("Indiquez votre téléphone ou votre email pour être recontacté.");
    if (f.phone.trim() && !isFrPhone(f.phone)) return setError(FR_PHONE_HINT);
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setError("Adresse email invalide.");
    if (!f.question.trim()) return setError("Indiquez votre question.");
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/assistant/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: f.name.trim(),
          phone: f.phone.trim(),
          email: f.email.trim(),
          question: f.question.trim(),
          transcript: transcript.filter((m) => m.text).slice(-12).map((m) => ({ from: m.from, text: m.text.slice(0, 2000) })),
          page,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Envoi impossible, réessayez.");
      onSent(f.name.trim().split(" ")[0], f.phone.trim() ? "par téléphone" : "par email");
    } catch (err) {
      setError((err as Error).message);
      setSending(false);
    }
  };

  // 16 px sur mobile : en dessous, l'iPhone zoome sur le champ touché.
  const field = "h-10 w-full rounded-md border border-line bg-paper px-3 text-base outline-none focus:border-ink sm:text-sm";
  return (
    <form onSubmit={submit} noValidate className="flex w-full max-w-[88%] flex-col gap-2.5 rounded-lg border border-line bg-paper p-3.5" data-testid="assistant-callback">
      <p className="text-xs font-medium tracking-[0.08em] text-graphite uppercase">Être recontacté</p>
      <label className="sr-only" htmlFor={`${id}-name`}>
        Nom
      </label>
      <input id={`${id}-name`} value={f.name} onChange={set("name")} autoComplete="name" placeholder="Prénom et nom *" className={field} data-testid="callback-name" />
      <label className="sr-only" htmlFor={`${id}-phone`}>
        Téléphone
      </label>
      <input id={`${id}-phone`} value={f.phone} onChange={set("phone")} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="Téléphone (06 12 34 56 78)" className={field} data-testid="callback-phone" />
      <label className="sr-only" htmlFor={`${id}-email`}>
        Email
      </label>
      <input id={`${id}-email`} value={f.email} onChange={set("email")} type="email" autoComplete="email" placeholder="Email" className={field} data-testid="callback-email" />
      <label className="sr-only" htmlFor={`${id}-q`}>
        Votre question
      </label>
      <textarea id={`${id}-q`} value={f.question} onChange={set("question")} rows={2} maxLength={2000} placeholder="Votre question *" className={cn(field, "h-auto min-h-16 py-2")} data-testid="callback-question" />
      <p className="text-[0.7rem] text-graphite">Téléphone ou email : au moins l&apos;un des deux.</p>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={sending} className="flex h-10 items-center justify-center gap-2 rounded-md bg-ink text-xs font-medium tracking-[0.09em] text-paper uppercase disabled:opacity-60" data-testid="callback-submit">
        {sending ? <Spinner /> : (
          <>
            <IconCheck size={15} /> Envoyer mes coordonnées
          </>
        )}
      </button>
    </form>
  );
}
