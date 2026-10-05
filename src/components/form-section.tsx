import { ReactNode } from "react";
import clsx from "clsx";

export function FormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={clsx("rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-card)]", className)}>
      <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
      {description && <p className="mt-1 text-sm text-foreground-secondary">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
