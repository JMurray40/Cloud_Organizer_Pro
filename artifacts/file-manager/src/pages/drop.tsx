import { useState, useCallback } from "react";
import { useSuggestFileName, useCreateFile, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FolderOpen, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  accepted?: boolean;
};

export default function DropPage() {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState<DroppedFile[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const suggestName = useSuggestFileName();
  const createFile = useCreateFile();

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

      const suggestion = await suggestName.mutateAsync({
        data: { originalName: file.name, category },
      }).catch(() => null);

      if (suggestion) {
        setFiles((prev) =>
          prev.map((f) =>
            f.name === file.name && !f.suggestion
              ? { ...f, suggestion: { ...suggestion, subCategory: suggestion.subCategory ?? null } }
              : f
          )
        );
      }
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
    createFile.mutate(
      {
        data: {
          originalName: file.name,
          category: file.suggestion.category,
          subCategory: file.suggestion.subCategory ?? undefined,
          fileSize: file.size,
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
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-drop">Drop Zone</h1>
        <p className="text-sm text-muted-foreground mt-1">Drop files here to instantly get naming suggestions</p>
      </div>

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
