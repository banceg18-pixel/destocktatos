"use client";

import { useState } from "react";
import { useCart } from "@/context/CartProvider";
import { formatEuros } from "@/lib/money";
import { Spinner } from "@/components/ui/Primitives";
import { IconClose } from "@/components/ui/Icons";

/** Code de réduction (vérifié par /api/loyalty/validate ; réduction plafonnée à 10 % de la commande). */
export function CouponForm() {
  const [code, setCode] = useState("");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { appliedCoupon, couponLoading, applyCoupon, removeCoupon } = useCart();

  if (appliedCoupon) {
    return (
      <div className="flex items-start justify-between gap-3 bg-mist p-4 text-sm" role="status">
        <div>
          <p className="font-medium">
            Code <span className="t-spec">{appliedCoupon.code}</span> appliqué : −{formatEuros(appliedCoupon.discount)}
          </p>
          <p className="mt-1 text-graphite">{appliedCoupon.message}</p>
        </div>
        <button type="button" onClick={removeCoupon} className="rounded-full p-1 text-graphite hover:text-ink" aria-label="Retirer le code de réduction">
          <IconClose size={16} />
        </button>
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm underline underline-offset-4">
        J&apos;ai un code de réduction
      </button>
    );
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const problem = await applyCoupon(code);
        setError(problem);
        if (!problem) setCode("");
      }}
      noValidate
      className="flex flex-col gap-2"
    >
      <label htmlFor="coupon-code" className="text-sm font-medium">
        Code de réduction
      </label>
      <div className="flex gap-2">
        <input
          id="coupon-code"
          type="text"
          value={code}
          autoFocus
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            if (error) setError(null);
          }}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? "coupon-code-error" : undefined}
          placeholder="EX. BIENVENUE10"
          disabled={couponLoading}
          autoComplete="off"
          className={`t-spec h-11 min-w-0 flex-1 rounded-sm border px-3 !text-sm focus:border-ink focus:outline-none ${error ? "border-danger" : "border-line"}`}
        />
        <button type="submit" disabled={couponLoading} className="flex h-11 items-center gap-2 rounded-sm bg-ink px-4 text-xs font-medium uppercase tracking-[0.09em] text-paper disabled:opacity-40">
          {couponLoading ? <Spinner /> : "Appliquer"}
        </button>
      </div>
      {error ? (
        <p id="coupon-code-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-graphite">La réduction est plafonnée à 10 % du montant des articles.</p>
      )}
    </form>
  );
}

export default CouponForm;
