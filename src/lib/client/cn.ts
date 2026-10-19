/** Concatène des classes (équivalent de `clsx`, sans fusion Tailwind — comme sur la source). */
export type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, unknown>;

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = [];
  const push = (v: ClassValue) => {
    if (!v) return;
    if (typeof v === "string" || typeof v === "number") out.push(String(v));
    else if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === "object") for (const [k, on] of Object.entries(v)) if (on) out.push(k);
  };
  inputs.forEach(push);
  return out.join(" ");
}
