import Image from "next/image";
import type { MouseEventHandler } from "react";

export interface ImageComponentProps {
  img: string | null | undefined;
  alt: string;
  size: number;
  className?: string;
  onClick?: MouseEventHandler<HTMLImageElement>;
  priority?: boolean;
  sizes?: string;
  loading?: "lazy" | "eager";
}

/**
 * Image produit carrée (largeur = hauteur = `size`), optimisée par next/image.
 * Les fichiers sont servis localement depuis /public/assets (ou depuis le CMS si configuré).
 */
export function ImageComponent({ img, alt, size, className, onClick, priority = false, sizes, loading }: ImageComponentProps) {
  if (!img) {
    return (
      <span role="img" aria-label={alt} className={className} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="text-3xl">📦</span>
      </span>
    );
  }
  return (
    <Image
      src={img}
      alt={alt}
      width={size}
      height={size}
      className={className}
      onClick={onClick}
      priority={priority}
      sizes={sizes}
      loading={loading}
    />
  );
}

export default ImageComponent;
