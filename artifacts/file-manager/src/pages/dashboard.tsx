import { useGetDashboardStats, useGetCategoryBreakdown, useGetRecentActivity } from "@workspace/api-client-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FolderOpen, Clock, CheckCircle2, AlertTriangle, Cloud, BookOpen } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  organized: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  renamed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  duplicate: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ignored: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const CHART_COLORS = ["hsl(160,84%,39%)", "hsl(200,84%,49%)", "hsl(40,84%,59%)", "hsl(280,84%,69%)", "hsl(320,84%,59%)"];

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useGetDashboardStats();
  const { data: breakdown } = useGetCategoryBreakdown();
  const { data: recent } = useGetRecentActivity();

  const statCards = [
    { label: "Total Files", value: stats?.totalFiles ?? 0, icon: FolderOpen, color: "text-primary" },
    { label: "Pending", value: stats?.pendingFiles ?? 0, icon: Clock, color: "text-yellow-600" },
    { label: "Organized", value: stats?.organizedFiles ?? 0, icon: CheckCircle2, color: "text-green-600" },
    { label: "Duplicates", value: stats?.duplicatesFound ?? 0, icon: AlertTriangle, color: "text-red-500" },
    { label: "Cloud Accounts", value: stats?.cloudAccounts ?? 0, icon: Cloud, color: "text-blue-500" },
    { label: "Active Rules", value: stats?.activeRules ?? 0, icon: BookOpen, color: "text-purple-500" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your file organization status</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card border border-card-border rounded-lg p-4" data-testid={`stat-${card.label.toLowerCase().replace(/\s+/g, "-")}`}>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Files by Category</h2>
          {breakdown && breakdown.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={breakdown} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
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
              No data yet. Add files to see breakdown.
            </div>
          )}
        </div>

        <div className="bg-card border border-card-border rounded-lg p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Recent Activity</h2>
          <div className="space-y-2">
            {recent && recent.length > 0 ? (
              recent.slice(0, 8).map((file) => (
                <div key={file.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-0" data-testid={`activity-file-${file.id}`}>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium text-foreground truncate">{file.originalName}</div>
                    <div className="text-xs text-muted-foreground">{file.category}{file.subCategory ? ` / ${file.subCategory}` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[file.status] ?? STATUS_COLORS.ignored}`}>
                      {file.status}
                    </span>
                    <span className="text-xs text-muted-foreground">{format(new Date(file.updatedAt), "MMM d")}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm">No recent activity</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
