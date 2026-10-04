"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ComponentType } from "react";
import { cn } from "cn";
import {
  CalendarDaysIcon,
  FlameIcon,
  HistoryIcon,
  LibraryBigIcon,
  LogOutIcon,
  PlusIcon,
  ShapesIcon,
  SunIcon,
} from "lucide-react";
import { signOut } from "@/app/actions";
import { NewContentDialog } from "@/components/new-content-dialog";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  mobile: boolean;
}

const NAV: NavItem[] = [
  { href: "/", label: "Hoje", icon: SunIcon, mobile: true },
  { href: "/agenda", label: "Agenda", icon: CalendarDaysIcon, mobile: true },
  { href: "/contents", label: "Conteúdos", icon: LibraryBigIcon, mobile: true },
  { href: "/subjects", label: "Matérias", icon: ShapesIcon, mobile: false },
  { href: "/history", label: "Histórico", icon: HistoryIcon, mobile: true },
  { href: "/progress", label: "Progresso", icon: FlameIcon, mobile: true },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  email,
  dueCount,
  subjects,
  children,
}: {
  email: string;
  dueCount: number;
  subjects: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [newOpen, setNewOpen] = useState(false);

  // "N" opens "Novo conteúdo" from anywhere, unless the user is typing.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key.toLowerCase() !== "n" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      setNewOpen(true);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-sidebar-border px-3 py-5 lg:flex">
        <Link href="/" className="mb-7 flex items-baseline gap-2 px-3">
          <span className="font-display text-3xl leading-none tracking-tight">Revi</span>
          <span className="size-1.5 translate-y-[-2px] rounded-full bg-primary" aria-hidden />
        </Link>

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          className="mb-6 flex h-10 items-center gap-2 rounded-lg bg-foreground px-3 text-sm font-semibold text-background transition-colors hover:bg-primary hover:text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <PlusIcon className="size-4" />
          Registrar estudo
          <kbd className="ml-auto rounded border border-background/20 px-1.5 text-[11px] font-medium text-background/60">
            N
          </kbd>
        </button>

        <nav className="flex flex-col gap-0.5" aria-label="Seções">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent font-medium text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("size-4", active ? "text-primary" : "")} />
                {item.label}
                {item.href === "/" && dueCount > 0 ? (
                  <span className="ml-auto rounded-full bg-primary/15 px-2 text-xs font-semibold text-primary tabular">
                    {dueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-sidebar-border px-3 pt-4">
          <p className="truncate text-xs text-muted-foreground" title={email}>
            {email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="mt-2 flex items-center gap-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOutIcon className="size-3.5" />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-baseline gap-1.5">
            <span className="font-display text-2xl leading-none">Revi</span>
            <span className="size-1.5 rounded-full bg-primary" aria-hidden />
          </Link>
          <div className="flex items-center gap-1">
            <Link
              href="/subjects"
              className="rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Matérias
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                aria-label="Sair"
                className="rounded-lg p-2 text-muted-foreground hover:text-foreground"
              >
                <LogOutIcon className="size-4" />
              </button>
            </form>
          </div>
        </header>

        <div className="flex flex-1 flex-col pb-24 lg:pb-0">{children}</div>

        <button
          type="button"
          onClick={() => setNewOpen(true)}
          aria-label="Registrar estudo"
          className="fixed right-4 bottom-20 z-40 flex size-13 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_8px_30px_-6px_rgba(255,209,102,0.45)] lg:hidden"
        >
          <PlusIcon className="size-6" />
        </button>

        <nav
          aria-label="Seções"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          {NAV.filter((item) => item.mobile).map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("size-5", active ? "text-primary" : "")} />
                {item.label}
                {item.href === "/" && dueCount > 0 ? (
                  <span className="absolute top-2 left-1/2 ml-2 min-w-4 rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-primary-foreground tabular">
                    {dueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>
      </div>

      <NewContentDialog open={newOpen} onOpenChange={setNewOpen} subjects={subjects} />
    </div>
  );
}
