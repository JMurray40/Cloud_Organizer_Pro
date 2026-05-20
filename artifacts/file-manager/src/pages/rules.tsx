import { useState, useRef } from "react";
import { useListRules, useCreateRule, useUpdateRule, useDeleteRule, getListRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, GripVertical, Power, BookOpen, Sparkles, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const ruleSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  pattern: z.string().min(1, "Pattern is required"),
  folderPath: z.string().min(1, "Folder path is required"),
  extensions: z.string().min(1, "Extensions are required"),
  priority: z.coerce.number().default(0),
});

const CATEGORIES = ["Work", "Finance", "Personal", "Projects", "Media", "Archives"];

const CATEGORY_COLORS: Record<string, string> = {
  Work: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  Finance: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  Personal: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  Projects: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Media: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  Archives: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

type StarterRule = {
  name: string;
  category: string;
  pattern: string;
  folderPath: string;
  extensions: string;
  priority: number;
  isActive: boolean;
  description: string;
};

const STARTER_RULES: StarterRule[] = [
  {
    name: "Work Documents",
    category: "Work",
    pattern: "{YYYY-MM-DD}_Work_{Description}_{version}",
    folderPath: "Documents/Work/",
    extensions: "pdf,doc,docx,odt,txt",
    priority: 50,
    isActive: true,
    description: "PDFs, Word docs, and text files from work",
  },
  {
    name: "Work Spreadsheets",
    category: "Work",
    pattern: "{YYYY-MM-DD}_Work_Spreadsheets_{Description}_{version}",
    folderPath: "Documents/Work/Spreadsheets/",
    extensions: "xls,xlsx,ods,csv",
    priority: 45,
    isActive: true,
    description: "Excel files, CSVs, and data exports",
  },
  {
    name: "Work Presentations",
    category: "Work",
    pattern: "{YYYY-MM-DD}_Work_Presentations_{Description}_{version}",
    folderPath: "Documents/Work/Presentations/",
    extensions: "ppt,pptx,odp",
    priority: 44,
    isActive: true,
    description: "PowerPoint decks and slide presentations",
  },
  {
    name: "Invoices & Receipts",
    category: "Finance",
    pattern: "{YYYY-MM-DD}_Finance_Invoices_{Description}_{version}",
    folderPath: "Documents/Finance/Invoices/",
    extensions: "pdf,jpg,jpeg,png",
    priority: 40,
    isActive: true,
    description: "Invoice PDFs and scanned/photo receipts",
  },
  {
    name: "Bank Statements",
    category: "Finance",
    pattern: "{YYYY-MM-DD}_Finance_Statements_{Description}_{version}",
    folderPath: "Documents/Finance/Statements/",
    extensions: "pdf,csv",
    priority: 39,
    isActive: true,
    description: "Monthly bank and credit card statements",
  },
  {
    name: "Personal Documents",
    category: "Personal",
    pattern: "{YYYY-MM-DD}_Personal_{Description}_{version}",
    folderPath: "Documents/Personal/",
    extensions: "pdf,doc,docx",
    priority: 20,
    isActive: true,
    description: "Personal letters, contracts, and ID scans",
  },
  {
    name: "Project Notes",
    category: "Projects",
    pattern: "{YYYY-MM-DD}_Projects_{Description}_{version}",
    folderPath: "Documents/Projects/",
    extensions: "md,txt,json,yaml,yml",
    priority: 15,
    isActive: true,
    description: "README files, notes, and config documents",
  },
  {
    name: "Photos",
    category: "Media",
    pattern: "{YYYY-MM-DD}_Media_Photos_{Description}",
    folderPath: "Media/Photos/",
    extensions: "jpg,jpeg,png,heic,webp,gif",
    priority: 30,
    isActive: true,
    description: "Camera photos and downloaded images",
  },
  {
    name: "Videos",
    category: "Media",
    pattern: "{YYYY-MM-DD}_Media_Videos_{Description}",
    folderPath: "Media/Videos/",
    extensions: "mp4,mov,avi,mkv,m4v",
    priority: 29,
    isActive: true,
    description: "Screen recordings, exports, and clips",
  },
  {
    name: "Archives & Backups",
    category: "Archives",
    pattern: "{YYYY-MM-DD}_Archives_{Description}_{version}",
    folderPath: "Archives/",
    extensions: "zip,tar,gz,rar,7z",
    priority: 10,
    isActive: true,
    description: "Compressed files and project backups",
  },
];

type Rule = {
  id: number;
  name: string;
  category: string;
  pattern: string;
  folderPath: string;
  extensions: string;
  priority: number;
  isActive: boolean;
};

function StarterRulesDialog({
  open,
  onClose,
  onImport,
  importing,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (rules: StarterRule[]) => void;
  importing: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(STARTER_RULES.map((r) => r.name))
  );

  const allSelected = selected.size === STARTER_RULES.length;

  const toggle = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(STARTER_RULES.map((r) => r.name)));
  };

  const grouped = CATEGORIES.reduce<Record<string, StarterRule[]>>((acc, cat) => {
    const rules = STARTER_RULES.filter((r) => r.category === cat);
    if (rules.length) acc[cat] = rules;
    return acc;
  }, {});

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Starter Rules
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Select the rules to import. You can edit or delete them at any time.
          </p>
        </DialogHeader>

        <div className="flex items-center justify-between py-1 border-b border-border">
          <span className="text-xs text-muted-foreground">{selected.size} of {STARTER_RULES.length} selected</span>
          <button
            onClick={toggleAll}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5" /> : <Square className="w-3.5 h-3.5" />}
            {allSelected ? "Deselect all" : "Select all"}
          </button>
        </div>

        <div className="overflow-y-auto flex-1 space-y-4 py-1 pr-1">
          {Object.entries(grouped).map(([category, rules]) => (
            <div key={category}>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-1">
                {category}
              </div>
              <div className="space-y-1.5">
                {rules.map((rule) => {
                  const isSelected = selected.has(rule.name);
                  return (
                    <button
                      key={rule.name}
                      onClick={() => toggle(rule.name)}
                      className={cn(
                        "w-full text-left flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        isSelected
                          ? "border-primary/30 bg-primary/5"
                          : "border-border bg-background hover:bg-muted/50"
                      )}
                    >
                      <div className={cn(
                        "w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                        isSelected ? "border-primary bg-primary" : "border-muted-foreground/40"
                      )}>
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-primary-foreground" fill="none" viewBox="0 0 10 10">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">{rule.name}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded-full font-medium", CATEGORY_COLORS[rule.category])}>
                            {rule.category}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">{rule.description}</div>
                        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                            {rule.folderPath}
                          </span>
                          <span className="text-xs text-muted-foreground">{rule.extensions}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter className="pt-2 border-t border-border">
          <Button type="button" variant="outline" onClick={onClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={() => onImport(STARTER_RULES.filter((r) => selected.has(r.name)))}
            disabled={selected.size === 0 || importing}
            className="gap-1.5"
          >
            {importing ? "Importing…" : `Import ${selected.size} rule${selected.size !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function RulesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStarterOpen, setIsStarterOpen] = useState(false);
  const [starterImporting, setStarterImporting] = useState(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<number[] | null>(null);
  const draggedRef = useRef<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: rules, isLoading } = useListRules();
  const createRule = useCreateRule();
  const updateRule = useUpdateRule();
  const deleteRule = useDeleteRule();

  const form = useForm<z.infer<typeof ruleSchema>>({
    resolver: zodResolver(ruleSchema),
    defaultValues: {
      name: "",
      category: "",
      pattern: "{YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}",
      folderPath: "Documents/",
      extensions: "",
      priority: 0,
    },
  });

  const sortedRules: Rule[] = rules
    ? localOrder
      ? localOrder.map((id) => rules.find((r) => r.id === id)!).filter(Boolean)
      : [...rules].sort((a, b) => b.priority - a.priority)
    : [];

  const handleCreate = (values: z.infer<typeof ruleSchema>) => {
    createRule.mutate(
      { data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
          setLocalOrder(null);
          setIsDialogOpen(false);
          form.reset();
          toast({ title: "Rule created" });
        },
      }
    );
  };

  const handleImportStarters = async (selected: StarterRule[]) => {
    setStarterImporting(true);
    try {
      for (const rule of selected) {
        await createRule.mutateAsync({ data: rule });
      }
      await queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
      setLocalOrder(null);
      setIsStarterOpen(false);
      toast({
        title: `${selected.length} rule${selected.length !== 1 ? "s" : ""} imported`,
        description: "You can edit, reorder, or disable them at any time.",
      });
    } catch {
      toast({ title: "Import failed", description: "Some rules may not have been created.", variant: "destructive" });
    } finally {
      setStarterImporting(false);
    }
  };

  const handleToggle = (id: number, isActive: boolean) => {
    updateRule.mutate(
      { id, data: { isActive: !isActive } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() }) }
    );
  };

  const handleDelete = (id: number) => {
    deleteRule.mutate(
      { id },
      {
        onSuccess: () => {
          setLocalOrder(null);
          queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
          toast({ title: "Rule deleted" });
        },
      }
    );
  };

  const handleDragStart = (id: number) => {
    draggedRef.current = id;
    setDraggedId(id);
    if (!localOrder && rules) {
      setLocalOrder([...rules].sort((a, b) => b.priority - a.priority).map((r) => r.id));
    }
  };

  const handleDragOver = (e: React.DragEvent, id: number) => {
    e.preventDefault();
    if (draggedRef.current === id) return;
    setDragOverId(id);

    setLocalOrder((prev) => {
      const order = prev ?? sortedRules.map((r) => r.id);
      const from = order.indexOf(draggedRef.current!);
      const to = order.indexOf(id);
      if (from === -1 || to === -1) return prev;
      const next = [...order];
      next.splice(from, 1);
      next.splice(to, 0, draggedRef.current!);
      return next;
    });
  };

  const handleDragEnd = () => {
    const finalOrder = localOrder ?? sortedRules.map((r) => r.id);
    setDraggedId(null);
    setDragOverId(null);
    draggedRef.current = null;

    Promise.all(
      finalOrder.map((id, idx) =>
        updateRule.mutateAsync({ id, data: { priority: finalOrder.length - 1 - idx } })
      )
    ).then(() => {
      queryClient.invalidateQueries({ queryKey: getListRulesQueryKey() });
      setLocalOrder(null);
    }).catch(() => {
      toast({ title: "Failed to save new order", variant: "destructive" });
    });
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-rules">Naming Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define how files should be named and where they should go — drag to reorder by priority
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setIsStarterOpen(true)}
          >
            <Sparkles className="w-4 h-4" /> Starter rules
          </Button>
          <Button data-testid="button-add-rule" onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Add Rule
          </Button>
        </div>
      </div>

      <div className="bg-card border border-card-border rounded-lg overflow-hidden">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Loading rules...</div>
        ) : sortedRules.length > 0 ? (
          sortedRules.map((rule, idx) => (
            <div
              key={rule.id}
              data-testid={`rule-${rule.id}`}
              draggable
              onDragStart={() => handleDragStart(rule.id)}
              onDragOver={(e) => handleDragOver(e, rule.id)}
              onDragEnd={handleDragEnd}
              className={cn(
                "flex items-start gap-4 px-4 py-4 border-b border-border last:border-0 transition-all select-none",
                !rule.isActive && "opacity-60",
                draggedId === rule.id && "opacity-40 scale-[0.99]",
                dragOverId === rule.id && draggedId !== rule.id && "border-t-2 border-t-primary"
              )}
            >
              <div
                className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground transition-colors mt-1 shrink-0"
                title="Drag to reorder"
              >
                <GripVertical className="w-4 h-4" />
              </div>
              <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0 mt-0.5">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{rule.name}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", CATEGORY_COLORS[rule.category] ?? "bg-accent text-accent-foreground")}>
                    {rule.category}
                  </span>
                  {!rule.isActive && (
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">disabled</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Pattern:</span>
                  <code className="text-xs font-mono text-primary bg-accent px-1.5 py-0.5 rounded">{rule.pattern}</code>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Folder:</span>
                  <span className="text-xs font-mono text-foreground">{rule.folderPath}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">Extensions:</span>
                  <span className="text-xs text-foreground">{rule.extensions}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  data-testid={`button-toggle-rule-${rule.id}`}
                  onClick={() => handleToggle(rule.id, rule.isActive)}
                  className={cn(
                    "p-1.5 rounded transition-colors",
                    rule.isActive ? "text-primary hover:bg-accent" : "text-muted-foreground hover:bg-muted"
                  )}
                  title={rule.isActive ? "Disable rule" : "Enable rule"}
                >
                  <Power className="w-4 h-4" />
                </button>
                <button
                  data-testid={`button-delete-rule-${rule.id}`}
                  onClick={() => handleDelete(rule.id)}
                  className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/20 text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="py-16 flex flex-col items-center gap-3 text-center">
            <BookOpen className="w-10 h-10 text-muted-foreground/40" />
            <div className="text-sm font-medium text-foreground">No rules yet</div>
            <div className="text-xs text-muted-foreground max-w-xs">
              Add naming rules to control how files are categorised, named, and where they are placed.
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setIsStarterOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5" /> Load starter rules
              </Button>
              <Button size="sm" onClick={() => setIsDialogOpen(true)} className="gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Add Custom Rule
              </Button>
            </div>
          </div>
        )}
      </div>

      <StarterRulesDialog
        open={isStarterOpen}
        onClose={() => setIsStarterOpen(false)}
        onImport={handleImportStarters}
        importing={starterImporting}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Naming Rule</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rule Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-rule-name" placeholder="e.g. Work Reports" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-rule-category">
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="pattern"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Naming Pattern</FormLabel>
                    <FormControl>
                      <Input data-testid="input-rule-pattern" placeholder="{YYYY-MM-DD}_{Category}_{Description}_{version}" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="folderPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Target Folder Path</FormLabel>
                    <FormControl>
                      <Input data-testid="input-rule-folder" placeholder="Documents/Work/Reports" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="extensions"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>File Extensions (comma-separated)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-rule-extensions" placeholder="pdf,doc,docx,txt" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button data-testid="button-save-rule" type="submit" disabled={createRule.isPending}>
                  {createRule.isPending ? "Creating..." : "Create Rule"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
