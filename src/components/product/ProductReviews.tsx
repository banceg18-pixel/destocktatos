"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useError, useMessage } from "@/context/PopUpProvider";
import { canReview, deleteReview, fetchMe, fetchReviews, postReview, updateReview, type ReviewDTO } from "@/services/products";
import { cn } from "@/lib/client/cn";
import { Button } from "@/components/ui/Button";
import { Spinner, Stars, Textarea } from "@/components/ui/Primitives";

/** Choix de la note : vrais boutons radio (flèches du clavier), étoiles dessinées par-dessus. */
function StarPicker({ value, onChange, name }: { value: number; onChange: (n: number) => void; name: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-medium">Ihre Bewertung</legend>
      <div className="flex gap-1" onMouseLeave={() => setHover(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <label key={n} className="cursor-pointer" onMouseEnter={() => setHover(n)}>
            <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} className="peer sr-only" />
            <span className="sr-only">{n} von 5</span>
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true" className="rounded-xs transition-transform peer-focus-visible:outline-2 peer-focus-visible:outline-ink hover:scale-110">
              <path d="M12 2.6l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.4l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z" fill={n <= shown ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.2" />
            </svg>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewForm({
  initialNote = 0,
  initialComment = "",
  submitLabel,
  onSubmit,
  onCancel,
  id,
}: {
  initialNote?: number;
  initialComment?: string;
  submitLabel: string;
  onSubmit: (note: number, comment: string) => Promise<boolean>;
  onCancel?: () => void;
  id: string;
}) {
  const [note, setNote] = useState(initialNote);
  const [comment, setComment] = useState(initialComment);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!note) return setError("Bitte wählen Sie eine Bewertung von 1 bis 5 Sternen.");
        setError(null);
        setSending(true);
        const ok = await onSubmit(note, comment);
        setSending(false);
        if (ok && !onCancel) {
          setNote(0);
          setComment("");
        }
      }}
      className="flex flex-col gap-6 bg-mist p-6 lg:p-8"
    >
      <StarPicker value={note} onChange={setNote} name={`${id}-note`} />
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-comment`} className="text-sm font-medium">
          Ihr Kommentar <span className="font-normal text-graphite">(optional)</span>
        </label>
        <Textarea id={`${id}-comment`} value={comment} maxLength={2000} onChange={(e) => setComment(e.target.value)} placeholder="Lieferung, Lautstärke, Verbrauch, Verarbeitung…" />
        <p className="t-spec text-right text-graphite">{comment.length} / 2000</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={sending} plain={sending}>
          {sending ? <Spinner /> : submitLabel}
        </Button>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>
            Abbrechen
          </Button>
        )}
      </div>
    </form>
  );
}

/** Avis clients : synthèse et répartition des notes, dépôt réservé aux acheteurs, modification et suppression de son avis. */
export function ProductReviews({ produitId }: { produitId: string }) {
  const { data: session, status } = useSession();
  const [reviews, setReviews] = useState<ReviewDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [meId, setMeId] = useState<string | null>(null);
  const { setError } = useError();
  const { setMessage } = useMessage();
  const errRef = useRef(setError);
  const msgRef = useRef(setMessage);

  const reload = useCallback(async () => {
    const res = await fetchReviews(produitId);
    if (res.ok) setReviews(res.data);
    else errRef.current("Bewertungen konnten nicht geladen werden. Bitte aktualisieren Sie die Seite.");
  }, [produitId]);

  const recheck = useCallback(async () => {
    const res = await canReview(produitId);
    if (res.ok) setAllowed(res.data.peutCommenter);
  }, [produitId]);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchMe().then((r) => r.ok && setMeId(r.data._id));
    recheck();
  }, [status, recheck]);

  const count = reviews.length;
  const average = count ? reviews.reduce((s, r) => s + r.note, 0) / count : 0;
  const visible = reviews.filter((r) => meId === r.utilisateur._id || r.commentaire?.trim());
  const distribution = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.note === n).length }));

  return (
    <div className="grid gap-14 lg:grid-cols-[340px_1fr] lg:gap-20">
      <div>
        <h2 className="t-h2">Kundenmeinungen</h2>
        {loading ? (
          <p className="mt-8 flex items-center gap-3 text-graphite">
            <Spinner /> Bewertungen werden geladen…
          </p>
        ) : count === 0 ? (
          <p className="mt-6 text-graphite">Noch keine Bewertungen für dieses Produkt vorhanden.</p>
        ) : (
          <div className="mt-8">
            <div className="flex items-end gap-4">
              <span className="font-display text-6xl font-medium leading-none tracking-tight [font-stretch:115%]">{average.toFixed(1).replace(".", ",")}</span>
              <div className="pb-1">
                <Stars value={average} size={16} />
                <p className="t-spec mt-1.5 text-graphite">
                  {count} verifizierte Bewertung{count > 1 ? "en" : ""}
                </p>
              </div>
            </div>
            <ul className="mt-8 flex flex-col gap-2" aria-label="Notenverteilung">
              {distribution.map(({ n, c }) => (
                <li key={n} className="flex items-center gap-3 text-sm">
                  <span className="t-spec w-6 text-graphite">{n} ★</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-mist">
                    <span className="block h-full rounded-full bg-ink" style={{ width: `${count ? (c / count) * 100 : 0}%` }} />
                  </span>
                  <span className="t-spec w-6 text-right text-graphite">{c}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <p className="mt-8 text-sm text-graphite">Nur Kunden, die dieses Produkt gekauft und bezahlt haben, können eine Bewertung abgeben.</p>
      </div>

      <div className="flex flex-col gap-8">
        {status === "unauthenticated" && (
          <p className="border border-line p-5 text-sm">
            Haben Sie dieses Produkt gekauft?{" "}
            <Link href={`/connexion?callbackUrl=${encodeURIComponent(typeof window !== "undefined" ? location.pathname : "/")}`} className="font-medium underline underline-offset-4">
              Melden Sie sich an
            </Link>{" "}
            um Ihre Meinung mitzuteilen.
          </p>
        )}
        {session && allowed && !editingId && (
          <ReviewForm
            id="nouvel-avis"
            submitLabel="Bewertung veröffentlichen"
            onSubmit={async (note, comment) => {
              const res = await postReview(produitId, note, comment);
              if (!res.ok) {
                errRef.current(res.error);
                return false;
              }
              msgRef.current("Vielen Dank, Ihre Bewertung wurde veröffentlicht.");
              setAllowed(false);
              await reload();
              return true;
            }}
          />
        )}

        {!loading && count > 0 && visible.length === 0 && <p className="text-graphite">Die Bewertungen wurden ohne Kommentar abgegeben.</p>}

        <ul className="divide-y divide-line border-y border-line">
          {visible.map((r) => {
            const mine = meId === r.utilisateur._id;
            return (
              <li key={r._id} className="py-7">
                {editingId === r._id ? (
                  <ReviewForm
                    id={`avis-${r._id}`}
                    initialNote={r.note}
                    initialComment={r.commentaire}
                    submitLabel="Speichern"
                    onCancel={() => setEditingId(null)}
                    onSubmit={async (note, comment) => {
                      const res = await updateReview(r._id, note, comment);
                      if (!res.ok) {
                        errRef.current(res.error);
                        return false;
                      }
                      msgRef.current("Ihre Bewertung wurde aktualisiert.");
                      setEditingId(null);
                      await reload();
                      return true;
                    }}
                  />
                ) : (
                  <article>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-9 items-center justify-center rounded-full bg-mist text-sm font-medium" aria-hidden="true">
                          {r.utilisateur.name.charAt(0).toUpperCase()}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {r.utilisateur.name}
                            {mine && <span className="text-graphite"> · Sie</span>}
                          </p>
                          <p className="t-spec text-graphite">{new Date(r.dateCreation).toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" })}</p>
                        </div>
                      </div>
                      <Stars value={r.note} />
                    </div>
                    {r.commentaire?.trim() ? (
                      <p className="mt-4 leading-relaxed text-ink-soft">{r.commentaire}</p>
                    ) : (
                      mine && <p className="mt-4 italic text-graphite">Sie haben dieses Produkt ohne Kommentar bewertet.</p>
                    )}
                    {mine && (
                      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
                        {confirmId === r._id ? (
                          <>
                            <span>Diese Bewertung endgültig löschen?</span>
                            <button
                              type="button"
                              className="font-medium text-danger underline underline-offset-4"
                              onClick={async () => {
                                const res = await deleteReview(r._id);
                                setConfirmId(null);
                                if (!res.ok) return errRef.current(res.error);
                                msgRef.current("Ihre Bewertung wurde gelöscht.");
                                await reload();
                                await recheck();
                              }}
                            >
                              Löschen
                            </button>
                            <button type="button" className="underline underline-offset-4" onClick={() => setConfirmId(null)}>
                              Behalten
                            </button>
                          </>
                        ) : (
                          <>
                            <button type="button" className={cn("underline-offset-4 hover:underline")} onClick={() => setEditingId(r._id)}>
                              Bearbeiten
                            </button>
                            <button type="button" className="text-graphite underline-offset-4 hover:text-danger hover:underline" onClick={() => setConfirmId(r._id)}>
                              Löschen
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </article>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default ProductReviews;
