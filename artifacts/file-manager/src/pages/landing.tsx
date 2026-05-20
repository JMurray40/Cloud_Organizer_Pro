import { Link } from "wouter";
import { FolderOpen, CheckCircle, Copy, Cloud, ArrowRight, Zap } from "lucide-react";

const features = [
  {
    icon: Zap,
    title: "Instant naming suggestions",
    description: "Drop a file and get a perfectly structured name following the YYYY-MM-DD_Category convention.",
  },
  {
    icon: Copy,
    title: "Duplicate detection",
    description: "Automatically identify duplicate files across all your cloud accounts and reclaim wasted space.",
  },
  {
    icon: Cloud,
    title: "Multi-cloud tracking",
    description: "Track files across Google Drive, Dropbox, OneDrive, iCloud and Box from one place.",
  },
  {
    icon: CheckCircle,
    title: "Bulk organization",
    description: "Paste a list of filenames and get bulk rename suggestions with one-click apply.",
  },
];

const today = new Date().toISOString().split("T")[0];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Nav */}
      <header className="border-b border-border px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <FolderOpen className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="text-sm font-semibold text-foreground">FileOrbit</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/sign-in"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className="text-sm font-medium bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:opacity-90 transition-opacity"
          >
            Get started free
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 text-center">
        <div className="inline-flex items-center gap-2 bg-accent text-accent-foreground text-xs font-semibold px-3 py-1.5 rounded-full mb-6 border border-accent-border">
          <Zap className="w-3 h-3" />
          Smart file organization
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-foreground max-w-2xl leading-tight mb-4">
          Stop losing files.<br />
          <span className="text-primary">Start organizing them.</span>
        </h1>

        <p className="text-lg text-muted-foreground max-w-xl mb-8 leading-relaxed">
          FileOrbit enforces a consistent naming convention across all your cloud accounts,
          detects duplicates, and suggests the right folder — automatically.
        </p>

        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/sign-in"
            className="inline-flex items-center gap-2 border border-border text-foreground font-semibold px-6 py-3 rounded-xl hover:bg-muted transition-colors"
          >
            Sign in
          </Link>
        </div>

        <p className="text-xs text-muted-foreground">No credit card required</p>

        {/* Naming convention preview */}
        <div className="mt-12 bg-muted/50 border border-border rounded-2xl px-6 py-5 max-w-lg w-full text-left">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            Naming convention
          </p>
          <div className="font-mono text-sm text-foreground break-all">
            <span className="text-primary">{today}</span>
            <span className="text-muted-foreground">_</span>
            <span className="text-blue-500">Work</span>
            <span className="text-muted-foreground">_</span>
            <span className="text-purple-500">Reports</span>
            <span className="text-muted-foreground">_</span>
            <span className="text-foreground">Q1-Sales-Summary</span>
            <span className="text-muted-foreground">_</span>
            <span className="text-orange-500">v1</span>
            <span className="text-muted-foreground">.pdf</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Every file named consistently → always findable
          </p>
        </div>

        {/* Features grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl w-full text-left">
          {features.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex gap-4 p-5 bg-card border border-card-border rounded-xl">
              <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground mb-1">{title}</div>
                <div className="text-xs text-muted-foreground leading-relaxed">{description}</div>
              </div>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} FileOrbit — Smart File Manager
      </footer>
    </div>
  );
}
