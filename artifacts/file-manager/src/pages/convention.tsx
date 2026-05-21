import { FolderOpen, ArrowRight } from "lucide-react";

const categories = [
  {
    name: "Work",
    folder: "Documents/Work/{SubCategory}/",
    subCategories: ["Reports", "Contracts", "Proposals", "Presentations", "Invoices", "Correspondence"],
    examples: [
      "2024-03-15_Work_Reports_Q1-Sales-Summary_v1.pdf",
      "2024-03-15_Work_Contracts_Acme-Corp-Agreement_v2.docx",
    ],
  },
  {
    name: "Finance",
    folder: "Documents/Finance/{SubCategory}/",
    subCategories: ["Receipts", "Tax", "Banking", "Insurance", "Investments"],
    examples: [
      "2024-03-15_Finance_Receipts_Amazon-Order-1234_v1.pdf",
      "2023-04-15_Finance_Tax_Federal-Tax-Return-2023_v1.pdf",
    ],
  },
  {
    name: "Personal",
    folder: "Documents/Personal/{SubCategory}/",
    subCategories: ["Photos", "Health", "Legal", "Education", "Travel"],
    examples: [
      "2024-01-05_Personal_Photos_Hawaii-Vacation_v1.zip",
      "2024-06-01_Personal_Health_Annual-Checkup-Results_v1.pdf",
    ],
  },
  {
    name: "Projects",
    folder: "Documents/Projects/{ClientOrProject}/",
    subCategories: ["(use client or project name)"],
    examples: [
      "2024-03-01_Projects_ClientX_Proposal-Draft_v1.pptx",
      "2024-02-15_Projects_Website-Redesign_Wireframes_v3.pdf",
    ],
  },
  {
    name: "Media",
    folder: "Media/{SubCategory}/",
    subCategories: ["Photos", "Videos", "Audio"],
    examples: [
      "2024-03-15_Media_Photos_Office-Party_v1.jpg",
      "2024-03-15_Media_Videos_Product-Demo_v1.mp4",
    ],
  },
  {
    name: "Archives",
    folder: "Archives/{Year}/",
    subCategories: ["(organized by year)"],
    examples: [
      "2023-12-31_Archives_Annual-Documents-2023_v1.zip",
    ],
  },
];

export default function ConventionPage() {
  return (
    <div className="px-4 py-4 md:px-6 md:py-6 space-y-5 md:space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground" data-testid="page-title-convention">Naming Convention Guide</h1>
        <p className="text-sm text-muted-foreground mt-1">The standard naming system used across all your files</p>
      </div>

      <div className="bg-primary/10 border border-primary/20 rounded-xl p-6 space-y-3">
        <div className="text-xs font-semibold text-primary uppercase tracking-wider">Master Format</div>
        <div className="font-mono text-lg font-bold text-foreground">
          {"{YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}.{ext}"}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {[
            { token: "{YYYY-MM-DD}", desc: "Date created or relevant date" },
            { token: "{Category}", desc: "Top-level category (Work, Finance...)" },
            { token: "{SubCategory}", desc: "More specific grouping" },
            { token: "{Description}", desc: "Descriptive name, use hyphens" },
            { token: "{version}", desc: "v1, v2, v3... for revisions" },
            { token: "{ext}", desc: "Original file extension" },
          ].map((item) => (
            <div key={item.token} className="space-y-0.5">
              <code className="text-xs text-primary font-mono">{item.token}</code>
              <div className="text-xs text-muted-foreground">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-base font-semibold text-foreground">Categories & Folder Structure</h2>
        {categories.map((cat) => (
          <div key={cat.name} className="bg-card border border-card-border rounded-lg p-5 space-y-3" data-testid={`category-${cat.name.toLowerCase()}`}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center">
                <FolderOpen className="w-4 h-4 text-accent-foreground" />
              </div>
              <div>
                <div className="text-sm font-bold text-foreground">{cat.name}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <ArrowRight className="w-3 h-3" />
                  {cat.folder}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {cat.subCategories.map((sub) => (
                <span key={sub} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{sub}</span>
              ))}
            </div>
            <div className="space-y-1">
              {cat.examples.map((ex) => (
                <code key={ex} className="block text-xs font-mono text-foreground bg-muted px-3 py-1.5 rounded">{ex}</code>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-card border border-card-border rounded-lg p-5 space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Quick Rules</h2>
        <ul className="space-y-2">
          {[
            "Use hyphens (-) within the description segment, underscores (_) to separate segments",
            "Always start with the date in YYYY-MM-DD format",
            "Keep descriptions concise but meaningful — 2-4 words is ideal",
            "Always include a version number (start with v1)",
            "Never use spaces, special characters, or parentheses",
            "When a file is a revision, increment the version number (v1 → v2 → v3)",
            "For duplicate files, the system flags them — resolve by merging or keeping the latest version",
          ].map((rule, i) => (
            <li key={i} className="flex gap-2 text-sm text-muted-foreground">
              <span className="text-primary font-bold shrink-0">{i + 1}.</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
