import { useState } from "react";
import { useListCloudAccounts, useCreateCloudAccount, useUpdateCloudAccount, useDeleteCloudAccount, getListCloudAccountsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Files, HardDrive } from "lucide-react";
import { SiGoogledrive, SiDropbox, SiIcloud, SiBox } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { value: "google_drive", label: "Google Drive", icon: SiGoogledrive, color: "text-[#4285F4]" },
  { value: "dropbox", label: "Dropbox", icon: SiDropbox, color: "text-[#0061FF]" },
  { value: "onedrive", label: "OneDrive", icon: HardDrive, color: "text-[#0078D4]" },
  { value: "icloud", label: "iCloud Drive", icon: SiIcloud, color: "text-[#3478F6]" },
  { value: "box", label: "Box", icon: SiBox, color: "text-[#0061D5]" },
  { value: "local", label: "Local Storage", icon: HardDrive, color: "text-muted-foreground" },
];

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const p = PROVIDERS.find((p) => p.value === provider);
  if (!p) return <HardDrive className={cn("w-5 h-5", className)} />;
  const Icon = p.icon;
  return <Icon className={cn("w-5 h-5", p.color, className)} />;
}

const accountSchema = z.object({
  name: z.string().min(1, "Name is required"),
  provider: z.string().min(1, "Provider is required"),
  accountLabel: z.string().min(1, "Account label is required"),
  rootPath: z.string().optional(),
});

export default function AccountsPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accounts, isLoading } = useListCloudAccounts();
  const createAccount = useCreateCloudAccount();
  const updateAccount = useUpdateCloudAccount();
  const deleteAccount = useDeleteCloudAccount();

  const form = useForm<z.infer<typeof accountSchema>>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      provider: "",
      accountLabel: "",
      rootPath: "",
    },
  });

  const handleCreate = (values: z.infer<typeof accountSchema>) => {
    createAccount.mutate(
      { data: { ...values, rootPath: values.rootPath || null } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() });
          setIsDialogOpen(false);
          form.reset();
          toast({ title: "Cloud account added" });
        },
      }
    );
  };

  const handleToggle = (id: number, isActive: boolean) => {
    updateAccount.mutate(
      { id, data: { isActive: !isActive } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() });
        },
      }
    );
  };

  const handleDelete = (id: number) => {
    deleteAccount.mutate(
      { id },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() });
          toast({ title: "Account removed" });
        },
      }
    );
  };

  const getProviderLabel = (provider: string) =>
    PROVIDERS.find((p) => p.value === provider)?.label ?? provider;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-accounts">Cloud Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your connected cloud storage services</p>
        </div>
        <Button data-testid="button-add-account" onClick={() => setIsDialogOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Add Account
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Loading accounts...</div>
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => (
            <div
              key={account.id}
              data-testid={`account-${account.id}`}
              className={cn(
                "bg-card border border-card-border rounded-lg p-4 space-y-3 transition-opacity",
                !account.isActive && "opacity-60"
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <ProviderIcon provider={account.provider} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{account.name}</div>
                    <div className="text-xs text-muted-foreground">{getProviderLabel(account.provider)}</div>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    data-testid={`button-toggle-account-${account.id}`}
                    onClick={() => handleToggle(account.id, account.isActive)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors",
                      account.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    {account.isActive ? "Active" : "Inactive"}
                  </button>
                </div>
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="font-medium text-foreground">{account.accountLabel}</span>
                </div>
                {account.rootPath && (
                  <div className="font-mono text-muted-foreground truncate">{account.rootPath}</div>
                )}
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Files className="w-3.5 h-3.5" />
                  <span>{account.fileCount} files tracked</span>
                </div>
              </div>
              <button
                data-testid={`button-delete-account-${account.id}`}
                onClick={() => handleDelete(account.id)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" /> Remove
              </button>
            </div>
          ))
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            No cloud accounts yet. Add your first account.
          </div>
        )}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Cloud Account</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl>
                      <Input data-testid="input-account-name" placeholder="e.g. Personal Google Drive" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage Provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-account-provider">
                          <SelectValue placeholder="Select provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PROVIDERS.map((p) => {
                          const Icon = p.icon;
                          return (
                            <SelectItem key={p.value} value={p.value}>
                              <div className="flex items-center gap-2">
                                <Icon className={cn("w-4 h-4", p.color)} />
                                {p.label}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="accountLabel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Label (email or identifier)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-account-label" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="rootPath"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Root Path (optional)</FormLabel>
                    <FormControl>
                      <Input data-testid="input-account-path" placeholder="/My Drive" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button data-testid="button-save-account" type="submit" disabled={createAccount.isPending}>
                  {createAccount.isPending ? "Adding..." : "Add Account"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
