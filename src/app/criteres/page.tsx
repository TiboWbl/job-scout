"use client";

import { RotateCcw, SlidersHorizontal } from "lucide-react";
import { useSearchCriteria } from "@/lib/storage";
import {
  COMPANY_SIZES,
  CONTRACT_TYPES,
  DOMAIN_SUGGESTIONS,
  JOB_TITLE_SUGGESTIONS,
  LOCATION_SUGGESTIONS,
  MAX_PRIORITIES,
  MISSION_KEYWORD_SUGGESTIONS,
  PRIORITY_OPTIONS,
  SOURCES,
  SOURCE_COLORS,
  SOURCE_DESCRIPTIONS,
  WORK_MODES,
} from "@/lib/constants";
import { DEFAULT_CRITERIA, SearchCriteria } from "@/lib/types";
import { FormSection } from "@/components/form-section";
import { Chip } from "@/components/chip";
import { TagInput } from "@/components/tag-input";

export default function CriteriaPage() {
  const { criteria, setCriteria, hydrated } = useSearchCriteria();

  function patch<K extends keyof SearchCriteria>(key: K, value: SearchCriteria[K]) {
    setCriteria({ ...criteria, [key]: value });
  }

  function toggleInArray<T>(list: T[], value: T): T[] {
    return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
  }

  if (!hydrated) return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-accent">
            <SlidersHorizontal size={16} />
            Critères de recherche
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground md:text-[28px]">
            Ce que tu cherches, précisément
          </h1>
          <p className="mt-1.5 text-sm text-foreground-secondary">
            Enregistré automatiquement : tes nouvelles offres s&apos;ajustent en temps réel.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCriteria(DEFAULT_CRITERIA)}
          className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-2 text-xs font-medium text-foreground-secondary hover:border-border-strong hover:text-foreground"
        >
          <RotateCcw size={13} />
          Réinitialiser
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <FormSection
          title="Postes recherchés"
          description="Les intitulés que tu veux voir en priorité."
          className="lg:col-span-2"
        >
          <TagInput
            values={criteria.jobTitles}
            onChange={(v) => patch("jobTitles", v)}
            placeholder="Ex. Product Manager"
            suggestions={JOB_TITLE_SUGGESTIONS}
          />
        </FormSection>

        <FormSection
          title="Missions recherchées"
          description="Ce que tu veux faire au quotidien, même si l'intitulé du poste varie d'une entreprise à l'autre."
        >
          <TagInput
            values={criteria.missionKeywords}
            onChange={(v) => patch("missionKeywords", v)}
            placeholder="Ex. discovery utilisateur, roadmap"
            suggestions={MISSION_KEYWORD_SUGGESTIONS}
          />
        </FormSection>

        <FormSection title="Domaines & secteurs" description="Les univers dans lesquels tu as envie de travailler.">
          <div className="flex flex-wrap gap-2">
            {DOMAIN_SUGGESTIONS.map((domain) => (
              <Chip
                key={domain}
                label={domain}
                selected={criteria.domains.includes(domain)}
                onClick={() => patch("domains", toggleInArray(criteria.domains, domain))}
              />
            ))}
          </div>
        </FormSection>

        <FormSection title="Localisation" description="Les villes qui t'intéressent, ou le full remote.">
          <TagInput
            values={criteria.locations}
            onChange={(v) => patch("locations", v)}
            placeholder="Ex. Paris"
            suggestions={LOCATION_SUGGESTIONS}
          />
          <label className="mt-4 flex items-center gap-2 text-sm text-foreground-secondary">
            <input
              type="checkbox"
              checked={criteria.remoteOnly}
              onChange={(e) => patch("remoteOnly", e.target.checked)}
              className="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent/30"
            />
            Uniquement en télétravail complet
          </label>
          {!criteria.remoteOnly && (
            <div className="mt-4 flex flex-wrap gap-2">
              {WORK_MODES.map((mode) => (
                <Chip
                  key={mode}
                  label={mode}
                  selected={criteria.workModes.includes(mode)}
                  onClick={() => patch("workModes", toggleInArray(criteria.workModes, mode))}
                />
              ))}
            </div>
          )}
        </FormSection>

        <FormSection title="Type de contrat">
          <div className="flex flex-wrap gap-2">
            {CONTRACT_TYPES.map((type) => (
              <Chip
                key={type}
                label={type}
                selected={criteria.contractTypes.includes(type)}
                onClick={() => patch("contractTypes", toggleInArray(criteria.contractTypes, type))}
              />
            ))}
          </div>
        </FormSection>

        <FormSection title="Salaire minimum" description="En k€ brut annuel (indicatif pour les missions freelance).">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={20}
              max={90}
              step={1}
              value={criteria.salaryMin}
              onChange={(e) => patch("salaryMin", Number(e.target.value))}
              className="h-1.5 flex-1 accent-accent"
            />
            <span className="w-16 shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-center text-sm font-semibold text-accent">
              {criteria.salaryMin}k€
            </span>
          </div>
        </FormSection>

        <FormSection title="Taille d'entreprise">
          <div className="flex flex-wrap gap-2">
            {COMPANY_SIZES.map((size) => (
              <Chip
                key={size}
                label={size}
                selected={criteria.companySizes.includes(size)}
                onClick={() => patch("companySizes", toggleInArray(criteria.companySizes, size))}
              />
            ))}
          </div>
        </FormSection>

        <FormSection
          title="Sources à suivre"
          description="Des sources officielles et légales uniquement, chacune nécessite une clé API gratuite à configurer dans .env.local (voir le README)."
        >
          <div className="flex flex-col gap-2.5">
            {SOURCES.map((source) => (
              <label key={source} className="flex items-start gap-2.5 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={criteria.sources.includes(source)}
                  onChange={() => patch("sources", toggleInArray(criteria.sources, source))}
                  className="mt-0.5 h-4 w-4 rounded border-border-strong text-accent focus:ring-accent/30"
                />
                <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: SOURCE_COLORS[source] }} />
                <span>
                  {source}
                  <span className="block text-xs font-normal text-foreground-tertiary">{SOURCE_DESCRIPTIONS[source]}</span>
                </span>
              </label>
            ))}
          </div>
        </FormSection>

        <FormSection title="Mots-clés à exclure" description="Les offres contenant ces mots n'apparaîtront jamais.">
          <TagInput
            values={criteria.excludeKeywords}
            onChange={(v) => patch("excludeKeywords", v)}
            placeholder="Ex. astreinte, commercial"
          />
        </FormSection>

        <FormSection
          title="Priorités"
          description={`Qu'est-ce qui compte le plus pour toi ? Choisis jusqu'à ${MAX_PRIORITIES} critères : ils compteront double dans le classement des offres.`}
          className="lg:col-span-2"
        >
          <div className="flex flex-wrap gap-2">
            {PRIORITY_OPTIONS.map(({ key, label }) => {
              const selected = criteria.priorities.includes(key);
              const disabled = !selected && criteria.priorities.length >= MAX_PRIORITIES;
              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  onClick={() => patch("priorities", toggleInArray(criteria.priorities, key))}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                    selected
                      ? "border-accent bg-accent text-white"
                      : disabled
                        ? "border-border bg-surface text-foreground-tertiary/50"
                        : "border-border bg-surface text-foreground-secondary hover:border-border-strong hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </FormSection>
      </div>
    </div>
  );
}
