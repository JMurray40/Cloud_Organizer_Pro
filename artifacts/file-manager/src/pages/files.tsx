import { useState, useMemo } from "react";
import { useListFiles, useUpdateFile, useDeleteFile, useListCloudAccounts, getListFilesQueryKey, getGetDashboardStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Search, Trash2, CheckCircle2, MinusCircle, Copy, Play, Download, Square, SquareCheck, ArrowUpDown, ArrowUp, ArrowDown, FileDown, FolderOpen, MoveRight, HardDrive } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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
  const [accountFilter, setAccountFilter] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return p.get("account") ?? "_all";
  });
  const [moveDialog, setMoveDialog] = useState<{ fileId: number; fileName: string } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [sortField, setSortField] = useState<"originalName" | "category" | "status" | "createdAt">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts } = useListCloudAccounts();
  const accountMap = useMemo(
    () => new Map((accounts ?? []).map((a) => [a.id, a])),
    [accounts]
  );

  const params = {
    ...(search ? { search } : {}),
    ...(category && category !== "_all" ? { category } : {}),
    ...(status && status !== "_all" ? { status } : {}),
    ...(accountFilter === "_unassigned"
      ? { cloudAccountId: null as unknown as number }
      : accountFilter && accountFilter !== "_all"
      ? { cloudAccountId: parseInt(accountFilter) }
      : {}),
  };

  const { data: files, isLoading } = useListFiles(Object.keys(params).length ? params : undefined);
  const updateFile = useUpdateFile();
  const deleteFile = useDeleteFile();

  const sortedFiles = useMemo(() => {
    if (!files) return [];
    return [...files].sort((a, b) => {
      let av = a[sortField] ?? "";
      let bv = b[sortField] ?? "";
      if (typeof av === "string") av = av.toLowerCase();
      if (typeof bv === "string") bv = bv.toLowerCase();
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
  }, [files, sortField, sortDir]);

  const toggleSort = (field: typeof sortField) => {
    setPage(1);
    if (sortField === field) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const totalPages = Math.max(1, Math.ceil(sortedFiles.length / PAGE_SIZE));
  const pagedFiles = sortedFiles.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc" ? <ArrowUp className="w-3 h-3 ml-1 text-primary" /> : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  const handleExportCSV = () => {
    if (!files || files.length === 0) return;
    const headers = ["ID", "Original Name", "Suggested Name", "Category", "Sub-Category", "Suggested Path", "Status", "File Size", "Extension", "Date Added"];
    const rows = files.map((f) => [
      f.id,
      `"${f.originalName.replace(/"/g, '""')}"`,
      `"${f.suggestedName.replace(/"/g, '""')}"`,
      f.category,
      f.subCategory ?? "",
      `"${f.suggestedPath.replace(/"/g, '""')}"`,
      f.status,
      f.fileSize ?? "",
      f.fileExtension,
      format(new Date(f.createdAt), "yyyy-MM-dd"),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fileorbit-files-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exported", description: `${files.length} files exported` });
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
    queryClient.invalidateQueries({ queryKey: getGetDashboardStatsQueryKey() });
  };

  const handleMoveToAccount = (fileId: number, newAccountId: number | null) => {
    updateFile.mutate(
      { id: fileId, data: { cloudAccountId: newAccountId } },
      {
        onSuccess: () => {
          invalidate();
          setMoveDialog(null);
          const accountName = newAccountId ? (accountMap.get(newAccountId)?.name ?? "account") : "unassigned";
          toast({ title: "File moved", description: `Now linked to ${accountName}` });
        },
        onError: () => {
          toast({ title: "Move failed", description: "Could not reassign the file. Please try again.", variant: "destructive" });
        },
      }
    );
  };

  const handleStatusChange = (id: number, newStatus: string) => {
    updateFile.mutate(
      { id, data: { status: newStatus } },
      { onSuccess: () => { invalidate(); toast({ title: "Status updated" }); } }
    );
  };

  const handleDelete = (id: number) => {
    deleteFile.mutate(
      { id },
      { onSuccess: () => { invalidate(); setSelected((s) => { const n = new Set(s); n.delete(id); return n; }); toast({ title: "File removed" }); } }
    );
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!files) return;
    const pending = files.filter((f) => f.status !== "organized").map((f) => f.id);
    if (selected.size === pending.length && pending.every((id) => selected.has(id))) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pending));
    }
  };

  const handleBulkRename = async (action: "apply" | "download-script") => {
    if (selected.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch(`${BASE}/api/files/bulk-rename`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [...selected], action }),
      });
      const data = await res.json();

      if (action === "apply") {
        invalidate();
        setSelected(new Set());
        toast({ title: `Applied ${data.updated} rename${data.updated !== 1 ? "s" : ""}`, description: data.skipped > 0 ? `${data.skipped} file(s) skipped (already organized)` : undefined });
      } else if (action === "download-script" && data.script) {
        const blob = new Blob([data.script], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `fileorbit-rename-${Date.now()}.sh`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Rename script downloaded", description: `${data.updated} rename command(s) included` });
      }
    } catch {
      toast({ title: "Bulk rename failed", variant: "destructive" });
    } finally {
      setBulkLoading(false);
    }
  };

  const pendingFiles = files?.filter((f) => f.status !== "organized") ?? [];
  const allPendingSelected = pendingFiles.length > 0 && pendingFiles.every((f) => selected.has(f.id));

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-files">Files</h1>
          <p className="text-sm text-muted-foreground mt-1">All tracked file records with suggested names and paths</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 h-8 text-xs"
            onClick={handleExportCSV}
            disabled={!files || files.length === 0}
          >
            <FileDown className="w-3.5 h-3.5" />
            Export CSV
          </Button>
        </div>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
            <span className="text-sm font-medium text-primary">{selected.size} selected</span>
            <Button
              size="sm"
              variant="default"
              className="gap-1.5 h-7 text-xs"
              disabled={bulkLoading}
              onClick={() => handleBulkRename("apply")}
            >
              <Play className="w-3.5 h-3.5" />
              Apply Renames
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 h-7 text-xs"
              disabled={bulkLoading}
              onClick={() => handleBulkRename("download-script")}
            >
              <Download className="w-3.5 h-3.5" />
              Download Script
            </Button>
            <button
              className="text-xs text-muted-foreground hover:text-foreground ml-1"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Quick filter presets */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {(
          [
            { label: "All", s: "", c: "" },
            { label: "Pending", s: "pending", c: "" },
            { label: "Organized", s: "organized", c: "" },
            { label: "Duplicates", s: "duplicate", c: "" },
            { label: "Ignored", s: "ignored", c: "" },
          ] as { label: string; s: string; c: string }[]
        ).map(({ label, s, c }) => (
          <button
            key={label}
            onClick={() => { setStatus(s); setCategory(c); setPage(1); }}
            className={cn(
              "px-3 py-1 text-xs rounded-full border font-medium transition-colors",
              status === s && (c === "" || category === c)
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
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
        {accounts && accounts.length > 0 && (
          <Select value={accountFilter} onValueChange={(v) => { setAccountFilter(v); setPage(1); }}>
            <SelectTrigger className="w-44" data-testid="select-account-filter">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">All Accounts</SelectItem>
              <SelectItem value="_unassigned">Unassigned</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[32px_1fr_1fr_100px_110px_90px_110px_90px] text-xs font-semibold text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
          <button
            onClick={toggleSelectAll}
            title={allPendingSelected ? "Deselect all" : "Select all pending"}
            className="flex items-center text-muted-foreground hover:text-foreground"
          >
            {allPendingSelected ? <SquareCheck className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
          </button>
          <button onClick={() => toggleSort("originalName")} className="flex items-center hover:text-foreground text-left">
            Original Name <SortIcon field="originalName" />
          </button>
          <span>Suggested Name</span>
          <button onClick={() => toggleSort("category")} className="flex items-center hover:text-foreground text-left">
            Category <SortIcon field="category" />
          </button>
          <span>Suggested Path</span>
          <button onClick={() => toggleSort("status")} className="flex items-center hover:text-foreground text-left">
            Status <SortIcon field="status" />
          </button>
          <span>Account</span>
          <span>Actions</span>
        </div>
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading files...</div>
        ) : pagedFiles.length > 0 ? (
          pagedFiles.map((file) => {
            const isSelected = selected.has(file.id);
            return (
              <div
                key={file.id}
                data-testid={`row-file-${file.id}`}
                className={cn(
                  "grid grid-cols-[32px_1fr_1fr_100px_110px_90px_110px_90px] items-center px-4 py-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors",
                  isSelected && "bg-primary/5"
                )}
              >
                <button
                  onClick={() => toggleSelect(file.id)}
                  disabled={file.status === "organized"}
                  className="flex items-center text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isSelected ? <SquareCheck className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                </button>
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
                <div className="min-w-0">
                  {file.cloudAccountId != null ? (
                    <span className="text-xs text-foreground truncate block">
                      {accountMap.get(file.cloudAccountId)?.name ?? `Account #${file.cloudAccountId}`}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground/60 italic">Unassigned</span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {accounts && accounts.length > 0 && (
                    <button
                      data-testid={`button-move-${file.id}`}
                      onClick={() => setMoveDialog({ fileId: file.id, fileName: file.originalName })}
                      className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-primary transition-colors"
                      title="Move to account"
                    >
                      <MoveRight className="w-4 h-4" />
                    </button>
                  )}
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
            );
          })
        ) : (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <FolderOpen className="w-10 h-10 text-muted-foreground/40" />
            <div className="text-sm font-medium text-foreground">No files found</div>
            <div className="text-xs text-muted-foreground max-w-xs">
              {search || category || status
                ? "Try adjusting your search or filters."
                : "Use the Scan page to analyse existing filenames, or drag files into the Drop Zone."}
            </div>
          </div>
        )}

        {sortedFiles.length > PAGE_SIZE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <span className="text-xs text-muted-foreground">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, sortedFiles.length)} of {sortedFiles.length} files
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >«</button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >‹ Prev</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i;
                return (
                  <button
                    key={pg}
                    onClick={() => setPage(pg)}
                    className={`px-2.5 py-1 text-xs rounded border transition-colors ${pg === page ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}
                  >{pg}</button>
                );
              })}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >Next ›</button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-border disabled:opacity-40 hover:bg-muted transition-colors"
              >»</button>
            </div>
          </div>
        )}
      </div>

      {/* Move to account dialog */}
      <Dialog open={moveDialog != null} onOpenChange={(v) => { if (!v) setMoveDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MoveRight className="w-4 h-4 text-primary" />
              Move to account
            </DialogTitle>
            {moveDialog && (
              <p className="text-xs text-muted-foreground truncate pt-1">
                {moveDialog.fileName}
              </p>
            )}
          </DialogHeader>
          <div className="space-y-2 py-1">
            <button
              onClick={() => moveDialog && handleMoveToAccount(moveDialog.fileId, null)}
              disabled={updateFile.isPending}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-muted/60 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <HardDrive className="w-4 h-4 text-muted-foreground" />
              </div>
              <span className="text-sm text-muted-foreground italic">Unassigned</span>
            </button>
            {(accounts ?? []).map((a) => (
              <button
                key={a.id}
                onClick={() => moveDialog && handleMoveToAccount(moveDialog.fileId, a.id)}
                disabled={!a.isActive || updateFile.isPending}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-colors text-left",
                  a.isActive && !updateFile.isPending
                    ? "border-border hover:border-primary/30 hover:bg-primary/5"
                    : "border-border opacity-50 cursor-not-allowed"
                )}
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <HardDrive className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{a.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{a.accountLabel}</div>
                </div>
                {!a.isActive && <span className="text-xs text-muted-foreground">Inactive</span>}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
