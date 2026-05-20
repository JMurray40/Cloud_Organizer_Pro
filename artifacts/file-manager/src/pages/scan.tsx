import { useState, useRef } from "react";
import { useScanFiles, useCreateFile, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, FolderOpen, Scan, FileUp, X } from "lucide-react";

type ScanResultItem = {
  originalName: string;
  suggestedName: string;
  suggestedPath: string;
  category: string;
  subCategory?: string | null;
  isDuplicateRisk: boolean;
  explanation: string;
};

export default function ScanPage() {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ScanResultItem[]>([]);
  const [accepted, setAccepted] = useState<Set<number>>(new Set());
  const [csvFileName, setCsvFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const filenames: string[] = [];
      for (const line of lines) {
        const cols = line.split(",");
        const candidate = cols[0].replace(/^["']|["']$/g, "").trim();
        if (candidate && /\.\w{1,10}$/.test(candidate)) {
          filenames.push(candidate);
        }
      }
      if (filenames.length === 0) {
        toast({ title: "No filenames found", description: "CSV must have filenames with extensions in the first column.", variant: "destructive" });
        return;
      }
      setInput(filenames.join("\n"));
      setCsvFileName(file.name);
      toast({ title: `Imported ${filenames.length} filenames`, description: `From ${file.name}` });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const scanFiles = useScanFiles();
  const createFile = useCreateFile();

  const handleScan = () => {
    const filenames = input
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean);

    if (filenames.length === 0) {
      toast({ title: "No filenames entered", description: "Enter at least one filename to scan." });
      return;
    }

    scanFiles.mutate(
      { data: { filenames } },
      {
        onSuccess: (data) => {
          setResults(data);
          setAccepted(new Set());
        },
        onError: () => {
          toast({ title: "Scan failed", description: "Could not scan files. Please try again." });
        },
      }
    );
  };

  const handleAcceptAll = () => {
    Promise.all(
      results.map((r) =>
        createFile.mutateAsync({
          data: {
            originalName: r.originalName,
            category: r.category,
            subCategory: r.subCategory ?? undefined,
          },
        })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
      setAccepted(new Set(results.map((_, i) => i)));
      toast({ title: `${results.length} files added to tracking` });
    });
  };

  const handleAcceptOne = (index: number, result: ScanResultItem) => {
    createFile.mutate(
      {
        data: {
          originalName: result.originalName,
          category: result.category,
          subCategory: result.subCategory ?? undefined,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListFilesQueryKey() });
          setAccepted((prev) => new Set([...prev, index]));
          toast({ title: "File added to tracking" });
        },
      }
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-scan">Scan & Organize</h1>
        <p className="text-sm text-muted-foreground mt-1">Paste a list of filenames and get instant naming suggestions</p>
      </div>

      <div className="bg-card border border-card-border rounded-lg p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-sm font-medium text-foreground">Filenames to scan</label>
            <div className="flex items-center gap-2">
              {csvFileName && (
                <div className="flex items-center gap-1.5 text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                  <span>{csvFileName}</span>
                  <button onClick={() => { setInput(""); setCsvFileName(null); }} className="hover:text-primary/60">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1.5 h-7 text-xs"
                onClick={() => fileInputRef.current?.click()}
              >
                <FileUp className="w-3.5 h-3.5" />
                Import CSV
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvImport}
              />
            </div>
          </div>
          <Textarea
            data-testid="textarea-filenames"
            placeholder={"Q1 Sales Report.pdf\namazon receipt march 2024.pdf\nHawaii Vacation Photos.zip\ncontract acme corp.docx"}
            value={input}
            onChange={(e) => { setInput(e.target.value); setCsvFileName(null); }}
            rows={8}
            className="font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            One filename per line — or import a CSV file with filenames in the first column.
          </p>
        </div>
        <div className="flex justify-between items-center">
          <Button
            data-testid="button-scan"
            onClick={handleScan}
            disabled={scanFiles.isPending || !input.trim()}
            className="gap-2"
          >
            <Scan className="w-4 h-4" />
            {scanFiles.isPending ? "Scanning..." : "Scan Files"}
          </Button>
          {results.length > 0 && (
            <Button
              data-testid="button-accept-all"
              variant="outline"
              onClick={handleAcceptAll}
              disabled={createFile.isPending}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Accept All ({results.length})
            </Button>
          )}
        </div>
      </div>

      {results.length > 0 && (
        <div className="bg-card border border-card-border rounded-lg overflow-hidden">
          <div className="grid grid-cols-[1fr_1fr_120px_130px_100px] text-xs font-semibold text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
            <span>Original</span>
            <span>Suggested Name</span>
            <span>Folder</span>
            <span>Category / Confidence</span>
            <span>Action</span>
          </div>
          {results.map((result, i) => {
            const conf = (result as any).confidence as number | undefined;
            const confColor = conf == null ? "" : conf >= 80 ? "text-green-600" : conf >= 60 ? "text-yellow-600" : "text-red-500";
            return (
              <div
                key={i}
                data-testid={`scan-result-${i}`}
                className={`grid grid-cols-[1fr_1fr_120px_130px_100px] items-center px-4 py-3 border-b border-border last:border-0 transition-colors ${accepted.has(i) ? "bg-green-50 dark:bg-green-900/10" : "hover:bg-muted/20"}`}
              >
                <div className="min-w-0 pr-2">
                  <div className="text-sm font-medium text-foreground truncate">{result.originalName}</div>
                  {result.isDuplicateRisk && (
                    <div className="flex items-center gap-1 text-xs text-yellow-600 mt-0.5">
                      <AlertTriangle className="w-3 h-3" />
                      Possible duplicate
                    </div>
                  )}
                </div>
                <div className="min-w-0 pr-2">
                  <div className="text-xs font-mono text-primary truncate">{result.suggestedName}</div>
                </div>
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <FolderOpen className="w-3 h-3 shrink-0" />
                    <span className="truncate">{result.suggestedPath}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-foreground font-medium">{result.category}</div>
                  {result.subCategory && <div className="text-xs text-muted-foreground">{result.subCategory}</div>}
                  {conf != null && (
                    <div className={`text-xs font-semibold mt-0.5 ${confColor}`}>{conf}% confident</div>
                  )}
                </div>
                <div>
                  {accepted.has(i) ? (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Added
                    </span>
                  ) : (
                    <button
                      data-testid={`button-accept-${i}`}
                      onClick={() => handleAcceptOne(i, result)}
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Accept
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
