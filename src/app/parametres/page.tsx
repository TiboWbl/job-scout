"use client";

import { Laptop, Moon, RotateCcw, Settings, Sun, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTheme } from "@/lib/preferences";
import { useSavedOffers, useSearchCriteria } from "@/lib/storage";
import { DEFAULT_CRITERIA } from "@/lib/types";
import { FormSection } from "@/components/form-section";
import { SegmentedControl } from "@/components/segmented-control";

export default function SettingsPage() {
  const { theme, setTheme, hydrated } = useTheme();
  const { setCriteria } = useSearchCriteria();
  const { setSavedOffers } = useSavedOffers();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!hydrated) return null;

  function resetEverything() {
    setCriteria(DEFAULT_CRITERIA);
    setSavedOffers([]);
    setTheme("system");
    setConfirmReset(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-10">
      <header className="mb-6">
        <div className="flex items-center gap-2 text-sm font-medium text-accent">
          <Settings size={16} />
          Paramètres
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
          Réglages de l&apos;application
        </h1>
        <p className="mt-1.5 text-sm text-foreground-secondary">
          Tout reste stocké sur cet appareil, dans ce navigateur.
        </p>
      </header>

      <div className="flex flex-col gap-4">
        <FormSection title="Apparence" description="Choisis le thème de l'interface.">
          <SegmentedControl
            value={theme}
            onChange={setTheme}
            options={[
              { value: "system", label: "Système", icon: <Laptop size={15} /> },
              { value: "light", label: "Clair", icon: <Sun size={15} /> },
              { value: "dark", label: "Sombre", icon: <Moon size={15} /> },
            ]}
          />
        </FormSection>

        <FormSection title="Données" description="Tes critères et offres enregistrées vivent uniquement dans ce navigateur : rien n'est envoyé ailleurs.">
          {!confirmReset ? (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-2 rounded-full border border-border px-3.5 py-2 text-sm font-medium text-foreground-secondary hover:border-danger hover:text-danger"
            >
              <Trash2 size={15} />
              Réinitialiser toutes mes données
            </button>
          ) : (
            <div className="flex flex-wrap items-center gap-2.5 rounded-xl bg-danger-soft p-3.5">
              <p className="flex-1 text-sm text-danger">
                Supprimer tes critères, offres enregistrées et préférences ? C&apos;est irréversible.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={resetEverything}
                  className="flex items-center gap-1.5 rounded-full bg-danger px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <RotateCcw size={13} />
                  Confirmer
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground-secondary"
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </FormSection>
      </div>
    </div>
  );
}
