import { useState, useRef } from "react";
import { useListRules, useCreateRule, useUpdateRule, useDeleteRule, getListRulesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, GripVertical, Power, BookOpen } from "lucide-react";
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

export default function RulesPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-rules">Naming Rules</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Define how files should be named and where they should go — drag to reorder by priority
          </p>
        </div>
        <Button data-testid="button-add-rule" onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Rule
        </Button>
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
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium">{rule.category}</span>
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
            <Button size="sm" onClick={() => setIsDialogOpen(true)} className="mt-1 gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add First Rule
            </Button>
          </div>
        )}
      </div>

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
