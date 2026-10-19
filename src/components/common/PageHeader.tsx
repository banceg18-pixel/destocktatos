import type { ReactNode } from "react";
import { cn } from "@/lib/client/cn";
import { ImageComponent } from "@/components/ui/ImageComponent";

/** En-tête des pages intérieures : grand titre, introduction, visuel optionnel. */
export function PageHeader({
  title,
  intro,
  meta,
  image,
  imageAlt,
  className,
}: {
  title: ReactNode;
  intro?: ReactNode;
  meta?: ReactNode;
  image?: string | null;
  imageAlt?: string;
  className?: string;
}) {
  return (
    <header className={cn("shell pb-12 pt-12 lg:pb-16 lg:pt-20", className)}>
      <div className={cn("grid gap-10", image && "lg:grid-cols-[1fr_340px] lg:items-end")}>
        <div className="max-w-4xl">
          <h1 className="t-display animate-[slide-up_0.9s_var(--ease-out-expo)_both]">{title}</h1>
          {intro && <p className="t-lead mt-6 max-w-2xl text-graphite animate-[slide-up_0.9s_var(--ease-out-expo)_80ms_both]">{intro}</p>}
          {meta && <div className="mt-6">{meta}</div>}
        </div>
        {image && (
          <div className="hidden aspect-square bg-mist p-10 lg:block">
            <ImageComponent img={image} alt={imageAlt ?? ""} size={340} priority className="size-full object-contain mix-blend-multiply" />
          </div>
        )}
      </div>
    </header>
  );
}
