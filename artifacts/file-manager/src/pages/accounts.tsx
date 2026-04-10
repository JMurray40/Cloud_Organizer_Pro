import { useState, useEffect } from "react";
import {
  useListCloudAccounts,
  useCreateCloudAccount,
  useUpdateCloudAccount,
  useDeleteCloudAccount,
  getListCloudAccountsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Files, HardDrive, Wifi, WifiOff, CheckCircle2, ExternalLink, Info } from "lucide-react";
import { SiGoogledrive, SiDropbox, SiIcloud, SiBox } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const PROVIDERS = [
  { value: "google_drive", label: "Google Drive", icon: SiGoogledrive, color: "text-[#4285F4]", bg: "bg-[#4285F4]/10", freeQuotaGb: 15, typicalUsedGb: 4.2 },
  { value: "dropbox", label: "Dropbox", icon: SiDropbox, color: "text-[#0061FF]", bg: "bg-[#0061FF]/10", freeQuotaGb: 2, typicalUsedGb: 0.8 },
  { value: "onedrive", label: "OneDrive", icon: HardDrive, color: "text-[#0078D4]", bg: "bg-[#0078D4]/10", freeQuotaGb: 5, typicalUsedGb: 1.1 },
  { value: "icloud", label: "iCloud Drive", icon: SiIcloud, color: "text-[#3478F6]", bg: "bg-[#3478F6]/10", freeQuotaGb: 5, typicalUsedGb: 3.7 },
  { value: "box", label: "Box", icon: SiBox, color: "text-[#0061D5]", bg: "bg-[#0061D5]/10", freeQuotaGb: 10, typicalUsedGb: 2.3 },
  { value: "local", label: "Local Storage", icon: HardDrive, color: "text-muted-foreground", bg: "bg-muted", freeQuotaGb: null, typicalUsedGb: null },
];

function ProviderIcon({ provider, className }: { provider: string; className?: string }) {
  const p = PROVIDERS.find((p) => p.value === provider);
  if (!p) return <HardDrive className={cn("w-5 h-5", className)} />;
  const Icon = p.icon;
  return <Icon className={cn("w-5 h-5", p.color, className)} />;
}

function StorageBar({ used, total }: { used: number | null; total: number | null }) {
  if (used == null || total == null || total === 0) return null;
  const pct = Math.min(100, (used / total) * 100);
  const free = total - used;
  const color = pct > 90 ? "bg-red-500" : pct > 75 ? "bg-yellow-500" : "bg-primary";
  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{used.toFixed(1)} GB used</span>
        <span>{free.toFixed(1)} GB free of {total} GB</span>
      </div>
    </div>
  );
}

type ConnectStep = "pick-provider" | "oauth-info" | "manual-form";

export default function AccountsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<ConnectStep>("pick-provider");
  const [selectedProvider, setSelectedProvider] = useState<typeof PROVIDERS[0] | null>(null);
  const [oauthData, setOauthData] = useState<{ state: string; instructions: string } | null>(null);
  const [loadingOauth, setLoadingOauth] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: accounts, isLoading } = useListCloudAccounts();
  const createAccount = useCreateCloudAccount();
  const updateAccount = useUpdateCloudAccount();
  const deleteAccount = useDeleteCloudAccount();

  const manualForm = useForm<{ name: string; accountLabel: string; rootPath: string; quotaTotalGb: string; quotaUsedGb: string }>({
    resolver: zodResolver(
      z.object({
        name: z.string().min(1, "Required"),
        accountLabel: z.string().min(1, "Required"),
        rootPath: z.string().optional(),
        quotaTotalGb: z.string().optional(),
        quotaUsedGb: z.string().optional(),
      })
    ),
    defaultValues: { name: "", accountLabel: "", rootPath: "", quotaTotalGb: "", quotaUsedGb: "" },
  });

  const simulateForm = useForm<{ name: string; accountLabel: string }>({
    resolver: zodResolver(z.object({ name: z.string().min(1, "Required"), accountLabel: z.string().min(1, "Required") })),
    defaultValues: { name: "", accountLabel: "" },
  });

  const openDialog = () => {
    setStep("pick-provider");
    setSelectedProvider(null);
    setOauthData(null);
    manualForm.reset();
    simulateForm.reset();
    setDialogOpen(true);
  };

  const handlePickProvider = async (provider: typeof PROVIDERS[0]) => {
    setSelectedProvider(provider);
    if (provider.value === "local") {
      setStep("manual-form");
      manualForm.setValue("rootPath", "/");
      return;
    }
    setLoadingOauth(true);
    try {
      const res = await fetch(`${BASE}/api/oauth/connect/${provider.value}`);
      const data = await res.json();
      setOauthData({ state: data.state, instructions: data.instructions });
      simulateForm.setValue("name", `My ${provider.label}`);
      simulateForm.setValue("accountLabel", "");
      setStep("oauth-info");
    } catch {
      toast({ title: "Could not fetch OAuth info", variant: "destructive" });
    } finally {
      setLoadingOauth(false);
    }
  };

  const handleSimulateOauth = async (values: { name: string; accountLabel: string }) => {
    if (!selectedProvider || !oauthData) return;
    const res = await fetch(`${BASE}/api/oauth/callback/${selectedProvider.value}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        state: oauthData.state,
        accountName: values.name,
        accountLabel: values.accountLabel,
        simulatedQuotaTotalGb: selectedProvider.freeQuotaGb,
        simulatedQuotaUsedGb: selectedProvider.typicalUsedGb,
      }),
    });
    if (!res.ok) {
      toast({ title: "Connection failed", variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() });
    setDialogOpen(false);
    toast({ title: `${selectedProvider.label} connected!`, description: `${values.name} is now tracked in FileOrbit.` });
  };

  const handleManualCreate = (values: { name: string; accountLabel: string; rootPath?: string; quotaTotalGb?: string; quotaUsedGb?: string }) => {
    if (!selectedProvider) return;
    createAccount.mutate(
      {
        data: {
          name: values.name,
          provider: selectedProvider.value,
          accountLabel: values.accountLabel,
          rootPath: values.rootPath || null,
          quotaTotalGb: values.quotaTotalGb ? parseFloat(values.quotaTotalGb) : null,
          quotaUsedGb: values.quotaUsedGb ? parseFloat(values.quotaUsedGb) : null,
        },
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() });
          setDialogOpen(false);
          toast({ title: "Account added" });
        },
      }
    );
  };

  const handleToggle = (id: number, isActive: boolean) => {
    updateAccount.mutate(
      { id, data: { isActive: !isActive } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCloudAccountsQueryKey() }) }
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

  const getProviderMeta = (provider: string) => PROVIDERS.find((p) => p.value === provider);

  const totalStorage = accounts?.reduce((sum, a) => sum + (a.quotaTotalGb ?? 0), 0) ?? 0;
  const usedStorage = accounts?.reduce((sum, a) => sum + (a.quotaUsedGb ?? 0), 0) ?? 0;

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="page-title-accounts">Cloud Accounts</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your connected cloud storage services</p>
        </div>
        <Button data-testid="button-add-account" onClick={openDialog} className="gap-2">
          <Plus className="w-4 h-4" /> Connect Account
        </Button>
      </div>

      {totalStorage > 0 && (
        <div className="bg-card border border-card-border rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Total Storage Across All Drives</span>
            <span className="text-xs text-muted-foreground">{usedStorage.toFixed(1)} GB used of {totalStorage.toFixed(1)} GB</span>
          </div>
          <StorageBar used={usedStorage} total={totalStorage} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">Loading accounts...</div>
        ) : accounts && accounts.length > 0 ? (
          accounts.map((account) => {
            const meta = getProviderMeta(account.provider);
            const freeGb = account.quotaTotalGb != null && account.quotaUsedGb != null ? account.quotaTotalGb - account.quotaUsedGb : null;
            return (
              <div
                key={account.id}
                data-testid={`account-${account.id}`}
                className={cn("bg-card border border-card-border rounded-xl p-4 space-y-3 transition-opacity", !account.isActive && "opacity-60")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", meta?.bg ?? "bg-muted")}>
                      <ProviderIcon provider={account.provider} />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        {account.name}
                        {account.connectedViaOAuth && (
                          <span title="Connected via OAuth" className="text-primary">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">{meta?.label ?? account.provider}</div>
                    </div>
                  </div>
                  <button
                    data-testid={`button-toggle-account-${account.id}`}
                    onClick={() => handleToggle(account.id, account.isActive)}
                    className={cn(
                      "px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                      account.isActive
                        ? "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground hover:bg-muted/70"
                    )}
                  >
                    {account.isActive ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                    {account.isActive ? "Active" : "Inactive"}
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="font-medium text-foreground">{account.accountLabel}</div>
                  {account.rootPath && (
                    <div className="font-mono text-muted-foreground truncate">{account.rootPath}</div>
                  )}
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Files className="w-3.5 h-3.5" />
                    <span>{account.fileCount} files tracked</span>
                    {freeGb != null && (
                      <>
                        <span className="mx-1">·</span>
                        <span className={cn(freeGb < 1 ? "text-red-500 font-medium" : "")}>{freeGb.toFixed(1)} GB free</span>
                      </>
                    )}
                  </div>
                </div>

                <StorageBar used={account.quotaUsedGb} total={account.quotaTotalGb} />

                <button
                  data-testid={`button-delete-account-${account.id}`}
                  onClick={() => handleDelete(account.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove
                </button>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-12 text-center text-muted-foreground text-sm">
            No cloud accounts yet. Connect your first account.
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {step === "pick-provider" && "Connect a Cloud Account"}
              {step === "oauth-info" && `Connect ${selectedProvider?.label}`}
              {step === "manual-form" && "Add Local Storage"}
            </DialogTitle>
          </DialogHeader>

          {step === "pick-provider" && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">Choose your storage provider to get started</p>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDERS.map((p) => {
                  const Icon = p.icon;
                  return (
                    <button
                      key={p.value}
                      onClick={() => handlePickProvider(p)}
                      disabled={loadingOauth}
                      className={cn(
                        "flex items-center gap-3 p-3.5 rounded-xl border border-border hover:border-primary/50 hover:bg-muted/60 transition-all text-left group",
                        loadingOauth && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", p.bg)}>
                        <Icon className={cn("w-5 h-5", p.color)} />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground">{p.label}</div>
                        {p.freeQuotaGb && (
                          <div className="text-[10px] text-muted-foreground">{p.freeQuotaGb} GB free tier</div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === "oauth-info" && selectedProvider && oauthData && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg text-sm text-blue-700 dark:text-blue-300">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{oauthData.instructions}</span>
              </div>

              <Form {...simulateForm}>
                <form onSubmit={simulateForm.handleSubmit(handleSimulateOauth)} className="space-y-3">
                  <FormField
                    control={simulateForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Account Nickname</FormLabel>
                        <FormControl>
                          <Input placeholder={`My ${selectedProvider.label}`} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={simulateForm.control}
                    name="accountLabel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Your {selectedProvider.label} email</FormLabel>
                        <FormControl>
                          <Input placeholder="you@example.com" type="email" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                    <div className="font-medium text-foreground">Storage will be tracked:</div>
                    <div>Free quota: {selectedProvider.freeQuotaGb} GB · Typical usage: ~{selectedProvider.typicalUsedGb} GB</div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("pick-provider")}>Back</Button>
                    <Button type="submit" className="flex-1 gap-2">
                      <CheckCircle2 className="w-4 h-4" />
                      Simulate Connection
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          )}

          {step === "manual-form" && selectedProvider && (
            <Form {...manualForm}>
              <form onSubmit={manualForm.handleSubmit(handleManualCreate)} className="space-y-3">
                <FormField control={manualForm.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Name</FormLabel>
                    <FormControl><Input placeholder="My Local Drive" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={manualForm.control} name="accountLabel" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Label / Path identifier</FormLabel>
                    <FormControl><Input placeholder="/Users/me" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={manualForm.control} name="rootPath" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Root Folder Path (optional)</FormLabel>
                    <FormControl><Input placeholder="/Users/me/Documents" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={manualForm.control} name="quotaTotalGb" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total Space (GB)</FormLabel>
                      <FormControl><Input type="number" step="0.1" placeholder="500" {...field} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={manualForm.control} name="quotaUsedGb" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Used Space (GB)</FormLabel>
                      <FormControl><Input type="number" step="0.1" placeholder="120" {...field} /></FormControl>
                    </FormItem>
                  )} />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="outline" className="flex-1" onClick={() => setStep("pick-provider")}>Back</Button>
                  <Button type="submit" className="flex-1" disabled={createAccount.isPending}>
                    {createAccount.isPending ? "Adding..." : "Add Account"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
