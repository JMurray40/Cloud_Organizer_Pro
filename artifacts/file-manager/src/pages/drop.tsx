import { useState, useCallback } from "react";
import {
  useSuggestFileName,
  useCreateFile,
  useListCloudAccounts,
  useGetPlacementRecommendation,
  getListFilesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FolderOpen, CheckCircle2, X, HardDrive, Lightbulb, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type DroppedFile = {
  name: string;
  size: number;
  suggestion?: {
    suggestedName: string;
    suggestedPath: string;
    category: string;
    subCategory?: string | null;
    explanation: string;
  };
  suggestionError?: boolean;
  accepted?: boolean;
};

function MiniStorageBar({ used, total, highlight }: { used: number | null; total: number | null; highlight?: boolean }) {
  if (used == null || total == null || total === 0) return null;
  const pct = Math.min(100, (used / total) * 100);
  const color = highlight ? "bg-primary" : pct > 90 ? "bg-red-400" : pct > 75 ? "bg-yellow-400" : "bg-muted-foreground/40";
  return (
    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function DropPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("_none");
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const suggestName = useSuggestFileName();
  const createFile = useCreateFile();
  const { data: accounts } = useListCloudAccounts();

  const totalSizeGb = files.reduce((sum, f) => sum + f.size, 0) / 1e9;
  const activeAccounts = accounts?.filter((a) => a.isActive) ?? [];

  const { data: placement } = useGetPlacementRecommendation(
    totalSizeGb > 0 ? { fileSizeGb: parseFloat(totalSizeGb.toFixed(6)) } : {},
    { query: { enabled: activeAccounts.length > 0 } },
  );

  const accountsWithQuota = placement?.accounts.filter((a) => a.freeGb != null) ?? [];

  const processFiles = useCallback(async (fileList: FileList) => {
    const newFiles: DroppedFile[] = Array.from(fileList).map((f) => ({
      name: f.name,
      size: f.size,
    }));
    setFiles((prev) => [...prev, ...newFiles]);

    for (let i = 0; i < newFiles.length; i++) {
      const file = newFiles[i];
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      let category = "Work";
      if (["jpg", "jpeg", "png", "gif", "webp", "heic"].includes(ext)) category = "Personal";
      else if (["mp4", "mov", "avi", "mkv"].includes(ext)) category = "Media";
      else if (["mp3", "wav", "flac"].includes(ext)) category = "Media";

      let suggestion = null;
      let suggestionError = false;
      try {
        suggestion = await suggestName.mutateAsync({ data: { originalName: file.name, category } });
      } catch {
        suggestionError = true;
      }

      setFiles((prev) =>
        prev.map((f) =>
          f.name === file.name && !f.suggestion && !f.suggestionError
            ? suggestion
              ? { ...f, suggestion: { ...suggestion, subCategory: suggestion.subCategory ?? null } }
              : { ...f, suggestionError }
            : f
        )
      );
    }
  }, [suggestName]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      await processFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(e.target.files);
    }
  };

  const handleAccept = (file: DroppedFile) => {
    if (!file.suggestion) return;
    const accountId = selectedAccountId !== "_none" ? parseInt(selectedAccountId) : undefined;
    createFile.mutate(
      {
        data: {
          originalName: file.name,
          category: file.suggestion.category,
          subCategory: file.suggestion.subCategory ?? undefined,
          fileSize: file.size,
          ...(accountId != null ? { cloudAccountId: accountId } : {}),
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          setFiles((prev) =>
            prev.map((f) => (f.name === file.name ? { ...f, accepted: true } : f))
          );
          toast({ title: "File added to tracking" });
        },
      }
    );
  };

  const handleRemove = (name: string) => {
    setFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div className="px-4 py-4 md:px-6 md:py-6 space-y-4 md:space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground" data-testid="page-title-drop">Drop Zone</h1>
        <p className="text-sm text-muted-foreground mt-1">Drop files here to instantly get naming suggestions</p>
      </div>

      {/* Account selector */}
      {activeAccounts.length > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4">
          <label className="text-sm font-medium text-foreground block mb-2">
            Which account are these files from?
          </label>
          <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
            <SelectTrigger className="w-72" data-testid="select-drop-account">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">
                <span className="flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-muted-foreground" />
                  Not assigned to an account
                </span>
              </SelectItem>
              {activeAccounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.name} <span className="text-muted-foreground ml-1">({a.accountLabel})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1.5">
            Assigning an account makes it easy to filter and manage files per storage service.
          </p>
        </div>
      )}

      {/* Placement Advisor */}
      {accountsWithQuota.length > 0 && placement && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-3" data-testid="placement-advisor">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-primary shrink-0" />
            <span className="text-sm font-medium text-foreground">Placement Advisor</span>
            {files.length > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {formatSize(files.reduce((s, f) => s + f.size, 0))} total
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{placement.reason}</p>
          <div className="space-y-2">
            {accountsWithQuota.map((account) => {
              const isRecommended = account.id === placement.recommendedAccountId;
              const pct = account.percentUsed ?? 0;
              const isSelected = String(account.id) === selectedAccountId;
              return (
                <div
                  key={account.id}
                  data-testid={`placement-account-${account.id}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                    isRecommended
                      ? "bg-primary/5 ring-1 ring-primary/25"
                      : "hover:bg-muted/30"
                  )}
                >
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      {isRecommended && (
                        <Star className="w-3 h-3 text-primary shrink-0 fill-primary" />
                      )}
                      <span className={cn("text-xs font-medium truncate", isRecommended ? "text-primary" : "text-foreground")}>
                        {account.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                        {account.freeGb != null ? `${account.freeGb.toFixed(1)} GB free` : ""}
                      </span>
                    </div>
                    <MiniStorageBar
                      used={account.quotaUsedGb ?? null}
                      total={account.quotaTotalGb ?? null}
                      highlight={isRecommended}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{pct.toFixed(0)}% used</span>
                      {account.quotaTotalGb != null && (
                        <span>{account.quotaTotalGb} GB total</span>
                      )}
                    </div>
                  </div>
                  {isRecommended && !isSelected && (
                    <Button
                      data-testid={`button-use-account-${account.id}`}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0"
                      onClick={() => setSelectedAccountId(String(account.id))}
                    >
                      Use this
                    </Button>
                  )}
                  {isSelected && (
                    <span className="text-[10px] text-primary shrink-0 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Selected
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div
        data-testid="drop-zone"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-xl p-12 text-center transition-all",
          isDragging
            ? "border-primary bg-accent/50 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-muted/20"
        )}
      >
        <div className="flex flex-col items-center gap-3">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
            isDragging ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
          )}>
            <Upload className="w-7 h-7" />
          </div>
          <div>
            <p className="text-base font-medium text-foreground">
              {isDragging ? "Release to analyze files" : "Drop files here"}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              or{" "}
              <label className="text-primary cursor-pointer hover:underline">
                browse files
                <input
                  data-testid="input-file-browse"
                  type="file"
                  multiple
                  className="hidden"
                  onChange={handleFileInput}
                />
              </label>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">Any file type — naming suggestions are generated instantly</p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-foreground">{files.length} file(s) analyzed</span>
            <button
              data-testid="button-clear-all"
              onClick={() => setFiles([])}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
          {files.map((file, i) => (
            <div
              key={i}
              data-testid={`drop-result-${i}`}
              className={cn(
                "px-4 py-3 border-b border-border last:border-0 transition-colors",
                file.accepted ? "bg-green-50 dark:bg-green-900/10" : "hover:bg-muted/20"
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{file.name}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{formatSize(file.size)}</span>
                  </div>
                  {file.suggestion ? (
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Rename to:</span>
                        <span className="text-xs font-mono text-primary">{file.suggestion.suggestedName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FolderOpen className="w-3 h-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{file.suggestion.suggestedPath}</span>
                      </div>
                    </div>
                  ) : file.suggestionError ? (
                    <div className="text-xs text-red-500">Could not generate suggestion — remove and retry.</div>
                  ) : (
                    <div className="text-xs text-muted-foreground animate-pulse">Generating suggestion...</div>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {file.accepted ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Added
                    </span>
                  ) : (
                    file.suggestion && (
                      <Button
                        data-testid={`button-accept-drop-${i}`}
                        size="sm"
                        variant="outline"
                        onClick={() => handleAccept(file)}
                        className="h-7 text-xs"
                      >
                        Accept
                      </Button>
                    )
                  )}
                  <button
                    data-testid={`button-remove-${i}`}
                    onClick={() => handleRemove(file.name)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
