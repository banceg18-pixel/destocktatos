"use client";

import { useEffect, useRef, useState } from "react";
import type { ImageRef } from "@/types/catalog";
import { cn } from "@/lib/client/cn";
import { Drawer } from "@/components/ui/Drawer";
import { IconButton } from "@/components/ui/Button";
import { ImageComponent } from "@/components/ui/ImageComponent";
import { Arrow } from "@/components/ui/Primitives";

/**
 * Galerie produit : carrousel au doigt sur mobile, mosaïque sur grand écran, et visionneuse plein
 * écran (flèches, clavier ←/→, vignettes) au clic sur une photo.
 */
export function ProductGallery({ images, title }: { images: ImageRef[]; title: string }) {
  const list = images.filter((i) => i?.url);
  const [current, setCurrent] = useState(0);
  const [viewer, setViewer] = useState<number | null>(null);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setCurrent(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (viewer == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setViewer((v) => (v == null ? v : (v + 1) % list.length));
      if (e.key === "ArrowLeft") setViewer((v) => (v == null ? v : (v - 1 + list.length) % list.length));
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [viewer, list.length]);

  if (!list.length) {
    return <div className="flex aspect-square items-center justify-center bg-mist text-graphite">Photo bientôt disponible</div>;
  }

  const Tile = ({ img, i, className, priority }: { img: ImageRef; i: number; className?: string; priority?: boolean }) => (
    <button type="button" onClick={() => setViewer(i)} className={cn("group relative block aspect-square w-full cursor-zoom-in overflow-hidden bg-mist", className)} aria-label={`Agrandir la photo ${i + 1} sur ${list.length}`}>
      <ImageComponent
        img={img.url}
        alt={i === 0 ? title : `${title} — vue ${i + 1}`}
        size={900}
        priority={priority}
        sizes="(min-width: 1024px) 50vw, 100vw"
        className="size-full object-contain p-[8%] mix-blend-multiply transition-transform duration-700 ease-[var(--ease-out-expo)] group-hover:scale-[1.03]"
      />
    </button>
  );

  return (
    <>
      {/* Mobile et tablette : carrousel natif. */}
      <div className="lg:hidden">
        <div ref={track} className="scroll-x -mx-[clamp(20px,3.4vw,48px)] flex">
          {list.map((img, i) => (
            <div key={img.url + i} className="w-full shrink-0">
              <Tile img={img} i={i} priority={i === 0} />
            </div>
          ))}
        </div>
        {list.length > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <div className="flex gap-1.5" aria-hidden="true">
              {list.map((_, i) => (
                <span key={i} className={cn("h-[2px] w-6 transition-colors", i === current ? "bg-ink" : "bg-line")} />
              ))}
            </div>
            <span className="t-spec text-graphite">
              {current + 1} / {list.length}
            </span>
          </div>
        )}
      </div>

      {/* Grand écran : mosaïque. */}
      <div className="hidden gap-3 lg:grid lg:grid-cols-2">
        {list.map((img, i) => (
          <Tile key={img.url + i} img={img} i={i} priority={i === 0} className={i === 0 || (list.length % 2 === 0 && i === list.length - 1 && list.length > 2) ? "col-span-2" : undefined} />
        ))}
      </div>

      <Drawer open={viewer != null} onClose={() => setViewer(null)} side="right" title={`Photos — ${title}`} closeLabel="Fermer les photos" className="!max-w-none">
        {viewer != null && (
          <div className="flex h-full flex-col gap-4 px-4 pb-6 sm:px-8">
            <div className="relative min-h-0 flex-1">
              <ImageComponent img={list[viewer].url} alt={`${title} — vue ${viewer + 1}`} size={1400} sizes="100vw" className="absolute inset-0 size-full object-contain" />
              {list.length > 1 && (
                <>
                  <IconButton label="Photo précédente" className="absolute left-0 top-1/2 -translate-y-1/2" onClick={() => setViewer((viewer - 1 + list.length) % list.length)}>
                    <Arrow direction="left" />
                  </IconButton>
                  <IconButton label="Photo suivante" className="absolute right-0 top-1/2 -translate-y-1/2" onClick={() => setViewer((viewer + 1) % list.length)}>
                    <Arrow />
                  </IconButton>
                </>
              )}
            </div>
            {list.length > 1 && (
              <div className="flex justify-center gap-2 overflow-x-auto">
                {list.map((img, i) => (
                  <button
                    key={img.url + i}
                    type="button"
                    onClick={() => setViewer(i)}
                    aria-label={`Afficher la photo ${i + 1}`}
                    aria-current={i === viewer ? "true" : undefined}
                    className={cn("size-16 shrink-0 border bg-mist p-1.5", i === viewer ? "border-ink" : "border-transparent opacity-60 hover:opacity-100")}
                  >
                    <ImageComponent img={img.url} alt="" size={64} className="size-full object-contain mix-blend-multiply" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

export default ProductGallery;
