import { LEVEL_LABELS, type Level } from "@/lib/domain/offer";

// One colour per level, the same everywhere: warm for a crush, calm for the rest.
const TONES: Record<Level, string> = {
  coeur: "bg-peach-soft text-peach-ink",
  solide: "bg-violet-soft text-violet-ink",
  tremplin: "bg-mint-soft text-mint-ink",
  ecartee: "bg-pill-solid text-muted",
};

export function LevelBadge({ level, prefix = "" }: { level: Level; prefix?: string }) {
  return <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[level]}`}>{prefix + LEVEL_LABELS[level]}</span>;
}
