"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string };

export function Rail({ items, firstName }: { items: Item[]; firstName: string | null }) {
  const pathname = usePathname();
  return (
    <aside className="flex shrink-0 flex-col gap-1 rounded-3xl bg-rail px-3.5 py-5 md:sticky md:top-4 md:h-[calc(100vh-2rem)] md:w-[220px]">
      <Link href="/" className="px-2.5 pb-5 font-display text-[26px] font-extrabold tracking-tight text-white">
        Scout<span className="text-[#b9a8ff]">.</span>
      </Link>
      <nav className="flex gap-1 overflow-x-auto md:flex-col">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`whitespace-nowrap rounded-[14px] px-3.5 py-2.5 text-[15px] ${active ? "bg-white font-semibold text-[#17151f]" : "font-medium text-rail-ink hover:text-white"}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <form action="/auth/signout" method="post" className="mt-auto hidden px-2.5 pt-4 md:block">
        {firstName && <p className="text-sm text-white">{firstName}</p>}
        <button type="submit" className="mt-1 text-[13px] text-rail-ink underline-offset-4 hover:text-white hover:underline">
          Se déconnecter
        </button>
      </form>
    </aside>
  );
}
