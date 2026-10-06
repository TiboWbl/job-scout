"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CollectButton() {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "running" | "done" | "error">("idle");
  const [summary, setSummary] = useState<string | null>(null);

  async function run() {
    setState("running");
    const res = await fetch("/api/admin/collect", { method: "POST" });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setState("error");
      setSummary(data?.error ?? "La collecte a échoué.");
      return;
    }
    const reports = (data.reports ?? []) as { seen: number; created: number; error?: string }[];
    setSummary(
      `${reports.length} sources, ${reports.reduce((n, r) => n + r.seen, 0)} offres vues, ${reports.reduce((n, r) => n + r.created, 0)} nouvelles, ${reports.filter((r) => r.error).length} en erreur.`,
    );
    setState("done");
    router.refresh();
  }

  return (
    <div>
      <p className="mb-3 max-w-2xl text-sm text-muted">
        Le robot collecte déjà les offres à 7 h, 13 h et 19 h. Ce bouton lance une collecte tout de suite, pendant 45 secondes, en commençant par les sources lues le moins
        récemment.
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={run} disabled={state === "running"} className="rounded-xl bg-button px-5 py-2.5 text-sm font-semibold text-button-ink disabled:opacity-50">
          {state === "running" ? "Collecte en cours… (jusqu'à une minute)" : "Collecter maintenant"}
        </button>
        {summary && <p className={`text-sm ${state === "error" ? "text-warn" : "text-muted"}`}>{summary}</p>}
      </div>
    </div>
  );
}
