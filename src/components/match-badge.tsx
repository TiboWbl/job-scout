import clsx from "clsx";

export function MatchBadge({ score }: { score: number }) {
  const tone =
    score >= 75
      ? "bg-success-soft text-success"
      : score >= 50
        ? "bg-accent-soft text-accent"
        : "bg-surface-hover text-foreground-tertiary";

  return (
    <span className={clsx("shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums", tone)}>
      {score}% match
    </span>
  );
}
