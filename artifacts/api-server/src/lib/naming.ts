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
  subCategory?: string
): { suggestedName: string; suggestedPath: string; extension: string; explanation: string } {
  const today = new Date();
  const dateStr = today.toISOString().split("T")[0];

  const parts = originalName.split(".");
  const extension = parts.length > 1 ? (parts.pop() ?? "").toLowerCase() : "";
  const rawBase = parts.join(".");

  const description = sanitizeDescription(rawBase);
  const version = extractVersion(rawBase) ?? "v1";

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

  const explanation = `File renamed to follow convention: {YYYY-MM-DD}_{Category}_{SubCategory}_{Description}_{version}. Detected category: ${category}${subCategory ? `, sub-category: ${subCategory}` : ""}. Place in: ${suggestedPath}`;

  return { suggestedName, suggestedPath, extension, explanation };
}

function sanitizeDescription(raw: string): string {
  return raw
    .replace(/\(\d+\)$/, "")
    .replace(/- copy$/i, "")
    .replace(/copy of /i, "")
    .replace(/[^a-zA-Z0-9\s\-_]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/_v\d+$/i, "")
    .slice(0, 50)
    || "untitled";
}

function extractVersion(raw: string): string | null {
  const match = raw.match(/_v(\d+)$/i) ?? raw.match(/\bv(\d+)\b/i);
  if (match) {
    return `v${match[1]}`;
  }
  const copyMatch = raw.match(/\((\d+)\)$/);
  if (copyMatch) {
    return `v${parseInt(copyMatch[1]) + 1}`;
  }
  return null;
}
