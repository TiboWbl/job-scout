"use client";

import { useState } from "react";
import { ExternalLink, ListChecks, Plus, Trash2, X } from "lucide-react";
import { useApplications } from "@/lib/storage";
import { APPLICATION_STAGES } from "@/lib/constants";
import { ApplicationEntry, ApplicationStage } from "@/lib/types";
import { Select } from "@/components/select";
import { EmptyState } from "@/components/empty-state";

function NewEntryForm({ onCreate, onCancel }: { onCreate: (entry: { title: string; company: string; sourceUrl: string; notes: string }) => void; onCancel: () => void }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [notes, setNotes] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (title.trim() === "" || company.trim() === "") return;
        onCreate({ title: title.trim(), company: company.trim(), sourceUrl: sourceUrl.trim(), notes: notes.trim() });
      }}
      className="mb-5 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Ajouter une candidature</h2>
        <button type="button" onClick={onCancel} className="text-foreground-tertiary hover:text-foreground">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Intitulé du poste"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <input
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Entreprise"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <input
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="Lien de l'offre (LinkedIn, WTTJ…), optionnel"
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none sm:col-span-2"
        />
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes, optionnel"
          rows={2}
          className="resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none sm:col-span-2"
        />
      </div>
      <button
        type="submit"
        className="self-start rounded-full bg-accent px-4 py-2 text-xs font-semibold text-white hover:bg-accent-hover"
      >
        Ajouter au suivi
      </button>
    </form>
  );
}

function ApplicationCard({
  entry,
  onStageChange,
  onNotesChange,
  onDelete,
}: {
  entry: ApplicationEntry;
  onStageChange: (stage: ApplicationStage) => void;
  onNotesChange: (notes: string) => void;
  onDelete: () => void;
}) {
  const [notesDraft, setNotesDraft] = useState(entry.notes);

  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-border bg-surface p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{entry.title}</p>
          <p className="truncate text-xs text-foreground-secondary">{entry.company}</p>
        </div>
        <button type="button" onClick={onDelete} className="shrink-0 text-foreground-tertiary hover:text-danger" aria-label="Supprimer">
          <Trash2 size={14} />
        </button>
      </div>

      <Select value={entry.stage} onChange={(e) => onStageChange(e.target.value as ApplicationStage)} className="w-full py-1.5 text-xs">
        {APPLICATION_STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </Select>

      <textarea
        value={notesDraft}
        onChange={(e) => setNotesDraft(e.target.value)}
        onBlur={() => onNotesChange(notesDraft)}
        placeholder="Notes…"
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-background px-2.5 py-2 text-xs text-foreground placeholder:text-foreground-tertiary focus:border-accent focus:outline-none"
      />

      {entry.sourceUrl && (
        <a
          href={entry.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs font-medium text-accent hover:underline"
        >
          Voir l&apos;offre
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

export default function TrackingPage() {
  const { applications, addApplication, updateApplication, removeApplication, hydrated } = useApplications();
  const [showForm, setShowForm] = useState(false);

  if (!hydrated) return null;

  return (
    <div className="px-4 py-6 md:px-8 md:py-10">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <ListChecks size={16} />
            Suivi
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            Où en sont tes candidatures
          </h1>
          <p className="mt-1.5 text-sm text-foreground-secondary">
            Marque une offre comme suivie depuis son détail, ou ajoute-en une trouvée ailleurs.
          </p>
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            <Plus size={15} />
            Ajouter
          </button>
        )}
      </header>

      {showForm && (
        <NewEntryForm
          onCancel={() => setShowForm(false)}
          onCreate={({ title, company, sourceUrl, notes }) => {
            addApplication({ title, company, sourceUrl: sourceUrl || undefined, notes, stage: "interesse" });
            setShowForm(false);
          }}
        />
      )}

      {applications.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Rien à suivre pour l'instant"
          description="Commence le suivi d'une offre depuis son détail, ou ajoute une candidature manuellement."
        />
      ) : (
        <div className="scrollbar-thin flex gap-4 overflow-x-auto pb-4">
          {APPLICATION_STAGES.map((stage) => {
            const entries = applications.filter((a) => a.stage === stage.key);
            return (
              <div key={stage.key} className="flex w-72 shrink-0 flex-col gap-3">
                <div className="flex items-center gap-2 px-1">
                  <h2 className="text-sm font-semibold text-foreground">{stage.label}</h2>
                  <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs font-medium text-foreground-tertiary">
                    {entries.length}
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {entries.map((entry) => (
                    <ApplicationCard
                      key={entry.id}
                      entry={entry}
                      onStageChange={(stage) => updateApplication(entry.id, { stage })}
                      onNotesChange={(notes) => updateApplication(entry.id, { notes })}
                      onDelete={() => removeApplication(entry.id)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
