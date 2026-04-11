import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/dashboard";
import FilesPage from "@/pages/files";
import ScanPage from "@/pages/scan";
import DropPage from "@/pages/drop";
import RulesPage from "@/pages/rules";
import AccountsPage from "@/pages/accounts";
import ConventionPage from "@/pages/convention";
import DuplicatesPage from "@/pages/duplicates";
import HistoryPage from "@/pages/history";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/files" component={FilesPage} />
        <Route path="/scan" component={ScanPage} />
        <Route path="/drop" component={DropPage} />
        <Route path="/rules" component={RulesPage} />
        <Route path="/accounts" component={AccountsPage} />
        <Route path="/convention" component={ConventionPage} />
        <Route path="/duplicates" component={DuplicatesPage} />
        <Route path="/history" component={HistoryPage} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
