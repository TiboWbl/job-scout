// Shown instantly while a tab's server data loads, so navigation never feels frozen.
export default function Loading() {
  return (
    <div className="px-1 pb-16 pt-3 md:px-2" aria-busy="true" aria-label="Chargement">
      <div className="h-12 w-56 animate-pulse rounded-2xl bg-pill-solid" />
      <div className="mt-3 h-4 w-80 max-w-full animate-pulse rounded-full bg-pill-solid" />
      <div className="mt-8 grid gap-3.5 sm:grid-cols-2 2xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="h-[230px] animate-pulse rounded-[22px] bg-pill-solid" />
        ))}
      </div>
    </div>
  );
}
