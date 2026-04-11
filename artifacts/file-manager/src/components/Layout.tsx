import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Files, Search, Upload, BookOpen, Cloud, FolderOpen, Copy, History, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/files", label: "Files", icon: Files },
  { href: "/duplicates", label: "Duplicates", icon: Copy },
  { href: "/history", label: "History", icon: History },
  { href: "/scan", label: "Scan & Organize", icon: Search },
  { href: "/drop", label: "Drop Zone", icon: Upload },
  { href: "/rules", label: "Naming Rules", icon: BookOpen },
  { href: "/accounts", label: "Cloud Accounts", icon: Cloud },
  { href: "/convention", label: "Convention Guide", icon: FolderOpen },
];

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof document === "undefined") return false;
    return document.documentElement.classList.contains("dark") ||
      localStorage.getItem("fileorbit-theme") === "dark";
  });

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("fileorbit-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("fileorbit-theme", "light");
    }
  }, [dark]);

  useEffect(() => {
    const saved = localStorage.getItem("fileorbit-theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  return [dark, setDark] as const;
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useDarkMode();

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-5 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <FolderOpen className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold text-sidebar-foreground leading-tight">FileOrbit</div>
              <div className="text-xs text-muted-foreground">Smart File Manager</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-2">
          <button
            onClick={() => setDark(!dark)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
            title={dark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <div className="px-3 py-1 text-xs text-muted-foreground font-mono">
            YYYY-MM-DD_Cat_Sub_Desc_v1.ext
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {children}
      </main>
    </div>
  );
}
