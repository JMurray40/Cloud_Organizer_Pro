import { useEffect, useState } from "react";
import {
  useGetDashboardStats,
  useGetCategoryBreakdown,
  useGetRecentActivity,
  useGetOrgTrend,
  useRecordOrgSnapshot,
} from "@workspace/api-client-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, LineChart, Line, CartesianGrid,
} from "recharts";
import {
  FolderOpen, Clock, CheckCircle2, AlertTriangle, Cloud, BookOpen,
  HardDrive, TrendingUp, Search, Upload, ArrowRight, X, BookMarked,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const ONBOARDING_DISMISSED_KEY = "fileorbit-onboarding-dismissed";

type StatsSnapshot = {
  totalFiles: number;
  cloudAccounts: number;
  activeRules: number;
  organizedFiles: number;
  renamedFiles: number;
};

const CHECKLIST = [
  {
    key: "has_file",
    label: "Add your first file",
    description: "Use Drop Zone or Scan to bring a file into FileOrbit.",
    href: "/drop",
    cta: "Open Drop Zone",
    done: (s: StatsSnapshot) => s.totalFiles > 0,
  },
  {
    key: "has_account",
    label: "Connect a cloud account",
    description: "Link Google Drive, Dropbox, OneDrive, iCloud or Box.",
    href: "/accounts",
    cta: "Add Account",
    done: (s: StatsSnapshot) => s.cloudAccounts > 0,
  },
  {
    key: "has_rule",
    label: "Create a naming rule",
    description: "Custom rules let you auto-suggest names for specific file types.",
    href: "/rules",
    cta: "Manage Rules",
    done: (s: StatsSnapshot) => s.activeRules > 0,
  },
  {
    key: "has_organized",
    label: "Organize or rename a file",
    description: "Mark a file as organized or apply a suggested rename.",
    href: "/files",
    cta: "View Files",
    done: (s: StatsSnapshot) => s.organizedFiles + s.renamedFiles > 0,
  },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  organized: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  renamed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  duplicate: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ignored: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const CHART_COLORS = [
  "hsl(160,84%,39%)",
  "hsl(200,84%,49%)",
  "hsl(40,84%,55%)",
  "hsl(280,70%,65%)",
  "hsl(320,70%,60%)",
  "hsl(15,80%,55%)",
  "hsl(180,70%,45%)",
  "hsl(240,60%,60%)",
];

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

const ONBOARDING_STEPS = [
  {
    icon: Upload,
    title: "Drop a file",
    desc: "Drag any file into the Drop Zone to get an instant naming suggestion.",
    href: "/drop",
    cta: "Open Drop Zone",
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-900/20",
    border: "border-blue-200 dark:border-blue-800",
  },
  {
    icon: Search,
    title: "Scan existing files",
    desc: "Paste a list of filenames (or import a CSV) to bulk-analyse and rename.",
    href: "/scan",
    cta: "Go to Scan",
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-900/20",
    border: "border-purple-200 dark:border-purple-800",
  },
  {
    icon: Cloud,
    title: "Connect cloud storage",
    desc: "Link Google Drive, Dropbox, OneDrive or Box to track files across accounts.",
    href: "/accounts",
    cta: "Add Account",
    color: "text-primary",
    bg: "bg-primary/5",
    border: "border-primary/20",
  },
];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: breakdown } = useGetCategoryBreakdown();
  const { data: recent } = useGetRecentActivity();
  const { data: trend } = useGetOrgTrend();
  const recordSnapshot = useRecordOrgSnapshot();
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "1"
  );

  // Record today's snapshot at most once per browser-session — the server-side
  // upsert is idempotent, but we don't need to hit the DB on every nav.
  useEffect(() => {
    const KEY = "fileorbit-snapshot-day";
    const today = new Date().toISOString().split("T")[0];
    if (sessionStorage.getItem(KEY) === today) return;
    sessionStorage.setItem(KEY, today);
    recordSnapshot.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissChecklist = () => {
    localStorage.setItem(ONBOARDING_DISMISSED_KEY, "1");
    setChecklistDismissed(true);
  };

  const orgScore =
    stats && stats.totalFiles > 0
      ? Math.round(((stats.organizedFiles + stats.renamedFiles) / stats.totalFiles) * 100)
      : 0;

  const statCards = [
    { label: "Total Files", value: stats?.totalFiles ?? 0, icon: FolderOpen, color: "text-primary" },
    { label: "Pending", value: stats?.pendingFiles ?? 0, icon: Clock, color: "text-yellow-600" },
    { label: "Organized", value: stats?.organizedFiles ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Duplicates", value: stats?.duplicatesFound ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Cloud Accounts", value: stats?.cloudAccounts ?? 0, icon: Cloud, color: "text-blue-500" },
    { label: "Active Rules", value: stats?.activeRules ?? 0, icon: BookOpen, color: "text-purple-500" },
  ];

  const fileTypeData = stats?.fileTypeBreakdown ?? [];
  const trendData = (trend ?? []).map((s) => ({
    date: format(parseISO(s.date), "MMM d"),
    score: s.score,
  }));

  const isEmpty = !statsLoading && (!stats || stats.totalFiles === 0);

  if (isEmpty) {
    return (
      <div className="p-6 space-y-8 max-w-3xl mx-auto">
        <div className="text-center pt-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <FolderOpen className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Welcome to FileOrbit</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm mx-auto">
            Your smart file manager is ready. Start by adding some files — pick one of the options below.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {ONBOARDING_STEPS.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.href}
                className={`rounded-xl border p-5 flex flex-col gap-3 ${step.bg} ${step.border}`}
              >
                <div className={`w-10 h-10 rounded-lg bg-white/60 dark:bg-black/20 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.desc}</div>
                </div>
                <Link href={step.href}>
                  <Button size="sm" variant="outline" className="mt-auto gap-1.5 text-xs w-full">
                    {step.cta} <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                </Link>
              </div>
            );
          })}
        </div>

        <div className="rounded-xl border border-border bg-card p-5">
          <h2 className="text-sm font-semibold text-foreground mb-2">Naming convention</h2>
          <code className="text-xs font-mono text-primary bg-accent px-3 py-2 rounded-lg block">
            {"{YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}.{ext}"}
          </code>
          <p className="text-xs text-muted-foreground mt-2">
            FileOrbit enforces this pattern across all your files so everything stays consistent.{" "}
            <Link href="/convention" className="text-primary hover:underline">Read the full guide →</Link>
          </p>
        </div>
      </div>
    );
  }

  const checklistStats: StatsSnapshot = {
    totalFiles: stats?.totalFiles ?? 0,
    cloudAccounts: stats?.cloudAccounts ?? 0,
    activeRules: stats?.activeRules ?? 0,
    organizedFiles: stats?.organizedFiles ?? 0,
    renamedFiles: stats?.renamedFiles ?? 0,
  };
  const checklistCompleted = CHECKLIST.filter((s) => s.done(checklistStats)).length;
  const allDone = checklistCompleted === CHECKLIST.length;
  const showChecklist = !statsLoading && !checklistDismissed && !allDone;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">
          Dashboard
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your file organization status</p>
      </div>

      {/* Onboarding checklist */}
      {showChecklist && (
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BookMarked className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">Getting started</div>
                <div className="text-xs text-muted-foreground">
                  {checklistCompleted} of {CHECKLIST.length} steps complete
                </div>
              </div>
            </div>
            <button
              onClick={dismissChecklist}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              title="Dismiss checklist"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mb-4">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${(checklistCompleted / CHECKLIST.length) * 100}%` }}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {CHECKLIST.map((step) => {
              const done = step.done(checklistStats);
              return (
                <div
                  key={step.key}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                    done
                      ? "border-primary/20 bg-primary/5"
                      : "border-border bg-background hover:bg-muted/50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5",
                    done ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}>
                    {done && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("text-xs font-medium", done ? "text-primary line-through opacity-70" : "text-foreground")}>
                      {step.label}
                    </div>
                    {!done && (
                      <div className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</div>
                    )}
                  </div>
                  {!done && (
                    <Link href={step.href}>
                      <button className="text-xs text-primary hover:underline font-medium shrink-0 flex items-center gap-1 mt-0.5">
                        {step.cta} <ArrowRight className="w-3 h-3" />
                      </button>
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-card border border-card-border rounded-lg p-4"
              data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-4 h-4 ${card.color}`} />
                <span className="text-xs text-muted-foreground font-medium">{card.label}</span>
              </div>
              {statsLoading ? (
                <div className="h-7 w-12 bg-muted rounded animate-pulse" />
              ) : (
                <div className="text-2xl font-bold text-foreground">{card.value}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Score + savings row */}
      {stats && stats.totalFiles > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-card-border rounded-lg p-4 flex items-center gap-4">
            <div className="relative w-14 h-14 shrink-0">
              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="hsl(var(--muted))" strokeWidth="3" />
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke="hsl(160,84%,39%)" strokeWidth="3"
                  strokeDasharray={`${orgScore} ${100 - orgScore}`}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-foreground">
                {orgScore}%
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <TrendingUp className="w-4 h-4 text-primary" />
                Organization Score
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {stats.organizedFiles + stats.renamedFiles} of {stats.totalFiles} files organized or renamed
              </div>
              <div className="h-1.5 rounded-full bg-muted mt-2 overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${orgScore}%` }} />
              </div>
            </div>
          </div>

          {stats.duplicateSavingsBytes > 0 ? (
            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {formatBytes(stats.duplicateSavingsBytes)} recoverable
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Resolve {stats.duplicatesFound} duplicate{stats.duplicatesFound !== 1 ? "s" : ""} to reclaim this space
                </div>
                <Link href="/duplicates" className="text-xs text-emerald-700 dark:text-emerald-400 hover:underline font-medium mt-1 inline-block">
                  Review duplicates →
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-card border border-card-border rounded-lg p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">No duplicates detected</div>
                <div className="text-xs text-muted-foreground mt-0.5">All tracked files appear unique</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category bar chart */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Files by Category</h2>
          {breakdown && breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breakdown} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                />
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {breakdown.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No data yet.
            </div>
          )}
        </div>

        {/* File type pie chart */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">File Types</h2>
          {fileTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie
                  data={fileTypeData}
                  dataKey="count"
                  nameKey="ext"
                  cx="50%"
                  cy="50%"
                  outerRadius={72}
                  label={({ ext, percent }) =>
                    percent > 0.08 ? `${ext} ${(percent * 100).toFixed(0)}%` : ""
                  }
                  labelLine={false}
                >
                  {fileTypeData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number, name: string) => [v, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No file type data yet.
            </div>
          )}
        </div>

        {/* Org score trend */}
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Score Trend (30 days)</h2>
          {trendData.length >= 2 ? (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Score"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(160,84%,39%)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "hsl(160,84%,39%)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
              <TrendingUp className="w-8 h-8 text-muted-foreground/30" />
              <div className="text-sm text-muted-foreground">
                {trendData.length === 1
                  ? "Come back tomorrow to see your trend"
                  : "Visit daily to build up trend data"}
              </div>
              {trendData.length === 1 && (
                <div className="text-xs font-semibold text-primary">Today: {trendData[0].score}%</div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-card border border-card-border rounded-lg p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h2>
        <div className="space-y-2">
          {recent && recent.length > 0 ? (
            recent.slice(0, 8).map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
                data-testid={`activity-file-${file.id}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-medium text-foreground truncate">{file.originalName}</div>
                  <div className="text-xs text-muted-foreground">
                    {file.category}{file.subCategory ? ` / ${file.subCategory}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[file.status] ?? STATUS_COLORS.ignored}`}>
                    {file.status}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(file.updatedAt), "MMM d")}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="py-8 text-center text-muted-foreground text-sm">No recent activity</div>
          )}
        </div>
      </div>
    </div>
  );
}
