import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AppShell } from "@/client/components/AppShell";

const LINK =
  "text-sm text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground";

/** Every page: the shell with the app's two sections in its bar. */
export function Page({ children }: { children: ReactNode }) {
  return (
    <AppShell
      nav={
        <nav className="flex items-center gap-4" aria-label="Sections">
          <Link to="/" className={LINK} activeOptions={{ exact: true }}>
            Queue
          </Link>
          <Link to="/library" className={LINK}>
            Library
          </Link>
        </nav>
      }
    >
      {children}
    </AppShell>
  );
}
