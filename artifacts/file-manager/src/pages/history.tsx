import { useState } from "react";
import { useListHistory, getListHistoryQueryKey, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { History, Undo2, GitBranch, CheckCircle, MinusCircle, Trash2, Play, Copy, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const ACTION_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  organized: { label: "Organized", icon: CheckCircle, color: "text-green-600" },
  ignored: { label: "Ignored", icon: MinusCircle, color: "text-muted-foreground" },
  deleted: { label: "Deleted", icon: Trash2, color: "text-red-500" },
  bulk_renamed: { label: "Bulk Renamed", icon: Play, color: "text-blue-600" },
  duplicate_resolved: { label: "Duplicate Resolved", icon: Copy, color: "text-orange-500" },
  renamed: { label: "Renamed", icon: GitBranch, color: "text-purple-600" },
  undo: { label: "Undone", icon: Undo2, color: "text-yellow-600" },
};

export default function HistoryPage() {
  const { data: entries, isLoading, refetch } = useListHistory();
  const [undoing, setUndoing] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleUndo = async (id: number, label: string) => {
    setUndoing(id);
    try {
      const res = await fetch(`${BASE}/api/history/${id}/undo`, { method: "POST" });
      const data = await res.json();
      if (data.success) {
        toast({ title: "Action undone", description: data.message });
        queryClient.invalidateQueries({ queryKey: getListHistoryQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
      } else {
        toast({ title: "Cannot undo", description: data.message, variant: "destructive" });
      }
    } catch {
      toast({ title: "Undo failed", variant: "destructive" });
    } finally {
      setUndoing(null);
    }
  };

  const grouped = entries?.reduce<Record<string, typeof entries>>((acc, entry) => {
    const day = format(new Date(entry.performedAt), "yyyy-MM-dd");
    if (!acc[day]) acc[day] = [];
    acc[day].push(entry);
    return acc;
  }, {}) ?? {};

  const days = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-history">Action History</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Every rename, organize, and status change — with one-click undo
          </p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => refetch()}>
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Loading history...</div>
      ) : !entries || entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <History className="w-12 h-12 text-muted-foreground/40" />
          <div className="text-lg font-semibold text-foreground">No actions yet</div>
          <div className="text-sm text-muted-foreground max-w-xs">
            Every rename, bulk organize, and duplicate resolution will appear here with a full undo trail.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <div key={day}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {format(new Date(day + "T12:00:00"), "EEEE, MMMM d, yyyy")}
              </div>
              <div className="space-y-2">
                {grouped[day].map((entry) => {
                  const config = ACTION_CONFIG[entry.action] ?? { label: entry.action, icon: History, color: "text-muted-foreground" };
                  const Icon = config.icon;
                  const canUndo = entry.action !== "undo" && (entry.oldStatus != null || entry.oldName != null) && entry.fileId != null;

                  return (
                    <div
                      key={entry.id}
                      className="flex items-center gap-4 bg-card border border-border rounded-lg px-4 py-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className={cn("shrink-0", config.color)}>
                        <Icon className="w-4 h-4" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn("text-xs font-semibold uppercase tracking-wide", config.color)}>
                            {config.label}
                          </span>
                          <span className="text-sm text-foreground font-medium truncate">
                            {entry.fileOriginalName}
                          </span>
                        </div>
                        {(entry.oldName || entry.newName) && (
                          <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                            {entry.oldName && <span className="line-through opacity-60">{entry.oldName}</span>}
                            {entry.oldName && entry.newName && <span className="mx-1.5">→</span>}
                            {entry.newName && <span className="text-primary">{entry.newName}</span>}
                          </div>
                        )}
                        {(entry.oldStatus || entry.newStatus) && !entry.oldName && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Status: {entry.oldStatus ?? "—"} → {entry.newStatus ?? "—"}
                          </div>
                        )}
                        {entry.notes && (
                          <div className="text-xs text-muted-foreground mt-0.5 italic">{entry.notes}</div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.performedAt), { addSuffix: true })}
                        </span>
                        {canUndo && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 h-7 text-xs"
                            disabled={undoing === entry.id}
                            onClick={() => handleUndo(entry.id, config.label)}
                          >
                            <Undo2 className="w-3 h-3" />
                            {undoing === entry.id ? "Undoing..." : "Undo"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
