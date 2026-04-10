import { useState } from "react";
import { useScanFiles, useCreateFile, getListFilesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, CheckCircle2, FolderOpen, Scan } from "lucide-react";

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
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
          <label className="text-sm font-medium text-foreground mb-1.5 block">Filenames to scan</label>
          <Textarea
            data-testid="textarea-filenames"
            placeholder={"Q1 Sales Report.pdf\namazon receipt march 2024.pdf\nHawaii Vacation Photos.zip\ncontract acme corp.docx"}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            rows={8}
            className="font-mono text-sm resize-none"
          />
          <p className="text-xs text-muted-foreground mt-1.5">One filename per line. Include the file extension.</p>
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
          <div className="grid grid-cols-[1fr_1fr_120px_110px_100px] text-xs font-semibold text-muted-foreground bg-muted/40 px-4 py-2.5 border-b border-border">
            <span>Original</span>
            <span>Suggested Name</span>
            <span>Folder</span>
            <span>Category</span>
            <span>Action</span>
          </div>
          {results.map((result, i) => (
            <div
              key={i}
              data-testid={`scan-result-${i}`}
              className={`grid grid-cols-[1fr_1fr_120px_110px_100px] items-center px-4 py-3 border-b border-border last:border-0 transition-colors ${accepted.has(i) ? "bg-green-50 dark:bg-green-900/10" : "hover:bg-muted/20"}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
