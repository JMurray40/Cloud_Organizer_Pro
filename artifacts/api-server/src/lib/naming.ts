const FOLDER_MAP: Record<string, string> = {
  Work: "Documents/Work",
  Finance: "Documents/Finance",
  Personal: "Documents/Personal",
  Projects: "Documents/Projects",
  Media: "Media",
  Archives: "Archives",
};

export function applyNamingConvention(
  originalName: string,
  category: string,
  subCategory?: string,
  existingNames?: string[]
): { suggestedName: string; suggestedPath: string; extension: string; explanation: string; confidence: number } {
  const detectedDate = extractDateFromFilename(originalName);
  const dateStr = detectedDate ?? new Date().toISOString().split("T")[0];
  const dateSource = detectedDate ? "extracted from filename" : "today's date";

  const parts = originalName.split(".");
  const extension = parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
  const rawBase = parts.join(".");

  const description = sanitizeDescription(rawBase);

  const existingVersion = extractVersion(rawBase);
  const version = existingVersion ?? resolveVersion(description, category, subCategory, existingNames);

  const nameParts = [dateStr, category];
  if (subCategory) nameParts.push(subCategory);
  nameParts.push(description);
  nameParts.push(version);

  const suggestedName = extension
    ? `${nameParts.join("_")}.${extension}`
    : nameParts.join("_");

  const baseFolder = FOLDER_MAP[category] ?? "Documents/Other";
  const subFolder = subCategory ? `/${subCategory}` : "";
  const suggestedPath = `${baseFolder}${subFolder}`;

  const confidence = computeConfidence(originalName, category, subCategory, detectedDate, extension);

  const explanation = [
    `Category: ${category}${subCategory ? ` / ${subCategory}` : ""}`,
    `Date: ${dateStr} (${dateSource})`,
    `Version: ${version}`,
    `Confidence: ${confidence}%`,
    `Place in: ${suggestedPath}`,
  ].join(" · ");

  return { suggestedName, suggestedPath, extension, explanation, confidence };
}

/**
 * Extract a YYYY-MM-DD date from a filename, only when there is strong evidence.
 *
 * We intentionally do NOT fall back to "any 4-digit year" because filenames like
 * "iPhone 2024 review.pdf" would otherwise produce a misleading 2024-01-01 date.
 * A year alone, without any month/quarter signal, is treated as no date.
 */
function extractDateFromFilename(filename: string): string | null {
  const lower = filename.toLowerCase();

  const isoFull = filename.match(/\b(\d{4}[-/]\d{2}[-/]\d{2})\b/);
  if (isoFull) return isoFull[1].replace(/\//g, "-");

  const isoShort = filename.match(/\b(\d{4}[-/]\d{2})\b/);
  if (isoShort) return `${isoShort[1].replace(/\//g, "-")}-01`;

  const MONTHS: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
    jan: "01", feb: "02", mar: "03", apr: "04",
    jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  };

  for (const [monthName, monthNum] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b(${monthName})\\s+(\\d{4})\\b`, "i");
    const m = lower.match(re);
    if (m) return `${m[2]}-${monthNum}-01`;

    const re2 = new RegExp(`\\b(\\d{4})\\s+${monthName}\\b`, "i");
    const m2 = lower.match(re2);
    if (m2) return `${m2[1]}-${monthNum}-01`;
  }

  const quarterMatch = lower.match(/\bq([1-4])\s*(\d{4})\b/) ?? lower.match(/\b(\d{4})\s*q([1-4])\b/);
  if (quarterMatch) {
    const quarter = parseInt(quarterMatch[1] ?? quarterMatch[2]);
    const year = quarterMatch[2] ?? quarterMatch[1];
    const monthNum = String((quarter - 1) * 3 + 1).padStart(2, "0");
    return `${year}-${monthNum}-01`;
  }

  // Deliberate: no year-only fallback (too noisy).
  return null;
}

function resolveVersion(
  description: string,
  category: string,
  subCategory: string | undefined,
  existingNames?: string[]
): string {
  if (!existingNames || existingNames.length === 0) return "v1";

  let maxVersion = 0;
  for (const name of existingNames) {
    const nameLower = name.toLowerCase();
    if (nameLower.includes(description.toLowerCase())) {
      const vMatch = nameLower.match(/_v(\d+)/);
      if (vMatch) {
        const v = parseInt(vMatch[1]);
        if (v > maxVersion) maxVersion = v;
      }
    }
  }

  return maxVersion > 0 ? `v${maxVersion + 1}` : "v1";
}

function computeConfidence(
  filename: string,
  category: string,
  subCategory: string | undefined,
  detectedDate: string | null,
  extension: string
): number {
  let score = 50;

  if (detectedDate) score += 20;

  const strong: Record<string, string[]> = {
    Finance: ["invoice", "receipt", "tax", "bill", "payment", "budget", "statement"],
    Work: ["report", "contract", "proposal", "presentation", "agenda", "memo"],
    Personal: ["health", "medical", "passport", "insurance", "visa"],
    Projects: ["project", "client", "deliverable", "milestone"],
    Media: ["photo", "video", "audio", "music", "movie"],
    Archives: ["archive", "backup", "old", "2019", "2020", "2021"],
  };

  const keywords = strong[category] ?? [];
  const lower = filename.toLowerCase();
  const keywordHit = keywords.some((k) => lower.includes(k));
  if (keywordHit) score += 20;
  if (subCategory) score += 10;

  const docExtensions = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx"];
  const mediaExtensions = ["jpg", "jpeg", "png", "mp4", "mov", "mp3"];
  if (docExtensions.includes(extension) || mediaExtensions.includes(extension)) score += 5;

  if (filename.match(/\bcopy\b/i) || filename.match(/\(\d+\)/)) score -= 10;

  return Math.min(100, Math.max(10, score));
}

/**
 * Reduce a raw base name (filename minus extension) to a kebab-case description.
 * Empty/garbage input → empty string (caller decides what to do — we no longer
 * collapse everything to "untitled" because that caused unrelated files to
 * collide in the duplicate-detection grouping.)
 */
function sanitizeDescription(raw: string): string {
  const cleaned = raw
    .replace(/\(\d+\)$/, "")
    .replace(/- copy$/i, "")
    .replace(/copy of /i, "")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_v\d+$/i, "")
    .slice(0, 50);

  // Fall back to a stable hash-ish slug derived from the raw input to keep
  // empty descriptions UNIQUE between unrelated files.
  if (!cleaned) {
    const fp = Array.from(raw).reduce((h, c) => ((h << 5) - h + c.charCodeAt(0)) | 0, 0);
    return `file-${(fp >>> 0).toString(36).slice(0, 6)}`;
  }
  return cleaned;
}

function extractVersion(raw: string): string | null {
  const match = raw.match(/_v(\d+)$/i) ?? raw.match(/\bv(\d+)\b/i);
  if (match) return `v${match[1]}`;
  const copyMatch = raw.match(/\((\d+)\)$/);
  if (copyMatch) return `v${parseInt(copyMatch[1]) + 1}`;
  return null;
}
