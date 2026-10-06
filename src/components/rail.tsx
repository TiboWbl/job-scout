"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AccountMenu } from "./account-menu";

type Item = { href: string; label: string };

export function Rail({ items, firstName, avatarUrl, isAdmin }: { items: Item[]; firstName: string | null; avatarUrl: string | null; isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <aside className="relative flex shrink-0 flex-col gap-1 rounded-3xl border border-line bg-rail px-3.5 py-5 md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-[220px]">
      <Link href="/" className="px-2.5 pb-5 font-display text-[26px] font-extrabold tracking-tight text-rail-text">
        Scout<span className="text-brand">.</span>
      </Link>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-[14px] px-3.5 py-2.5 text-[15px] ${active ? "bg-rail-active font-semibold text-rail-active-ink" : "font-medium text-rail-ink hover:bg-pill-solid hover:text-rail-text"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4 max-md:absolute max-md:right-3 max-md:top-3 max-md:pt-0">
        <AccountMenu firstName={firstName} avatarUrl={avatarUrl} isAdmin={isAdmin} />
      </div>
    </aside>
  );
}
