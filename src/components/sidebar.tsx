"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bookmark,
  Compass,
  FileSearch,
  ListChecks,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Radar,
  Settings,
  Sparkles,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";
import clsx from "clsx";
import { useSidebarCollapsed } from "@/lib/preferences";
import { useSearchCriteria } from "@/lib/storage";

const NAV_ITEMS = [
  { href: "/", label: "Nouvelles offres", icon: Sparkles },
  { href: "/enregistrees", label: "Offres enregistrées", icon: Bookmark },
  { href: "/suivi", label: "Suivi", icon: ListChecks },
  { href: "/cv", label: "Analyse CV", icon: FileSearch },
  { href: "/criteres", label: "Critères de recherche", icon: SlidersHorizontal },
];

function NavLink({
  href,
  label,
  icon: Icon,
  collapsed,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: typeof Sparkles;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? label : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-accent-soft text-accent"
          : "text-foreground-secondary hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon size={18} strokeWidth={2.1} />
      {!collapsed && label}
    </Link>
  );
}

function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div
      className="brand-gradient flex shrink-0 items-center justify-center rounded-xl text-white shadow-[0_2px_8px_rgba(81,71,229,0.35)]"
      style={{ width: size, height: size }}
    >
      <Compass size={size * 0.56} strokeWidth={2.2} />
    </div>
  );
}

function SidebarStat({ collapsed }: { collapsed: boolean }) {
  const { criteria, hydrated } = useSearchCriteria();
  if (!hydrated || collapsed) return null;

  return (
    <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-tertiary">
        <Radar size={13} className="text-accent" />
        En veille
      </div>
      <p className="mt-1.5 text-sm text-foreground">
        <span className="font-semibold">{criteria.sources.length}</span> source{criteria.sources.length > 1 ? "s" : ""} suivie{criteria.sources.length > 1 ? "s" : ""}
      </p>
    </div>
  );
}

function SidebarBody({
  collapsed,
  onNavigate,
  onToggleCollapse,
  showCollapseToggle,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  onToggleCollapse?: () => void;
  showCollapseToggle?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className={clsx("flex items-center gap-3 px-2 pb-6", collapsed && "flex-col gap-2 px-0")}>
        <BrandMark />
        {!collapsed && (
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-foreground">Job Scout</p>
          </div>
        )}
        {showCollapseToggle && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-tertiary hover:bg-surface-hover hover:text-foreground"
            aria-label={collapsed ? "Déplier la barre latérale" : "Replier la barre latérale"}
          >
            {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavLink key={item.href} {...item} collapsed={collapsed} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-3 pt-4">
        <SidebarStat collapsed={collapsed} />
        <div className="border-t border-border pt-3">
          <NavLink href="/parametres" label="Paramètres" icon={Settings} collapsed={collapsed} onNavigate={onNavigate} />
        </div>
      </div>
    </div>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, setCollapsed, hydrated } = useSidebarCollapsed();
  const isCollapsed = hydrated && collapsed;

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-surface-sidebar/90 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <BrandMark size={28} />
          <span className="text-sm font-semibold">Job Scout</span>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-hover"
          aria-label="Ouvrir le menu"
        >
          <Menu size={20} />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-surface-sidebar p-4 shadow-2xl animate-fade-in-up">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg text-foreground-secondary hover:bg-surface-hover"
              aria-label="Fermer le menu"
            >
              <X size={18} />
            </button>
            <SidebarBody collapsed={false} onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <aside
        className={clsx(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface-sidebar px-3 py-5 transition-[width] duration-200 ease-out md:flex",
          isCollapsed ? "w-[84px]" : "w-64",
        )}
      >
        <SidebarBody
          collapsed={isCollapsed}
          showCollapseToggle
          onToggleCollapse={() => setCollapsed(!collapsed)}
        />
      </aside>
    </>
  );
}
