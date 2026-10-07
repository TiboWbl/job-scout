"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { TrashIcon } from "@/components/icons";
import { useConfirm } from "@/components/confirm";

export function RemoveFavorite({ companyId, name }: { companyId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const { confirm, dialog } = useConfirm();
  return (
    <>
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!(await confirm({ title: `Retirer ${name} de tes favorites ?`, detail: "Ses offres restent dans Scout, sans la priorité des favorites.", action: "Retirer" }))) return;
        setBusy(true);
        await fetch("/api/favorites", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ companyId }) }).catch(() => null);
        router.refresh();
      }}
      aria-label={`Retirer ${name} de mes favorites`}
      title="Retirer de mes favorites"
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[#d14343] hover:bg-[#d14343]/10 disabled:opacity-50"
    >
      <TrashIcon className="h-[18px] w-[18px]" />
    </button>
    {dialog}
    </>
  );
}
