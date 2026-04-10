import { useState } from "react";
import { useListFiles, useUpdateFile, useDeleteFile, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, CheckCircle2, MinusCircle, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  organized: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  renamed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  duplicate: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  ignored: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const CATEGORIES = ["", "Work", "Finance", "Personal", "Projects", "Media", "Archives"];
const STATUSES = ["", "pending", "organized", "renamed", "duplicate", "ignored"];

export default function FilesPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const params = {
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
    ...(status ? { status } : {}),
  };

  const { data: files, isLoading } = useListFiles(Object.keys(params).length ? params : undefined);
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();

  const handleStatusChange = (id: number, newStatus: string) => {
    updateFile.mutate(
      { id, data: { status: newStatus } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          toast({ title: "Status updated" });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteFile.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          toast({ title: "File removed" });
        },
      }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-files">Files</h1>
        <p className="text-sm text-muted-foreground mt-1">All tracked file records with suggested names and paths</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            data-testid="input-search"
            placeholder="Search files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-40" data-testid="select-category">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c || "_all"}>{c || "All Categories"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-36" data-testid="select-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s || "_all"}>{s || "All Statuses"}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_100px_120px_80px_100px] text-xs font-semibold text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
          <span>Original Name</span>
          <span>Suggested Name</span>
          <span>Category</span>
          <span>Suggested Path</span>
          <span>Status</span>
          <span>Actions</span>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading files...</div>
        ) : files && files.length > 0 ? (
          files.map((file) => (
            <div
              key={file.id}
              data-testid={`row-file-${file.id}`}
              className="grid grid-cols-[1fr_1fr_100px_120px_80px_100px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-sm text-foreground truncate font-medium">{file.originalName}</div>
                {file.isDuplicate && (
                  <span className="text-xs text-red-500 flex items-center gap-1">
                    <Copy className="w-3 h-3" /> Duplicate risk
                  </span>
                )}
              </div>
              <div className="min-w-0 pr-2">
                <button
                  onClick={() => copyToClipboard(file.suggestedName)}
                  data-testid={`button-copy-name-${file.id}`}
                  className="text-xs text-primary font-mono truncate block hover:underline text-left w-full"
                  title="Click to copy"
                >
                  {file.suggestedName}
                </button>
              </div>
              <div>
                <span className="text-xs text-foreground">{file.category}</span>
                {file.subCategory && <div className="text-xs text-muted-foreground">{file.subCategory}</div>}
              </div>
              <div>
                <button
                  onClick={() => copyToClipboard(file.suggestedPath)}
                  data-testid={`button-copy-path-${file.id}`}
                  className="text-xs text-muted-foreground font-mono truncate hover:text-primary block w-full text-left"
                  title="Click to copy"
                >
                  {file.suggestedPath}
                </button>
              </div>
              <div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[file.status] ?? STATUS_COLORS.ignored}`}>
                  {file.status}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {file.status !== "organized" && (
                  <button
                    data-testid={`button-organize-${file.id}`}
                    onClick={() => handleStatusChange(file.id, "organized")}
                    className="p-1.5 rounded hover:bg-green-100 dark:hover:bg-green-900/20 text-muted-foreground hover:text-green-600 transition-colors"
                    title="Mark as organized"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                )}
                {file.status !== "ignored" && (
                  <button
                    data-testid={`button-ignore-${file.id}`}
                    onClick={() => handleStatusChange(file.id, "ignored")}
                    className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    title="Mark as ignored"
                  >
                    <MinusCircle className="w-4 h-4" />
                  </button>
                )}
                <button
                  data-testid={`button-delete-${file.id}`}
                  onClick={() => handleDelete(file.id)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                  title="Remove record"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center text-muted-foreground text-sm">
            No files found. Use Scan or Drop Zone to add files.
          </div>
        )}
      </div>
    </div>
  );
}
