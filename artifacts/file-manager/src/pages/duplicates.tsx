import { useState, useMemo } from "react";
import { useGetDuplicates, useUpdateFile, useDeleteFile, getGetDuplicatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Trash2, GitMerge, Copy, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || bytes === 0) return "Unknown size";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    organized: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    duplicate: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
    renamed: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    ignored: "bg-muted text-muted-foreground",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", colors[status] ?? "bg-muted text-muted-foreground")}>
      {status}
    </span>
  );
}

export default function DuplicatesPage() {
  const { data: groups, isLoading } = useGetDuplicates();
  const queryClient = useQueryClient();
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();
  const { toast } = useToast();
  const [resolving, setResolving] = useState<number | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetDuplicatesQueryKey() });
  };

  const savings = useMemo(() => {
    if (!groups || groups.length === 0) return { bytes: 0, count: 0 };
    let bytes = 0;
    let count = 0;
    for (const group of groups) {
      const sorted = [...group.files].sort((a, b) => (b.fileSize ?? 0) - (a.fileSize ?? 0));
      for (let i = 1; i < sorted.length; i++) {
        bytes += sorted[i].fileSize ?? 0;
        count += 1;
      }
    }
    return { bytes, count };
  }, [groups]);

  const handleKeep = (id: number, groupFileIds: number[]) => {
    setResolving(id);
    const toDelete = groupFileIds.filter((fid) => fid !== id);
    Promise.all(toDelete.map((fid) => deleteFile.mutateAsync({ id: fid })))
      .then(() => {
        updateFile.mutate(
          { id, data: { status: "organized", isDuplicate: false } },
          {
            onSuccess: () => {
              invalidate();
              toast({ title: "Duplicate resolved", description: `Kept file #${id}, removed ${toDelete.length} duplicate(s).` });
              setResolving(null);
            },
          }
        );
      })
      .catch(() => {
        toast({ title: "Error resolving duplicates", variant: "destructive" });
        setResolving(null);
      });
  };

  const handleMarkIgnored = (id: number) => {
    updateFile.mutate(
      { id, data: { status: "ignored" } },
      { onSuccess: () => { invalidate(); toast({ title: "File marked as ignored" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteFile.mutate(
      { id },
      { onSuccess: () => { invalidate(); toast({ title: "File deleted" }); } }
    );
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-duplicates">
          Duplicate Files
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Review groups of similar files and resolve conflicts
        </p>
      </div>

      {isLoading ? (
        <div className="py-16 text-center text-muted-foreground text-sm">Scanning for duplicates...</div>
      ) : !groups || groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <CheckCircle className="w-12 h-12 text-primary opacity-60" />
          <div className="text-lg font-semibold text-foreground">No duplicates found</div>
          <div className="text-sm text-muted-foreground max-w-xs">
            All your tracked files look unique. Add more files or run a scan to check for new duplicates.
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {savings.count > 0 && (
            <div className="flex items-center gap-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl px-5 py-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center shrink-0">
                <HardDrive className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">
                  {formatBytes(savings.bytes)} recoverable space
                </div>
                <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                  Resolving {savings.count} duplicate file{savings.count !== 1 ? "s" : ""} across {groups.length} group{groups.length !== 1 ? "s" : ""} would free this storage
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {groups.map((group) => {
              const fileIds = group.files.map((f) => f.id);
              return (
                <div key={group.groupKey} className="border border-border rounded-xl overflow-hidden">
                  <div className="bg-muted/50 px-4 py-3 flex items-center justify-between border-b border-border">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-semibold text-foreground">{group.groupKey}</span>
                      <span className="text-xs text-muted-foreground">— {group.reason}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{group.files.length} versions</span>
                  </div>

                  <div className="divide-y divide-border">
                    {group.files.map((file) => (
                      <div key={file.id} className="p-4 flex items-start gap-4">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground truncate max-w-sm">
                              {file.originalName}
                            </span>
                            <StatusBadge status={file.status} />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {file.category}{file.subCategory ? ` / ${file.subCategory}` : ""}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{formatBytes(file.fileSize)}</span>
                            <span>·</span>
                            <span>Added {format(new Date(file.createdAt), "MMM d, yyyy")}</span>
                          </div>
                          <div className="mt-1 font-mono text-xs text-primary/80 bg-muted/60 px-2 py-1 rounded inline-block max-w-full truncate">
                            → {file.suggestedName}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1 text-xs"
                            disabled={resolving === file.id}
                            onClick={() => handleKeep(file.id, fileIds)}
                            title="Keep this file and remove the others in this group"
                          >
                            <GitMerge className="w-3.5 h-3.5" />
                            Keep This
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => handleMarkIgnored(file.id)}
                            title="Mark as ignored"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            Ignore
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="gap-1 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => handleDelete(file.id)}
                            title="Delete this file record"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
