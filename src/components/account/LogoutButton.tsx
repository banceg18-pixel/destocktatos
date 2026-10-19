"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { cn } from "@/lib/client/cn";
import { Spinner } from "@/components/ui/Primitives";

export function LogoutButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        setLoading(true);
        await signOut({ callbackUrl: "/" });
      }}
      disabled={loading}
      className={cn("inline-flex items-center gap-2 text-sm text-graphite underline-offset-4 hover:text-ink hover:underline disabled:opacity-50", className)}
    >
      {loading ? (
        <>
          <Spinner /> Déconnexion…
        </>
      ) : (
        "Se déconnecter"
      )}
    </button>
  );
}

export default LogoutButton;
