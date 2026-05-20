import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard, Files, Search, Upload, BookOpen, Cloud, FolderOpen,
  Copy, History, Moon, Sun, Menu, X, LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useGetDashboardStats } from "@workspace/api-client-react";
import { useUser, useClerk } from "@clerk/react";
import { useDarkMode } from "@/hooks/use-dark-mode";

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

type SidebarProps = {
  location: string;
  badges: Record<string, number | undefined>;
  dark: boolean;
  onToggleDark: () => void;
  user: ReturnType<typeof useUser>["user"];
  userInitials: string;
  displayName: string;
  signOut: ReturnType<typeof useClerk>["signOut"];
};

function Sidebar({ location, badges, dark, onToggleDark, user, userInitials, displayName, signOut }: SidebarProps) {
  return (
    <aside className="w-60 shrink-0 border-r border-sidebar-border bg-sidebar flex flex-col h-full">
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
          const badge = badges[item.href];
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
              <span className="flex-1">{item.label}</span>
              {badge != null && (
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none min-w-[18px] text-center",
                    isActive
                      ? "bg-white/25 text-white"
                      : item.href === "/duplicates"
                      ? "bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400"
                      : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400"
                  )}
                >
                  {badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 mb-1">
            <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold shrink-0 uppercase">
              {userInitials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-sidebar-foreground truncate">{displayName}</div>
            </div>
            <button
              onClick={() => signOut({ redirectUrl: "/" })}
              title="Sign out"
              className="p-1 rounded hover:bg-sidebar-accent transition-colors text-muted-foreground hover:text-foreground"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <button
          onClick={onToggleDark}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
          title={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? <Sun className="w-4 h-4 shrink-0" /> : <Moon className="w-4 h-4 shrink-0" />}
          {dark ? "Light Mode" : "Dark Mode"}
        </button>
        <div className="px-3 py-1 text-xs text-muted-foreground font-mono truncate">
          YYYY-MM-DD_Cat_Sub_Desc_v1.ext
        </div>
      </div>
    </aside>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [dark, setDark] = useDarkMode();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: stats } = useGetDashboardStats();
  const { user } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  const badges: Record<string, number | undefined> = {
    "/files": stats?.pendingFiles && stats.pendingFiles > 0 ? stats.pendingFiles : undefined,
    "/duplicates": stats?.duplicatesFound && stats.duplicatesFound > 0 ? stats.duplicatesFound : undefined,
  };

  const userInitials = user
    ? (user.firstName?.[0] ?? "") + (user.lastName?.[0] ?? user.emailAddresses?.[0]?.emailAddress?.[0] ?? "")
    : "?";
  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName ?? ""}`.trim()
    : user?.emailAddresses?.[0]?.emailAddress ?? "";

  const sidebarProps: SidebarProps = {
    location,
    badges,
    dark,
    onToggleDark: () => setDark((d) => !d),
    user,
    userInitials,
    displayName,
    signOut,
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:flex-col md:w-60 md:shrink-0">
        <div className="sticky top-0 h-screen flex flex-col border-r border-sidebar-border bg-sidebar">
          <Sidebar {...sidebarProps} />
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile sidebar drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 flex flex-col md:hidden transition-transform duration-200",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <Sidebar {...sidebarProps} />
      </div>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-auto">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background sticky top-0 z-30">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-primary flex items-center justify-center">
              <FolderOpen className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold text-foreground">FileOrbit</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className={cn(
              "ml-auto p-1.5 rounded-md hover:bg-muted transition-colors",
              !mobileOpen && "invisible"
            )}
            aria-label="Close menu"
          >
            <X className="w-5 h-5 text-foreground" />
          </button>
        </div>

        {children}
      </main>
    </div>
  );
}
