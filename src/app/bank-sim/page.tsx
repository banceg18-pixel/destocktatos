import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { verifyBridgeToken } from "@/lib/server/bridge";
import { BankSimulator } from "@/components/checkout/BankSimulator";

export const metadata: Metadata = {
  title: "Banküberweisung (Bridge Simulator) — Destocktatos",
  robots: { index: false, follow: false },
};

export default async function BankSimPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; bank?: string }>;
}) {
  const { token, bank } = await searchParams;
  const payload = verifyBridgeToken(token);

  if (!payload) {
    notFound();
  }

  const payerName = [payload.user.firstName, payload.user.lastName].filter(Boolean).join(" ");

  return (
    <BankSimulator
      token={token ?? ""}
      orderNumber={payload.orderNumber}
      amount={payload.amount}
      initialBankId={bank || payload.bankId || "sparkasse"}
      payerName={payerName}
    />
  );
}

